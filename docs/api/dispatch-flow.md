# Dispatch Flow API Reference

This document describes the backend contract the frontend should use to implement the delivery matching flow.

## Overview

The flow starts when a need is created and matched against available resources.

Backend responsibilities:
1. Create the need.
2. Match resources to the need.
3. Automatically generate a dispatch proposal when at least one item is matched.
4. Send the proposal to the closest verified and available driver.
5. Accept, reject, timeout, reconnect, and finalize delivery.

### Team-aware dispatch selection

If the need creator belongs to a team:

- the backend prefers approved drivers from that team first
- the team delivery policy decides whether approved external drivers are allowed
- the frontend should use the team settings screen to control those rules

## HTTP Endpoints

### `POST /needs`

Creates a new need and attempts automatic resource matching.

#### Request body

```json
{
  "ngoId": "uuid",
  "description": "string",
  "urgencyRating": 1,
  "state": "Distrito Capital",
  "sector": "Catia",
  "latitude": 10.5,
  "longitude": -66.9,
  "collectionCenterId": "uuid",
  "items": [
    {
      "itemId": "uuid",
      "quantity": 10
    }
  ]
}
```

#### Response fields relevant to the frontend

```json
{
  "message": "Solicitud registrada exitosamente.",
  "need": {},
  "matching": {
    "needId": "uuid",
    "matched": 1,
    "total": 2,
    "origin": {
      "latitude": 10.5,
      "longitude": -66.9,
      "label": "Distrito Capital - Catia"
    }
  },
  "dispatch": {
    "success": true,
    "message": "Despacho aceptado con éxito y recursos reservados.",
    "task": {}
  }
}
```

#### Frontend guidance

- If `matching.matched > 0`, the backend already attempted dispatch creation.
- If `dispatch.success === false`, show a non-blocking warning and keep the need visible in the queue.
- The frontend does not need to call `/dispatch/propose` for the standard flow after creating a need.

---

### `POST /dispatch/propose`

Manually creates a dispatch proposal for a need.

#### Request body

```json
{
  "needId": "uuid"
}
```

#### Response

```json
{
  "success": true,
  "message": "Propuesta de despacho enviada al conductor más cercano al punto de origen.",
  "task": {}
}
```

#### Frontend guidance

- This is the manual fallback path.
- Prefer `POST /needs` for the normal flow.

---

### `POST /dispatch/accept`

Driver accepts a dispatch proposal.

#### Request body

```json
{
  "driverId": "uuid",
  "taskId": "uuid"
}
```

#### Expected behavior

- Task transitions to `ACCEPTED`.
- Driver becomes unavailable.
- Matched stock is reserved/deducted in the backend transaction.

#### Common error

```json
{
  "message": "Este despacho ya ha sido asignado a otro conductor."
}
```

---

### `POST /dispatch/reject`

Driver rejects a dispatch proposal.

#### Request body

```json
{
  "driverId": "uuid",
  "taskId": "uuid"
}
```

#### Expected behavior

- Task transitions to `CANCELLED`.
- Driver becomes available again.
- Backend retries with the next nearest available driver.

---

### `POST /dispatch/confirm`

Finalizes the delivery.

#### Request body

```json
{
  "driverId": "uuid",
  "taskId": "uuid",
  "signatureUrl": "https://...",
  "photoUrl": "https://..."
}
```

#### Rules

- At least one proof is required: `signatureUrl` or `photoUrl`.
- Task transitions to `DELIVERED`.
- Need transitions to `FULFILLED`.

#### Success response

```json
{
  "message": "Su entrega ha sido completada con éxito.",
  "task": {}
}
```

## Socket.io Events

### Server → Driver: `dispatch_proposal`

Sent when a driver is selected for a proposal.

```json
{
  "taskId": "uuid",
  "description": "string",
  "timeoutSeconds": 60,
  "origin": {
    "latitude": 10.5,
    "longitude": -66.9,
    "label": "Centro de Acopio"
  },
  "destination": {
    "latitude": 10.6,
    "longitude": -66.8,
    "label": "Distrito Capital - Catia"
  },
  "matchedItems": [
    {
      "requested": "Harina",
      "offer": "Harina de Maíz",
      "quantity": 10,
      "pickupLabel": "Centro de Acopio",
      "pickupDistanceKm": 2.4
    }
  ],
  "driverRadiusKm": 15
}
```

### Client → Server: `location_update`

Single GPS coordinate update.

```json
{
  "latitude": 10.5,
  "longitude": -66.9
}
```

### Client → Server: `location_batch`

Offline-buffered coordinate synchronization.

```json
{
  "coordinates": [
    {
      "latitude": 10.5,
      "longitude": -66.9,
      "timestamp": "2026-07-03T12:00:00.000Z"
    }
  ]
}
```

### Server → Client: `location_received`

Acknowledge a single coordinate update.

### Server → Client: `batch_received`

Acknowledge an offline batch sync.

### Server → Operators: `operator_alert`

Emitted when the backend detects more than 5 minutes without driver location updates.

```json
{
  "driverId": "uuid",
  "taskId": "uuid",
  "message": "El conductor ha perdido la señal hace más de 5 minutos."
}
```

## Suggested frontend state handling

### Need creation screen

- Submit `POST /needs`.
- If `matching.matched > 0`, render a “dispatch created” state.
- If `dispatch` exists, show the current task status.

### Driver proposal screen

- Listen for `dispatch_proposal`.
- Start a 60-second countdown.
- Enable accept/reject actions.
- If the timer expires, treat the proposal as stale.

### Transit screen

- Send `location_update` while connected.
- Buffer coordinates locally when offline.
- On reconnect, send `location_batch` first, then resume live tracking.

### Delivery confirmation screen

- Require either a signature or a photo.
- Submit `POST /dispatch/confirm`.

## Backend status values

### Need

- `PENDING`
- `ALLOCATED`
- `FULFILLED`
- `CANCELLED`

### Dispatch task

- `PROPOSED`
- `ACCEPTED`
- `EN_ROUTE`
- `ALERTA_CONEXION`
- `DELIVERED`
- `TIMED_OUT`
- `CANCELLED`
