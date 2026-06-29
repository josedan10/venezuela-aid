# Proposal: Aid Venezuela Resource Coordination Platform (aid-venezuela-app)

## Intent

The goal is to establish a secure, resilient resource coordination platform in Venezuela to manage and allocate scarce resources (food, medicine, equipment) efficiently under challenging local conditions. The platform aims to connect validated resource donors/storage points with vetted transporters (similar to Rappi drivers) and beneficiaries. Trust, validation, and connectivity resilience are core pillars of this initiative, preventing resource misallocation and remaining functional during frequent local internet dropouts.

## Scope

### In Scope
- **Resource Cataloging**: A secure web system for cataloging available resources, status, and physical locations.
- **Need Mapping**: Interactive and tabular views mapping regional aid requirements and priorities.
- **Collaborator Registration & Vetting**: Multi-tier registration for administrative staff, storage providers, local validators, and transport drivers.
- **Task Dispatching**: A lightweight Rappi-like dispatch workflow to route delivery tasks to registered drivers, tracking dispatch, acceptance, transit, and delivery confirmation.
- **Real-Time Updates**: WebSockets integration for live status maps and dispatch matching, gracefully degrading to polling.

### Out of Scope
- **Native Mobile Apps**: Custom iOS or Android applications; instead, we prioritize a fully responsive web application.
- **Financial Transaction System**: Direct monetary payments or cash donations are excluded from this phase.
- **Global Cold-Chain Logistics**: Cold-chain monitoring and advanced multi-modal shipping logistics are deferred to a later iteration.

## Approach

The system will be built as a monolithic MVC application utilizing:
- **Core Stack**: NestJS for backend API/routing, Next.js for responsive frontend, and Node.js runtime.
- **Database Layer**: MySQL as the primary relational database to ensure transactional integrity (using pessimistic row locking to prevent double allocation of scarce resources).
- **Caching & Real-Time**: Redis for session storage, query caching, and WebSocket pub/sub management.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/` | New | Root source directory for application logic |
| `src/server/` | New | NestJS backend modules, controllers, database client, WebSocket handlers |
| `src/client/` | New | Next.js frontend pages, dashboard components, and responsive views |
| `prisma/` or `db/` | New | Relational database schemas and migration scripts |
| `package.json` | Modified | Add required dependencies (Next, Express, MySQL client, Redis, Socket.io) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Volatile connectivity & bandwidth dropouts | High | Implement optimistic UI states and local storage caching for core task workflows. |
| Double allocation of scarce resources | Medium | Use strict database transactions with pessimistic row locking (`SELECT ... FOR UPDATE`) in MySQL to ensure atomicity. |
| Vetting of collaborators & trust validation | High | Enforce a multi-step admin vetting process for drivers/collaborators, and require local validator approval/proof (e.g., photo upload) before resources/needs are posted. |

## Rollback Plan

- **Database Schemas**: Provide comprehensive SQL down-migrations/scripts for every database schema change to easily revert schema updates.
- **Feature Flags**: Manage newly added sub-systems (e.g., Live Map) using environment variables (e.g., `ENABLE_LIVE_WEBSOCKETS`), enabling quick runtime deactivation.
- **Code Rollback**: Rely on git tag/version resets to revert codebase deployments to the previous stable state.

## Dependencies

- **MySQL Database**: High-availability database service or hosted instance.
- **Redis Server**: Instance for caching and WebSocket state coordination.
- **Node.js Environment**: Node.js v18 or later.

## Success Criteria

- [ ] **Fulfillment Time**: Average transport request fulfillment time (from dispatch to delivery) is under 4 hours.
- [ ] **Vetting Completion**: Vetted driver registration process achieves a completion rate of > 70%.
- [ ] **Allocation Integrity**: Zero database-level double-allocations during concurrent stress-testing.
