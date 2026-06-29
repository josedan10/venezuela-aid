# Users (Usuarios) Specification

## Purpose
Governs user registration, administrative vetting, and driver online/offline availability state.

## Requirements

### Requirement: User Registration
- The system MUST allow registration under three separate roles: `Donante` (Donor), `ONG/Beneficiario` (NGO/Beneficiary), and `Conductor` (Driver/Transporter).
- For `Conductor` registration, the driver MUST provide a full name, national ID (Cédula de Identidad), vehicle description, license plate number (Placa), and upload a valid driver's license (Licencia de Conducir).
- For `ONG/Beneficiario` and `Donante` registrations, the organization MUST supply their legal tax registry number (RIF) and legal name.
- Any validation errors triggered during the registration process MUST be displayed to the user in Spanish.

#### Scenario: Successful Driver Registration
- **GIVEN** a driver is on the registration screen of the mobile application
- **WHEN** they enter all required details (name, Cédula, vehicle description, plate number, and driver's license file) and submit the form
- **THEN** the system SHALL create the account with status `Pendiente de Verificación`
- **AND** the system MUST display the message: "Registro completado. Su cuenta está en revisión."

#### Scenario: Driver Registration Fails Due to Missing Driver's License
- **GIVEN** a driver is on the registration screen of the mobile application
- **WHEN** they submit the form without uploading their driver's license
- **THEN** the system MUST reject the request
- **AND** the system MUST display the validation message: "La licencia de conducir es obligatoria para registrarse como conductor."

### Requirement: Administrative Vetting & Account Verification
- A newly registered user MUST NOT perform any active operations (e.g. cataloging resources, requesting needs, accepting tasks) until they are vetted.
- An administrator MUST review the documentation and transition the user's state to `Verificado` before active use is permitted.

#### Scenario: Admin Approves a Driver Registration
- **GIVEN** a driver account exists in a `Pendiente de Verificación` state
- **AND** an administrator is logged into the management portal
- **WHEN** the administrator reviews the uploaded driver's license and clicks "Aprobar"
- **THEN** the system MUST transition the driver's status to `Verificado`
- **AND** the system MUST send a push notification/email in Spanish: "Su cuenta ha sido verificada. Ya puede iniciar sesión y realizar servicios."

### Requirement: Driver Online/Offline State
- A verified driver MUST be able to toggle their active state between online (`Disponible`) and offline (`No Disponible`).
- The backend MUST persist this active state in a Redis cache to optimize real-time route query execution.
- Drivers who are `No Disponible` MUST NOT receive dispatch offers.

#### Scenario: Driver Goes Online Successfully
- **GIVEN** a verified driver is logged into the mobile application and is currently offline (`No Disponible`)
- **WHEN** the driver clicks the toggle to connect
- **THEN** the system MUST update their status in Redis to `Disponible`
- **AND** the system MUST display the status message: "Estado: Disponible para despachos"
