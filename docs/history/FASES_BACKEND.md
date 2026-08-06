# Fases de Implementación del Backend (MVP SaaS Multiempresa)

Este documento resume las 8 fases de desarrollo del backend definidas en la arquitectura técnica, garantizando el aislamiento de datos (multi-tenant), la seguridad y la trazabilidad.

## Fase 1: Base técnica e Infraestructura
**Objetivo:** Establecer los cimientos del proyecto.
- Configuración de Node.js + TypeScript.
- Variables de entorno validadas (Zod).
- Conexión a la base de datos (Prisma ORM).
- Logger estructurado (Pino) y trazabilidad de peticiones (Request ID).
- Manejo global de errores (Error Handler) y clases de error personalizadas (`AppError`, `NotFoundError`, etc.).
- Estructura modular (`src/common`, `src/modules`, `src/infrastructure`).

## Fase 2: Entidades y Repositorios
**Objetivo:** Modelar la base de datos y la capa de acceso a datos.
- **Modelos Prisma:** `Company` (empresas), `User` (usuarios), `Session` (sesiones), `PasswordResetToken` (recuperación de contraseñas) y `AuditLog` (auditoría).
- Definición de enums para estados (`ACTIVE`, `SUSPENDED`, `DELETED`, `LOCKED`) y roles (`SUPER_ADMIN`, `COMPANY_ADMIN`, `COMPANY_USER`).
- Creación de las clases Repository base para abstraer las consultas a la base de datos.

## Fase 3: Autenticación y Sesiones
**Objetivo:** Sistema de login seguro y gestión de sesiones persistidas.
- **Middlewares:** `requireAuth` (validación JWT y estado de DB), `requireRole` (control de acceso), y `authRateLimiter` (protección contra fuerza bruta).
- **Endpoints:**
  - `POST /login`: Valida credenciales, crea sesión en DB, devuelve Access Token (corto) y Refresh Token (largo).
  - `POST /logout`: Revoca la sesión actual.
  - `POST /refresh`: Rota el refresh token si la sesión es válida.
  - `GET /me` y `GET/PATCH /profile`: Gestión del perfil propio.

## Fase 4: Companies (SuperAdmin)
**Objetivo:** Gestión de los "tenants" (empresas clientes) por parte del dueño del SaaS.
- **Transaccionalidad:** Endpoint para crear una empresa y su administrador inicial de forma atómica (`POST /companies`).
- **CRUD:** Listado paginado, detalle y edición de datos permitidos.
- **Estados:** Endpoints para suspender, reactivar y eliminar lógicamente una empresa.
- **Efectos secundarios:** Suspender o eliminar una empresa revoca automáticamente todas las sesiones de sus usuarios.

## Fase 5: Users (Globales y de Tenant)
**Objetivo:** Gestión de usuarios respetando el aislamiento multi-tenant.
- **SuperAdmin:** Endpoints para listar, ver, suspender, reactivar y eliminar cualquier usuario del sistema.
- **Company Admin:** Endpoints para gestionar *solo* a los usuarios de su propia empresa (validación estricta de `company_id`).
- **Reglas de negocio:** Protección para no eliminar o suspender al último administrador activo de una empresa.

## Fase 6: Recuperación de Contraseñas
**Objetivo:** Flujo seguro para contraseñas olvidadas.
- `POST /forgot-password`: Genera un token de un solo uso con caducidad corta y envía el email.
- `POST /reset-password`: Valida el token, actualiza el hash de la contraseña e invalida todas las sesiones activas del usuario por seguridad.

## Fase 7: Auditoría (Audit Logs)
**Objetivo:** Trazabilidad completa de acciones críticas.
- Registro automático en base de datos de eventos como: logins (éxito/fallo), creación/edición/suspensión de empresas y usuarios, revocación de sesiones, etc.
- **Endpoints de consulta:**
  - SuperAdmin: Puede ver los logs globales filtrando por empresa, actor, acción, etc.
  - Company Admin: Puede ver *solo* los logs generados dentro de su empresa.

## Fase 8: Hardening y Seguridad Final
**Objetivo:** Asegurar el sistema contra vulnerabilidades y abusos.
- Tests anti-IDOR (asegurar que un tenant no puede acceder a datos de otro).
- Protección contra escalada de privilegios (ej. evitar que un usuario se asigne el rol `SUPER_ADMIN` al actualizar su perfil).
- Jobs en segundo plano (opcionales) para limpiar tokens expirados y sesiones antiguas de la base de datos.
- Revisión final de índices en base de datos para rendimiento.
