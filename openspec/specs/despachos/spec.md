# Dispatch (Despachos) Specification

## Purpose
Manages matched task lifecycle, driver assignment timeouts, location tracking with network drops, double-allocation prevention, and confirmation.

## Requirements

### Requirement: Task Generation and Matching
- When a resource is matched to a need, the system MUST generate a dispatch task (`Tarea de Despacho`) in a `Pendiente de Aceptación` state.
- The matching engine MUST select the closest verified driver whose status is `Disponible` in Redis.
- The system MUST send a push notification/WebSocket payload to the selected driver: "Nueva tarea de entrega disponible. ¿Acepta el despacho?".

#### Scenario: Dispatch Task Generation and Selection
- **GIVEN** a need for food is matched with a donor's cataloged food batch
- **WHEN** the matching engine triggers the coupling
- **THEN** the system MUST create a dispatch task
- **AND** retrieve the closest `Disponible` driver from the Redis database
- **AND** transmit a WebSocket invite to that driver's mobile client.

### Requirement: Driver Acceptance Timeout
- When a dispatch task is offered to a driver, the driver MUST accept or reject the task within 60 seconds (Acceptance Timeout).
- If the driver rejects or the 60-second limit is reached without action, the system MUST return the driver's state to `Disponible`, unlock the task, and offer it to the next nearest available driver.

#### Scenario: Driver Offer Times Out
- **GIVEN** a dispatch task is offered to Driver A
- **AND** the 60-second acceptance timer starts
- **WHEN** 60 seconds elapse without Driver A responding
- **THEN** the system MUST revoke the offer
- **AND** search for the next nearest available driver (Driver B) and transmit the offer to them.

### Requirement: Double Allocation Prevention
- The system MUST NOT allocate the same resource batch or the same dispatch task to multiple drivers concurrently.
- Database operations for task acquisition MUST use transactional locks to guarantee that once a driver is assigned, all other concurrent attempts fail with an error in Spanish.

#### Scenario: Simultaneous Acceptance Check
- **GIVEN** a dispatch task has been reassigned to Driver B due to Driver A's timeout
- **WHEN** Driver A sends a delayed acceptance request at the exact moment Driver B accepts
- **THEN** the system MUST authorize Driver B's acceptance
- **AND** reject Driver A's request with the error: "Este despacho ya ha sido asignado a otro conductor."

### Requirement: Route Tracking and Connection Loss Buffering
- While in active transit (`En Tránsito`), the mobile app MUST send the driver's GPS coordinates to the server every 15 seconds.
- If network connection drops, the mobile client MUST buffer the coordinates locally in IndexedDB/SQLite.
- Upon reconnection, the mobile client MUST send all buffered coordinates sequentially to the backend server.
- If the server receives no location updates for a driver in transit for more than 5 minutes, the system MUST transition the task status to `Alerta de Conexión` and notify operators in Spanish: "El conductor ha perdido la señal hace más de 5 minutos."

#### Scenario: Reconnection Sync of Buffered Coordinates
- **GIVEN** a driver is in active transit (`En Tránsito`) and loses cellular signal
- **WHEN** the mobile client fails to transmit GPS coordinates
- **THEN** the mobile client MUST store the coordinate points locally
- **WHEN** signal is restored and the client reconnects to the server
- **THEN** the mobile app MUST immediately send the buffered points chronological order
- **AND** the server MUST register them to complete the route log.

### Requirement: Final Delivery Confirmation
- To finalize a task and mark it as `Entregado`, the driver MUST submit proof of delivery.
- The proof of delivery MUST consist of either a digital signature (Firma Digital) signed by the recipient or a photo proof of delivery (Foto de Entrega).
- The uploaded proof image/data MUST be associated with the task in the database.

#### Scenario: Successful Delivery Confirmation via Photo Upload
- **GIVEN** a driver has reached the destination and the task is `En Tránsito`
- **WHEN** the driver uploads a photo of the recipient with the resources and clicks "Confirmar Entrega"
- **THEN** the system MUST transition the task status to `Entregado`
- **AND** permanently deduct the resources from the inventory
- **AND** notify the NGO and Donor: "Su entrega ha sido completada con éxito."
