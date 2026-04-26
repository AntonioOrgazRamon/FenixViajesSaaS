# Fenix Viajes SaaS

Monorepo con el producto principal en **`jejeje/`** (SaaS multi-tenant: API Node + SPA React) y material adicional (Angular, Spring Boot, n8n, Docker).

## Estructura rápida

| Ruta | Descripción |
|------|-------------|
| **`jejeje/backend`** | API Express + Prisma (MySQL), JWT, módulos auth, empresas, usuarios, leads, etc. |
| **`jejeje/frontend`** | SPA Vite + React 19 + Tailwind; consume `VITE_API_URL` → `http://localhost:3000/api/v1` por defecto. |
| **`jejeje/docs`** | Visión general técnica del MVP (`PROJECT_OVERVIEW.md`). |
| **`backend/`** | API **Java / Spring Boot 3** (multi-tenant, PostgreSQL, Flyway). Requiere Maven y Postgres. |
| **`frontend/`** | App **Angular 19** (otro front del repo). |
| **`backend/frontend/`** | Copia / duplicado del Angular anterior (mismo `package.json` que `frontend/`). |
| **`n8n-number-processor/`** | Proyecto **Angular 17** independiente. |
| **`docker-compose.yml`** | PostgreSQL 15 para el stack **Java** (no el MySQL de `jejeje`). |

## Ramas de Git (estrategia)

- **`main`**: monorepo completo (recomendada para clonar y ver todo).
- **`frontend`**: solo el código de `jejeje/frontend` en la raíz de la rama (vía `git subtree`).
- **`backend`**: solo el código de `jejeje/backend` en la raíz de la rama.
- **`otros`**: resto del monorepo **sin** la carpeta `jejeje/` (Angular, Spring, n8n, Docker).

## Documentación

- [Documentación unificada](docs/DOCUMENTACION_FENIX_VIAJES.md) — repositorio, historial, despliegue local y ramas.
- [Visión del MVP `jejeje`](jejeje/docs/PROJECT_OVERVIEW.md) — arquitectura, rutas, arranque.

## Arranque rápido (stack `jejeje`)

1. MySQL local o remoto; configurar `jejeje/backend/.env` (plantilla: `jejeje/backend/.env.example`).
2. `cd jejeje/backend && npm install && npx prisma generate && npm run dev` → API en **:3000**.
3. `cd jejeje/frontend && npm install && npm run dev` → Vite (p. ej. **:5173**).

Más detalle en `jejeje/backend/SETUP_DB.md` y en `docs/DOCUMENTACION_FENIX_VIAJES.md`.

---

*Repositorio: [FenixViajesSaaS](https://github.com/AntonioOrgazRamon/FenixViajesSaaS).*
