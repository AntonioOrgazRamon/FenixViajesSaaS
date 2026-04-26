# Visión general del proyecto (MVP SaaS multiempresa)

Documento de referencia técnica-resumida del estado del repositorio `jejeje`: backend API, frontend SPA, datos y despliegue local.

---

## Arquitectura

- **Monorepo lógico**: `backend/` (API Node) y `frontend/` (SPA Vite) como aplicaciones independientes enlazadas por HTTP (`VITE_API_URL` → `http://localhost:3000/api/v1` por defecto).
- **Multi-tenant**: empresas (`Company`) con usuarios asociados; roles `SUPER_ADMIN`, `COMPANY_ADMIN`, `COMPANY_USER`.
- **Autenticación**: JWT de acceso + refresh en sesión almacenada en BD; cabecera `Authorization: Bearer <token>`.

---

## Backend (`backend/`)

| Área | Detalle |
|------|---------|
| **Runtime** | Node.js, Express 4, TypeScript (`ts-node-dev` en desarrollo). |
| **Datos** | Prisma ORM; motor **MySQL** (configurable; ver `prisma/schema.prisma` y `SETUP_DB.md`). UUIDs como `CHAR(36)` para portabilidad. |
| **Seguridad** | Helmet, CORS, rate limiting en rutas sensibles, bcrypt para hashes, validación con Zod en controladores. |
| **Módulos** | `auth` (login, refresh, perfil, cambio de contraseña, reset), `companies` (superadmin), `users`, `sessions`, `audit-logs`. |
| **Prefijo API** | `/api/v1` — p. ej. `POST /api/v1/auth/login`, `GET /api/v1/users`, `GET /api/v1/superadmin/companies`. |
| **Salud** | `GET http://localhost:3000/health` (fuera de `/api/v1`). |
| **Variables** | `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT` (ver `src/common/config`). |

Errores API normalizados: `{ success: false, error: { code, message } }`.

---

## Frontend (`frontend/`)

| Área | Detalle |
|------|---------|
| **Stack** | React 19, Vite 5, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), React Router 7. |
| **Estado servidor** | TanStack Query (listados, mutaciones, caché). |
| **Estado auth** | Zustand (`token` / `refreshToken` en `localStorage`, usuario en memoria). |
| **Formularios** | React Hook Form + Zod. |
| **HTTP** | Axios con interceptores (token; 401 → redirección a `/session-expired`). |
| **Marca / UX** | **NakedCode**: tipografía Syne / Plus Jakarta / JetBrains Mono; tema zinc oscuro con acentos ámbar. Layout `AppShell` (sidebar + drawer móvil), componentes `PageHeader` y `PanelCard` en dashboards y home. |
| **Login** | Página enriquecida con GSAP, `prefers-reduced-motion` y enlaces a `nakedcode.es`. |

### Rutas principales (resumen)

- **Públicas**: `/login`, `/forgot-password`, `/reset-password`.
- **Sistema**: `/403`, `/404`, `/session-expired`, `/tenant-suspended`, `/user-blocked`.
- **Autenticadas (layout común)**: `/profile`, `/change-password`, `/sessions`.
- **Super admin**: `/superadmin/dashboard`, `/superadmin/tenants` (+ detalle/edición), `/superadmin/users` (+ detalle/edición/sesiones), `/superadmin/audit-logs`.
- **Admin empresa**: `/app/dashboard`, `/app/users`, altas, auditoría, sesiones por usuario.
- **Usuario**: `/app/home`.

> En UI, “Empresas” / tenants consumen `GET/POST/PATCH .../superadmin/companies`.

---

## Cómo arrancar en local

1. **Base de datos**: seguir `backend/SETUP_DB.md` (MySQL local, Hostinger, etc.) y `DATABASE_URL` en `backend/.env`.
2. **Backend**: `cd backend && npm install && npm run dev` → suele escuchar en **3000**.
3. **Frontend**: `cd frontend && npm install && npm run dev` → Vite en **5173** (u otro si el puerto está ocupado).

---

## Pendientes / notas

- Reset de contraseña: flujo API listo; envío real de email puede estar como TODO en backend.
- Listado de sesiones de **otro** usuario: en backend no hay `GET` por `userId`; la UI ofrece revocación masiva donde aplica.
- Migraciones Prisma: según entorno, puede usarse `db push` / migraciones; ver documentación Prisma y `SETUP_DB.md`.

---

*Última actualización: documento interno de seguimiento del MVP.*
