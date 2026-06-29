# Resources (Recursos) Specification

## Purpose
Cataloging available items (medicines, food, blood donors, helpers, machines, rescue teams) and tracking current stock levels.

## Requirements

### Requirement: Resource Cataloging & Expiration Check
- The system MUST allow verified donors to register and catalog resources under predefined categories: `Medicamentos`, `Alimentos`, `Donantes de Sangre`, `Ayudantes/Voluntarios`, `Maquinaria`, and `Equipos de Rescate`.
- For resources under the categories `Medicamentos` and `Alimentos`, the donor MUST specify an expiration date (Fecha de Vencimiento).
- The system MUST NOT accept registrations for resources where the expiration date is in the past.

#### Scenario: Cataloging a New Batch of Food
- **GIVEN** a verified donor is logged into the dashboard
- **WHEN** they catalog a resource under category `Alimentos` with description "Harina de Maíz", quantity "200 kg", and an expiration date set to a future date
- **THEN** the system MUST store the resource with status `Disponible`
- **AND** show the confirmation message: "Recurso registrado exitosamente."

#### Scenario: Cataloging Expired Medicine Fails
- **GIVEN** a verified donor is logged into the dashboard
- **WHEN** they catalog a resource under category `Medicamentos` with an expiration date set to a date in the past
- **THEN** the system MUST reject the record
- **AND** return the error: "No se pueden registrar recursos con fecha de vencimiento pasada."

### Requirement: Real-time Stock Tracking
- The system MUST track stock quantities in the MySQL database via the Prisma ORM.
- When resources are assigned to a dispatch task, the system MUST lock the matched quantity, transitioning its status to `Reservado`.
- Upon successful dispatch confirmation, the system MUST permanently deduct the quantities from the active inventory.

#### Scenario: Reserving Stock for Dispatch Task
- **GIVEN** an active resource batch "Suero Fisiológico" exists with a total stock of 100 units
- **WHEN** a dispatch task is generated requiring 30 units of "Suero Fisiológico"
- **THEN** the system MUST transition 30 units to `Reservado`
- **AND** subsequent queries MUST show the available stock as 70 units
- **AND** prevent any other need from claiming those 30 reserved units.
