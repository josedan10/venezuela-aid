# Needs (Necesidades) Specification

## Purpose
Governs request creation by NGOs/Beneficiaries, automated priority scoring, and mobile-first mapping representation.

## Requirements

### Requirement: Need Creation and Prioritization
- Verified NGOs or beneficiaries MUST be able to post assistance requests containing resource categories, quantities needed, and location.
- The system MUST automatically calculate a priority score (Prioridad) between 1 and 100, incorporating the self-declared urgency (`Bajo`, `Medio`, `Crítico`), availability of the resource category, and elapsed waiting time.
- Requests with a computed score of 80 or higher MUST be flagged as `Alta Prioridad` and highlighted visually in Spanish ("ATENCIÓN INMEDIATA").

#### Scenario: Posting a Critical Urgency Need
- **GIVEN** a verified NGO is logged into the mobile-first app
- **WHEN** they post a need for "Insulina" (quantity: 50, urgency: `Crítico`, location: "Hospital J.M. de los Ríos")
- **THEN** the system MUST compute a priority score of 95
- **AND** save the need with status `Abierta` and priority level `Alta Prioridad`
- **AND** display the message: "Solicitud registrada con prioridad crítica."

### Requirement: Mobile-first Mapping and Graceful Degradation
- The application MUST render active needs sorted descending by priority score.
- The user interface MUST display needs geographically on an interactive map.
- If geolocation or reverse geocoding lookups fail, the system MUST degrade gracefully by allowing the user to select their location manually (State and Sector) from a preloaded localized list.

#### Scenario: Graceful Fallback for Geolocation Failures
- **GIVEN** an NGO user is creating a need request on a device with disabled location services
- **WHEN** the browser/application fails to acquire the GPS coordinates
- **THEN** the system MUST display the dialog: "No pudimos obtener su ubicación. Por favor, seleccione su estado y sector manualmente."
- **AND** present dropdown lists for `Estado` and `Sector`
- **WHEN** the user selects "Distrito Capital" and "Catia" respectively and submits
- **THEN** the system MUST record the need request tied to those coordinates/bounds.
