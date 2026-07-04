# Team Settings API Reference

This document describes the team management and driver approval contract for the frontend.

## Purpose

Teams are used for:

- internal communication and location sharing
- prioritizing team deliveries first
- approving which drivers can handle team deliveries
- controlling whether the team accepts only members or approved external drivers

## Team roles

### `MANAGER`

Can:

- update team settings
- approve or reject driver access
- view pending driver requests

### `COLLABORATOR`

Can:

- join the team
- leave the team
- toggle location sharing
- request driver access if they are a driver

## Delivery policies

### `TEAM_ONLY`

Only team members with approved driver access can receive dispatch proposals.

### `TEAM_AND_APPROVED_EXTERNAL`

Team members with approved driver access and approved external drivers can receive dispatch proposals.

## HTTP Endpoints

### `GET /teams/my-team`

Returns the current team, members, and location-sharing state.

This is the main endpoint for the team dashboard.

#### Frontend usage

- Use this endpoint to render the team overview.

---

### `GET /teams/my-team/settings`

Returns the current team settings payload, including delivery policy and driver access requests.

Use this endpoint when the UI needs a dedicated settings screen.

#### Frontend usage

- Use this endpoint to render manager-only settings controls.
- Use the `team.deliveryPolicy` field to show the active delivery rule.
- Use `team.driverAccessRequests` to render pending approval cards.

---

### `PATCH /teams/my-team/settings`

Updates team settings.

#### Request body

```json
{
  "name": "Equipo Norte",
  "description": "Coordinación de entrega",
  "deliveryPolicy": "TEAM_ONLY"
}
```

#### Rules

- At least one field must be provided.
- Only the team manager or creator can call this endpoint.

#### Frontend usage

- Use this on the team settings form.
- If the team wants strict internal-only delivery, set `deliveryPolicy` to `TEAM_ONLY`.
- If the team wants approved external help, set `deliveryPolicy` to `TEAM_AND_APPROVED_EXTERNAL`.

---

### `POST /teams/driver-access/request`

Creates or refreshes a driver access request for a team.

#### Request body

```json
{
  "teamId": "uuid"
}
```

#### Rules

- The requesting user must have the `DRIVER` role.
- If `teamId` is omitted, the backend uses the user’s current team.

#### Frontend usage

- Use this from the driver screen when a driver wants to help the team.
- Show the request as `PENDING` until a manager reviews it.

---

### `GET /teams/my-team/driver-access/pending`

Lists pending driver access requests for the current team.

#### Frontend usage

- Use this for the manager review queue.
- Render the driver name, current roles, and request state.

---

### `POST /teams/my-team/driver-access/:driverId/approve`

Approves a driver for the current team.

#### Frontend usage

- Show this as an approve action in the manager dashboard.
- After approval, the dispatch engine may prioritize that driver according to the team policy.

---

### `POST /teams/my-team/driver-access/:driverId/reject`

Rejects a driver for the current team.

#### Frontend usage

- Show this as a reject action in the manager dashboard.
- Rejected drivers should not receive team dispatch proposals unless they are approved later.

## Dispatch behavior tied to team settings

When a need is created by a user that belongs to a team:

1. The dispatch engine checks the creator’s team.
2. Team members with approved driver access are preferred first.
3. If policy allows external help, approved external drivers are eligible.
4. If no eligible driver exists, the backend returns a no-driver-found response.

## Suggested frontend screens

- Team overview
- Team settings
- Driver access review queue
- Driver access request form
- Delivery policy selector
