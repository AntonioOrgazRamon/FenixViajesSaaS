# Documentación del Sistema Backend SaaS

## Arquitectura y Tecnologías
El backend está construido con una arquitectura en capas (Controladores, Servicios, Repositorios) para asegurar la separación de responsabilidades y facilitar el mantenimiento.

**Stack Tecnológico:**
- **Node.js + Express:** Framework web.
- **TypeScript:** Tipado estático.
- **Prisma ORM:** Acceso a la base de datos **MySQL** (esquema preparado para migrar a PostgreSQL; ver `SETUP_DB.md` y comentarios en `prisma/schema.prisma`).
- **Zod:** Validación de esquemas y datos de entrada.
- **Pino:** Logging estructurado.
- **JWT:** Autenticación y manejo de sesiones.

---

## Módulos del Sistema

### 1. Módulo de Autenticación (`/api/v1/auth`)
Maneja el ciclo de vida de la sesión del usuario y la seguridad de acceso.
- **Endpoints:**
  - `POST /api/v1/auth/login`: Autentica a un usuario y devuelve tokens de acceso y refresco.
  - `POST /api/v1/auth/logout`: Revoca la sesión actual del usuario. (Requiere Autenticación)
  - `POST /api/v1/auth/refresh`: Renueva el token de acceso utilizando un token de refresco válido.
  - `GET /api/v1/auth/me`: Obtiene los datos del usuario autenticado. (Requiere Autenticación)
  - `GET /api/v1/auth/profile`: Obtiene el perfil completo del usuario. (Requiere Autenticación)
  - `PATCH /api/v1/auth/profile`: Actualiza el perfil del usuario. (Requiere Autenticación)
  - `POST /api/v1/auth/forgot-password`: Solicita un enlace de recuperación de contraseña.
  - `POST /api/v1/auth/verify-reset-token`: Verifica la validez de un token de recuperación.
  - `POST /api/v1/auth/reset-password`: Establece una nueva contraseña validando el token.

### 2. Módulo de Compañías (`/api/v1/superadmin/companies`)
Gestión de los inquilinos (tenants) del sistema SaaS. Restringido a usuarios con rol `SUPER_ADMIN`.
- **Endpoints:**
  - `POST /api/v1/superadmin/companies`: Crea una nueva compañía.
  - `GET /api/v1/superadmin/companies`: Lista todas las compañías.
  - `GET /api/v1/superadmin/companies/:id`: Obtiene los detalles de una compañía específica.
  - `PATCH /api/v1/superadmin/companies/:id`: Actualiza los datos de una compañía.
  - `POST /api/v1/superadmin/companies/:id/suspend`: Suspende temporalmente el acceso a una compañía y sus usuarios.
  - `POST /api/v1/superadmin/companies/:id/reactivate`: Reactiva una compañía suspendida.
  - `DELETE /api/v1/superadmin/companies/:id`: Elimina (borrado lógico) una compañía.

### 3. Módulo de Usuarios (`/api/v1/users`)
Gestión de los usuarios del sistema, con control de acceso basado en roles (RBAC). 
- **Reglas de Acceso:** `SUPER_ADMIN` (acceso global) y `COMPANY_ADMIN` (acceso limitado a su compañía).
- **Endpoints:**
  - `GET /api/v1/users`: Lista los usuarios (filtrados por compañía si es `COMPANY_ADMIN`).
  - `GET /api/v1/users/:id`: Obtiene los detalles de un usuario específico.
  - `POST /api/v1/users`: Crea / Invita a un nuevo usuario.
  - `PATCH /api/v1/users/:id`: Actualiza los datos o el rol de un usuario.
  - `DELETE /api/v1/users/:id`: Elimina (borrado lógico) a un usuario.

### 4. Módulo de Sesiones (`/api/v1/sessions`)
Permite a los usuarios y administradores auditar y controlar las sesiones activas.
- **Endpoints:**
  - `GET /api/v1/sessions`: Lista todas las sesiones activas del usuario autenticado (incluyendo metadatos como IP y User-Agent).
  - `POST /api/v1/sessions/:id/revoke`: Revoca una sesión específica (ej. cerrar sesión en un dispositivo perdido).

### 5. Módulo de Auditoría (`/api/v1/audit-logs`)
Registro inmutable de acciones críticas en el sistema para cumplimiento y trazabilidad.
- **Reglas de Acceso:** `SUPER_ADMIN` (acceso global) y `COMPANY_ADMIN` (acceso limitado a su compañía).
- **Endpoints:**
  - `GET /api/v1/audit-logs`: Lista y filtra los logs de auditoría (por fecha, actor, acción, etc.).

---

## Seguridad y Middlewares
- **Helmet:** Protege la aplicación configurando cabeceras HTTP de seguridad.
- **CORS:** Controla los dominios permitidos para interactuar con la API.
- **Rate Limiting:** Previene ataques de fuerza bruta y denegación de servicio (DoS) limitando el número de peticiones por IP, especialmente en endpoints sensibles como el login.
- **Autenticación y Autorización:** Middlewares `requireAuth` (verifica JWT) y `requireRole` (verifica los permisos del usuario).
- **Request ID:** Asigna un identificador único a cada petición para facilitar la trazabilidad en los logs.
- **Manejo de Errores Global:** Captura excepciones asíncronas y síncronas, devolviendo respuestas estandarizadas y evitando la exposición de detalles internos del servidor.

## Base de Datos (Prisma Schema)
El esquema define las siguientes entidades principales:
- `Company`: Inquilinos del sistema.
- `User`: Usuarios asociados a una compañía (o administradores globales).
- `Session`: Registro de sesiones activas para control de dispositivos.
- `PasswordResetToken`: Tokens temporales para recuperación de credenciales.
- `AuditLog`: Registro histórico de eventos del sistema.

Todas las entidades incluyen marcas de tiempo (`createdAt`, `updatedAt`) y soporte para borrado lógico (`deletedAt`, `status`) donde es aplicable.