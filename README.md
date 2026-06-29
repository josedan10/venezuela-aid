# Plataforma de Coordinación de Ayuda Humanitaria (aid-venezuela-app)

Este proyecto es una plataforma móvil-primero (mobile-first) y en español para optimizar la distribución de recursos escasos (medicamentos, alimentos, donantes de sangre, voluntarios, maquinaria y equipos de rescate) en Venezuela.

La plataforma está diseñada para ser altamente resiliente ante conexiones inestables (3G/4G) y apagones de internet, utilizando un sistema de sincronización local.

---

## Características Principales

1. **Catálogo de Recursos**: Registro de recursos disponibles (donantes, medicamentos, alimentos) con control de fechas de vencimiento.
2. **Priorización de Necesidades**: Algoritmo que calcula automáticamente la urgencia (Prioridad de 1 a 100). Solicitudes con puntuación ≥ 80 se marcan como **"ATENCIÓN INMEDIATA"**.
3. **Despacho y Asignación**: Flujo de asignación estilo Rappi que propone entregas al conductor verificado más cercano con un temporizador de aceptación de 60 segundos.
4. **Resiliencia de Conexión (GPS Offline)**:
   - Registra coordenadas GPS cada 15 segundos en tránsito.
   - Si se pierde la señal, almacena cronológicamente los puntos en **IndexedDB** localmente.
   - En la reconexión del Socket, sube el lote de coordenadas en buffer automáticamente.
   - Alerta a los operadores si el conductor pierde señal por más de 5 minutos (**"Alerta de Conexión"**).
5. **Autenticación Segura**: Integración con **Firebase Authentication** en el frontend (Next.js) y backend (NestJS) a través de validación de tokens de identidad Bearer.

---

## Tecnologías Utilizadas

- **Backend**: [NestJS](https://nestjs.com/) (Node.js framework), TypeScript.
- **Frontend**: [Next.js](https://nextjs.org/) (React), Vanilla CSS (optimizado para móviles, micro-animaciones HSL).
- **Base de Datos Persistente**: MySQL (a través de [Prisma ORM](https://www.prisma.io/)).
- **Caché y Telemetría**: Redis (conexiones Socket.io, almacenamiento de geolocalización de conductores activos mediante `GEOADD` y `GEORADIUS`).
- **Autenticación**: Firebase Admin SDK (servidor) y Firebase Client SDK (cliente).

---

## Instalación y Configuración

### 1. Requisitos Previos
- Node.js v18 o superior.
- Servidor MySQL.
- Servidor Redis.

### 2. Instalación de Dependencias
Ejecute el siguiente comando en la raíz del proyecto para instalar todas las dependencias del monorepo:
```bash
npm install
```

### 3. Configuración del Entorno
Duplique el archivo `.env.production.example` y configure sus variables en un archivo local `.env`:
```bash
cp .env.production.example .env
```
Asegúrese de configurar las siguientes claves de Firebase, MySQL y Redis:
```env
DATABASE_URL="mysql://usuario:contraseña@localhost:3306/nombre_db"
REDIS_URL="redis://localhost:6379"

# Credenciales de Firebase Admin SDK (Servidor)
FIREBASE_PROJECT_ID="su-proyecto"
FIREBASE_CLIENT_EMAIL="su-cuenta-servicio@su-proyecto.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Claves de Firebase Client SDK (Frontend)
NEXT_PUBLIC_FIREBASE_API_KEY="su-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="su-proyecto.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="su-proyecto"
```

### 4. Base de Datos y Migraciones
Genere el cliente de Prisma y aplique las migraciones de base de datos a su MySQL:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Alimentar Datos de Prueba (Seed)
Ejecute el script de sembrado para registrar usuarios de prueba (Administradores, Donantes, ONGs, Conductores) y categorías iniciales:
```bash
npx prisma db seed
```

---

## Ejecución del Proyecto

### Desarrollo (Backend & Frontend en paralelo)

Para arrancar el backend de NestJS en modo observación (watch):
```bash
npm run start:backend:dev
```
El backend estará disponible en `http://localhost:5001`.

Para arrancar el frontend de Next.js en modo desarrollo:
```bash
npm run start:frontend:dev
```
El frontend móvil estará disponible en `http://localhost:3000`.

---

## Ejecución de Pruebas

Para correr las pruebas unitarias y las simulaciones de integración de Socket.io (incluyendo pruebas de concurrencia y reconexión offline):
```bash
npm test
```

---

## Funcionamiento del Buffer GPS Offline

1. Al iniciar un viaje, el cliente web inicia un bucle de tracking de ubicación.
2. Si la conexión de red falla (el socket se desconecta), la función `saveCoordinate` almacena los datos de geolocalización dentro del ObjectStore de **IndexedDB** bajo la base de datos `LocationBufferDB`.
3. Al restablecerse la señal, el socket de cliente detecta el evento `connect` y ejecuta `syncBufferedCoordinates()`. Este método lee los logs cronológicos, los sube en bloque mediante el evento `location_batch` al servidor NestJS, y limpia el almacenamiento local.

---

## Despliegue con Docker y Traefik (Producción)

El proyecto incluye soporte nativo para despliegue contenerizado y enrutamiento seguro automático a través de **Traefik** como proxy inverso con soporte automático de certificados HTTPS (Let's Encrypt).

### Archivos de Configuración Incluidos
- **`Dockerfile.api`**: Compila y expone el servidor NestJS en producción (`port 5001`).
- **`Dockerfile.ui`**: Genera la compilación optimizada de Next.js en modo `standalone` (`port 3000`).
- **`docker-compose.prod.yml`**: Orquesta Traefik, MySQL 8.0, Redis 7, el backend de API y el frontend de UI.

### Pasos para Desplegar

1. Defina las variables de producción en su archivo `.env` local.
2. Configure los dominios asignados para la API y la UI en su DNS apuntando a la dirección IP pública del servidor:
   ```env
   UI_DOMAIN=aidvenezuela.org
   API_DOMAIN=api.aidvenezuela.org
   LETSENCRYPT_EMAIL=su-email@ejemplo.com
   ```
3. Construya y levante los contenedores en segundo plano:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. Traefik detectará automáticamente los contenedores de la aplicación y configurará la redirección HTTPS de forma transparente.

