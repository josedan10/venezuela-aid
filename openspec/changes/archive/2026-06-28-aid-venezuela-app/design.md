# Design: Aid Venezuela Application (aid-venezuela-app)

## Technical Approach

This application is designed to coordinate humanitarian aid (food, medicine, rescue teams, blood donors, helpers, machines) across Venezuela under low-bandwidth and intermittent connectivity conditions. 

- **Next.js (Mobile-First Client)**: Implemented as a mobile-first web app in Spanish, prioritizing minimal asset sizes and aggressive offline buffering. It utilizes local browser database mechanisms (IndexedDB) to buffer GPS updates and sync them once connectivity returns.
- **NestJS (Monolithic Backend)**: Exposes APIs for user registration, NGO needs posting, resource management, and administrative control. It integrates Socket.io for managing real-time connections, active dispatches, and driver statuses. 
- **MySQL (Primary Relational DB)**: Used to store persistent records, including NGO needs, stock availability, users, and dispatch tasks. Concurrency during driver dispatch is managed directly via database transaction locks (`SELECT ... FOR UPDATE`) to prevent double-allocation.
- **Redis (Cache, Geolocation & Queues)**: Serves as the tracking index for driver geolocations (using `GEOADD` and `GEORADIUS`/`GEOSEARCH` commands) and online status. It also powers BullMQ, running 60-second timeouts for dispatches and checking for connection timeouts.
- **Prisma (ORM)**: Handles database access and migrations with structured schemas.

---

## Architecture Decisions

### Decision: Monolithic NestJS Backend + Next.js Mobile-First SPA
- **Choice**: NestJS monolithic backend + Next.js SPA frontend in a monorepo.
- **Alternatives considered**: Microservices architectures (e.g., separate notification, dispatch, and registry services).
- **Rationale**: Simple monolithic deployments reduce infrastructure complexity, making the system easier to deploy and scale in environments with unstable internet or limited hosting budgets. Sharing TypeScript interfaces between the client and server speeds up feature integration and avoids schema drift.

### Decision: Double-Allocation Prevention Mechanism
- **Choice**: MySQL Transactional Row Locking (`SELECT ... FOR UPDATE` via Prisma `$transaction`).
- **Alternatives considered**: Redis-based locking (Redlock).
- **Rationale**: Preventing multiple drivers from accepting the same dispatch task or double-allocating resources is a hard requirement. Utilizing the ACID properties of MySQL guarantees consistency at the source of truth, avoiding race conditions that can occur if the Redis cluster drops connection or crashes, ensuring split-brain issues are avoided.

### Decision: Local Client GPS Buffering
- **Choice**: IndexedDB for offline buffering of location logs.
- **Alternatives considered**: LocalStorage, InMemory caches.
- **Rationale**: IndexedDB offers asynchronous, non-blocking disk operations with much higher storage capacity compared to localstorage, preventing UI lag. If a driver enters a cellular dead zone, location updates continue to be logged locally every 15 seconds with timestamps and are sent to the backend as a batch when connectivity is re-established.

---

## Data Flow

```
       NGO / Beneficiary                 NestJS Backend                 MySQL Database                 Redis Cache                 Driver Client
               │                                │                              │                            │                            │
               │─────── Create Need ───────────>│                              │                            │                            │
               │                                │────── Save Need ────────────>│                            │                            │
               │                                │                                                           │                            │
               │                                │                                   [ Register GPS ] <───────────────────────────────────│
               │                                │                                         │                                              │
               │                                │                                         ▼                                              │
               │                                │                                   GEOADD drivers                                       │
               │                                │                                                                                        │
               │                                │<──────── Find Nearest Driver ─────────────────────────────│                            │
               │                                │  (GEORADIUS / GEOPHILE)                                   │                            │
               │                                │                                                                                        │
               │                                │─────── Socket.io (Task Proposed: 60s Acceptance Timeout) ─────────────────────────────>│
               │                                │                                                                                        │
               │                                │<────── Socket.io Accept Task ──────────────────────────────────────────────────────────│
               │                                │                                                                                        │
               │                                │─────── Begin Transaction ────────────────>│                                            │
               │                                │        SELECT ... FOR UPDATE              │                                            │
               │                                │        (Checks & locks task row)          │                                            │
               │                                │<────── Status Locked & Assigned ──────────│                                            │
               │                                │                                                                                        │
               │                                │──────────────────────────── Periodic GPS (15s) ───────────────────────────────────────>│
               │                                │                             *If offline: buffer in IndexedDB                           │
               │                                │                                                                                        │
               │                                │<─────────── Socket.io Delivery Completed (Photo/Signature) ────────────────────────────│
               │                                │                                                                                        │
               │                                │─────── Complete Task & Deduct Stock ─────>│                                            │
```

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Define schema models including User, DriverDetails, Resource, Need, NeedItem, DispatchTask, StockTransaction, and Enums. |
| `src/users/users.module.ts` | Create | Module file registering User and Driver services, controllers, and database access. |
| `src/users/users.service.ts` | Create | Handles registration (Donor, NGO, Driver), Driver license upload storage, and Admin approval workflow. |
| `src/users/users.controller.ts` | Create | Exposes registration and verification approval endpoints. |
| `src/users/dto/register-driver.dto.ts` | Create | Validation rules for driver details (Cédula, vehicle description, license plate). |
| `src/resources/resources.module.ts` | Create | Module for inventory handling. |
| `src/resources/resources.service.ts` | Create | Manages stocks, expires date validation (Mandatory for Food/Medicine), matching resource locks. |
| `src/resources/resources.controller.ts` | Create | CRUD endpoints for stocks and checking soon-to-expire goods. |
| `src/needs/needs.module.ts` | Create | Module for registering needs and calculating prioritization score. |
| `src/needs/needs.service.ts` | Create | Computes automatic priority score, transitions urgency >= 80 to "ATENCIÓN INMEDIATA", supports graceful fallback to manual State/Sector selection. |
| `src/needs/needs.controller.ts` | Create | Endpoints to post needs and query prioritized queues. |
| `src/dispatch/dispatch.module.ts` | Create | Core matching engine module, registers Redis and Socket.io interfaces. |
| `src/dispatch/dispatch.service.ts` | Create | Task generator, matching logic using Redis geo searches, MySQL SELECT ... FOR UPDATE transactions, 60s timeout monitors, and connection lost checker. |
| `src/dispatch/dispatch.gateway.ts` | Create | Socket.io server gateway handling real-time driver connections, heartbeat alerts, and coordinate streams. |

---

## Interfaces / Contracts

### Prisma Schema Schema Definition

```prisma
enum Role {
  DONOR
  NGO
  DRIVER
  ADMIN
}

enum DriverStatus {
  PENDING_APPROVAL
  VERIFIED
  REJECTED
}

model User {
  id            String         @id @default(uuid())\
  email         String         @unique
  passwordHash  String
  name          String
  role          Role
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  driverDetails DriverDetails?
  needsCreated  Need[]         @relation("NGONeeds")
  dispatches    DispatchTask[] @relation("DriverDispatches")
}

model DriverDetails {
  id             String       @id @default(uuid())
  userId         String       @unique
  user           User         @relation(fields: [userId], references: [id])
  cedula         String       @unique
  vehicleDetails String
  licensePlate   String
  licenseDocUrl  String
  status         DriverStatus @default(PENDING_APPROVAL)
  verifiedAt     DateTime?
}

enum ResourceCategory {
  MEDICINES
  FOOD
  BLOOD_DONORS
  HELPERS
  MACHINES
  RESCUE_TEAMS
}

model Resource {
  id             String           @id @default(uuid())
  name           String
  category       ResourceCategory
  stockQuantity  Int              @default(0)
  expirationDate DateTime? // Required if category is MEDICINES or FOOD
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  stockTrans     StockTransaction[]
  needItems      NeedItem[]
}

model StockTransaction {
  id          String   @id @default(uuid())
  resourceId  String
  resource    Resource @relation(fields: [resourceId], references: [id])
  quantity    Int // positive for additions, negative for deductions
  description String
  createdAt   DateTime @default(now())
}

enum NeedStatus {
  PENDING
  ALLOCATED
  FULFILLED
  CANCELLED
}

model Need {
  id            String         @id @default(uuid())
  ngoId         String
  ngo           User           @relation("NGONeeds", fields: [ngoId], references: [id])
  description   String
  urgencyScore  Int // calculated priority: 1-100
  isImmediate   Boolean        @default(false) // urgencyScore >= 80 -> "ATENCIÓN INMEDIATA"
  state         String // Manual fallback for Estado
  sector        String // Manual fallback for Sector
  latitude      Float?
  longitude     Float?
  status        NeedStatus     @default(PENDING)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  items         NeedItem[]
  dispatchTasks DispatchTask[]
}

model NeedItem {
  id         String   @id @default(uuid())
  needId     String
  need       Need     @relation(fields: [needId], references: [id])
  resourceId String
  resource   Resource @relation(fields: [resourceId], references: [id])
  quantity   Int
}

enum DispatchStatus {
  PROPOSED
  ACCEPTED
  EN_ROUTE
  ALERTA_CONEXION
  DELIVERED
  TIMED_OUT
  CANCELLED
}

model DispatchTask {
  id           String         @id @default(uuid())
  needId       String
  need         Need           @relation(fields: [needId], references: [id])
  driverId     String
  driver       User           @relation("DriverDispatches", fields: [driverId], references: [id])
  status       DispatchStatus @default(PROPOSED)
  proposedAt   DateTime       @default(now())
  acceptedAt   DateTime?
  timeoutAt    DateTime
  signatureUrl String?
  photoUrl     String?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
}
```

### Key Data Transfer Objects (DTOs)

```typescript
// src/users/dto/register-driver.dto.ts
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class RegisterDriverDto {
  @IsString()
  @IsNotEmpty()
  cedula: string;

  @IsString()
  @IsNotEmpty()
  vehicleDetails: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9-]{6,10}$/, { message: 'Invalid license plate format' })
  licensePlate: string;

  @IsString()
  @IsNotEmpty()
  licenseDocUrl: string;
}

// src/needs/dto/create-need.dto.ts
import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class NeedItemDto {
  @IsString()
  @IsNotEmpty()
  resourceId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateNeedDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Min(1)
  @Max(5)
  urgencyRating: number; // User rating to weight overall score

  @IsString()
  @IsNotEmpty()
  state: string; // Estado fallback

  @IsString()
  @IsNotEmpty()
  sector: string; // Sector fallback

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ValidateNested({ each: true })
  @Type(() => NeedItemDto)
  items: NeedItemDto[];
}

// src/dispatch/dto/update-gps.dto.ts
import { IsNumber, IsOptional, IsISO8601 } from 'class-validator';

export class GPSCoordinateDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsISO8601()
  timestamp: string;
}

export class UpdateGPSBatchDto {
  coordinates: GPSCoordinateDto[];
}

// src/dispatch/dto/confirm-delivery.dto.ts
import { IsString, IsOptional } from 'class-validator';

export class ConfirmDeliveryDto {
  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
```

---

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| **Unit** | Expiration validators for food/medicine, priority score urgency weights, DTO payload validation. | Jest unit tests mocking database context. Verify that score >= 80 sets `isImmediate = true` (ATENCIÓN INMEDIATA). |
| **Integration** | Concurrency controls on dispatch locks, automatic 60-second timeouts, offline coordinate syncing. | Run tests in an isolated MySQL/Redis test container. Assert that if driver A accepts, driver B's parallel lock request is blocked and returns an conflict error. |
| **E2E** | Flow from user need submission -> redis match -> client socket acceptance -> location push -> signature delivery. | Supertest + socket.io-client mocks simulating the entire NGO to driver lifecycle. |

---

## Migration / Rollout

1. Run schema generation and Prisma migration tools to build database tables.
2. Seed the DB with required categories (Medicines, Food, Blood Donors, Helpers, Machines, Rescue Teams).
3. Seed initial testing admin accounts and verified helper/rescue agencies.

---

## Open Questions

- [ ] Should driver's license image uploading be signed/encrypted in transit due to Venezuelan privacy regulations?
- [ ] What is the retry interval for dispatching to the next closest driver if the first driver times out?
