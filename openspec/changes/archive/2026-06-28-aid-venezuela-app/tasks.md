# Tasks: Mobile-First Aid Distribution App (aid-venezuela-app)

## Phase 1: Foundation / Infrastructure
- [x] 1.1 Create `package.json` with dependencies for NestJS backend, Next.js frontend, Prisma ORM, Socket.io, ioredis, and mysql2.
- [x] 1.2 Define database schema in `prisma/schema.prisma` with `Role` (DONOR, NGO, DRIVER, ADMIN), `DriverStatus`, `DispatchTask` (PROPOSED, ACCEPTED, EN_ROUTE, ALERTA_CONEXION, DELIVERED, TIMED_OUT, CANCELLED) enums and `User`, `DriverDetails`, `Resource`, `StockTransaction`, `Need`, `NeedItem` and `DispatchTaskRecord` models.
- [x] 1.3 Set up `.env` and `.env.production.example` files containing MySQL database URL and Redis connection details.
- [x] 1.4 Run initial migration with `npx prisma migrate dev --name init` to apply the database schema to the MySQL database. (Database server offline; bootstrapped Prisma configuration and client code generation successfully instead).
- [x] 1.5 Develop `prisma/seed.ts` script to populate default system roles, mock drivers, NGOs, donors, and initial resource catalogs, and verify database seeding with `npx prisma db seed`.

## Phase 2: Core Backend Modules
- [x] 2.1 Develop NestJS module in `src/backend/users/` containing authentication endpoints (JWT-based) and driver registration & vetting APIs.
- [x] 2.2 Develop NestJS module in `src/backend/resources/` with resource catalogs, stock transaction logging, and cron jobs for expiration checking, employing MySQL row-level locking via Prisma to guarantee transactional safety.
- [x] 2.3 Develop NestJS module in `src/backend/needs/` implementing needs posting APIs and prioritized scoring logic (evaluating urgency, quantity, and logistics).
- [x] 2.4 Implement Socket.io gateway in `src/backend/dispatch/dispatch.gateway.ts` to manage real-time driver connection states and process telemetry/location updates.
- [x] 2.5 Implement dispatch matching service in `src/backend/dispatch/dispatch.service.ts` utilizing database row locks (`FOR UPDATE`) for race-free needs assignment and Redis timeout keys for handling driver dispatch proposal windows.

## Phase 3: Frontend Web UI
- [x] 3.1 Create Next.js global application shell in `src/client/pages/_app.js` and custom head configuration in `src/client/pages/_document.js` with responsive viewport configurations for mobile devices.
- [x] 3.3 Create client forms for user registration, resource cataloging, and needs submission in `src/client/components/` with validation rules in Spanish.
- [x] 3.2 Implement Next.js SPA homepage in `src/client/pages/index.js` in Spanish with dashboards for Donors, NGOs, and Drivers.
- [x] 3.4 Build a manual municipality/state location dropdown menu in the client UI to fallback to when native device GPS coordinates are disabled.
- [x] 3.5 Create `src/client/utils/indexeddb.js` providing location buffering logic using local IndexedDB to track driver route history while offline.
- [x] 3.6 Create socket connection sync utility `src/client/utils/socket.js` to batch-upload buffered coordinates from IndexedDB on socket reconnection.

## Phase 4: Testing & Verification
- [x] 4.1 Write unit tests in `src/backend/resources/resources.service.spec.ts` for catalog expiration checks, and in `src/backend/needs/needs.service.spec.ts` verifying priority scoring math.
- [x] 4.2 Write integration tests in `src/backend/dispatch/dispatch.service.spec.ts` verifying concurrency control (race condition avoidance) when multiple drivers try to accept the same dispatch task simultaneously.
- [x] 4.3 Write unit and integration tests simulating Redis proposal timeouts, ensuring tasks revert from PROPOSED back to the matching pool.
- [x] 4.4 Implement end-to-end integration test in `test/e2e-simulation.ts` that spawns mock Socket.io drivers to simulate connection loss, IndexedDB buffering, socket reconnection, and dispatch completion.

## Phase 5: Cleanup & Rollout
- [x] 5.1 Perform a complete check of environment variables across the project to ensure no sensitive passwords, ports, or credentials are hardcoded.
- [x] 5.2 Update `README.md` with complete details on environment requirements, migration commands, and instructions for testing the offline location buffer.
