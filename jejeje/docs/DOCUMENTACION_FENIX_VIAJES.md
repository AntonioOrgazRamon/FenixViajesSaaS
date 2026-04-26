# Documentación Fenix Viajes SaaS

Repositorio del producto **SaaS multi-tenant** (empresas, roles, JWT, leads, catálogo de viajes, etc.).

## Estructura

| Ruta | Descripción |
|------|-------------|
| **`saas_practicas_nakedcode/backend`** | API Node.js (Express, TypeScript, Prisma, MySQL). Prefijo `/api/v1`. `GET /health`. |
| **`saas_practicas_nakedcode/frontend`** | SPA Vite + React + Tailwind. `VITE_API_URL` → `http://localhost:3000/api/v1` por defecto. |
| **`saas_practicas_nakedcode/docs/`** | Visión del proyecto, tareas pendientes, esta guía. |
| **`saas_practicas_nakedcode/backend/docs/`** | Fases backend, módulo catálogo de viajes (`travel-catalog/`). |

Más detalle: `PROJECT_OVERVIEW.md`, `saas_practicas_nakedcode/backend/DOCUMENTATION.md`, `saas_practicas_nakedcode/backend/SETUP_DB.md`.

## Desarrollo local

1. **MySQL** (local, Docker o remoto). Copiar `saas_practicas_nakedcode/backend/.env.example` → `.env` y ajustar `DATABASE_URL`, JWT, y si aplica email (`EMAIL_FROM`, `SMTP_*`). Ver `TAREAS_PENDIENTES.md` para el envío de correo.
2. `cd saas_practicas_nakedcode/backend` → `npm install` → `npx prisma generate` → migrar o `db push` según `SETUP_DB.md` → `npm run dev` (puerto **3000**).
3. `cd saas_practicas_nakedcode/frontend` → `npm install` → `npm run dev` (p. ej. **5173**).

## Git

- **`main`**: repositorio actual (solo el stack bajo `saas_practicas_nakedcode/` en la raíz de trabajo; el historial puede contener antiguas carpetas de otros stacks).
- En proyectos con **subtree** previos, pueden existir ramas `frontend` / `backend` con solo `saas_practicas_nakedcode/frontend` o `saas_practicas_nakedcode/backend` en la raíz; comprobar en el remoto.

## Seguridad

- No commitear **`.env`** reales. Rotar `JWT_SECRET` y `JWT_REFRESH_SECRET` en producción.

---

*Actualizar este documento cuando cambie el despliegue o la arquitectura.*
