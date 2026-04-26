# Documentación Fenix Viajes SaaS

Repositorio unificado de prácticas y producto SaaS. Este documento resume el contenido del monorepo, el trabajo realizado, el despliegue local y la política de ramas en Git.

---

## 1. Contenido del repositorio

### 1.1 Producto principal: carpeta `jejeje/`

Aplicación **SaaS multi-tenant** (empresas, roles super admin / company admin / usuario, autenticación con JWT y sesiones en base de datos).

- **`jejeje/backend`**: API **Node.js** con **Express**, **TypeScript**, **Prisma** (motor por defecto **MySQL** en `DATABASE_URL`). Prefijo de API: `/api/v1`. Health check: `GET /health` (sin prefijo de versión). Módulos principales: autenticación, empresas (superadmin), usuarios, sesiones, auditoría, perfiles, leads, rutas públicas (intake), subida de avatares bajo `/uploads`.
- **`jejeje/frontend`**: SPA con **Vite 5**, **React 19**, **Tailwind CSS v4**, **React Router 7**, **TanStack Query**, **Zustand** (auth), **Axios** con `baseURL` desde `VITE_API_URL` o por defecto `http://localhost:3000/api/v1`.
- Documentación adicional en `jejeje/docs/PROJECT_OVERVIEW.md` y en `jejeje/backend/DOCUMENTATION.md`, `SETUP_DB.md`, etc.

### 1.2 Otros proyectos en la raíz (sin `jejeje/`)

- **`backend/`**: servicio **Spring Boot 3.2** (Java 21), JPA, seguridad, JWT, **Flyway**, **PostgreSQL**. Va acompañado de `docker-compose.yml` en la raíz para levantar Postgres 15.
- **`frontend/`**: aplicación **Angular 19** independiente del stack `jejeje`.
- **`backend/frontend/`**: mismo tipo de app Angular (duplicado estructural respecto a `frontend/` en el sentido de `package.json` similar).
- **`n8n-number-processor/`**: app **Angular 17** (ej. procesado de números / gráficos con Chart.js).
- **`docker-compose.yml`**: solo **PostgreSQL** para el stack Java; no sustituye al MySQL que usa Prisma en `jejeje/backend`.

### 1.3 Relación entre piezas

- El **núcleo operativo** documentado como “Fenix / MVP” en el día a día es **`jejeje`**: un front (Vite) y un back (Express) desacoplados por HTTP.
- **Angular + Spring + n8n** conviven en el mismo repo por comodidad de carpetas; no comparten la misma base de datos que `jejeje` salvo que se configure a propósito.

---

## 2. Historial de trabajo (hasta el momento)

Resumen de decisiones y tareas relevantes en el entorno de desarrollo:

- **Inventario de servicios levantables**: se identificaron `npm`/`ng` en `jejeje`, `frontend/`, `n8n-number-processor/`, `mvn` para Spring, y `docker compose` para Postgres. En un entorno concreto faltó Maven en PATH y el daemon de Docker no estaba activo, por lo que no todo el stack Java/Docker pudo validarse en esa sesión.
- **Puertos habituales**: API `jejeje` en **3000**; Vite en **5173** (o el siguiente libre: 5174, 5175, etc.); Angular `ng serve` suele usar **4200**; el segundo Angular en **4201** si se fija.
- **Coexistencia de procesos**: se documentó el riesgo de colisión de puertos (varios Vite, varios `ng serve`).
- **Ajuste a un solo “sistema”**: se dejó explícito que el producto `jejeje` es **front (Vite) + back (Express en 3000)**. Se detuvieron intencionadamente otros servidores de desarrollo (Angular, Vite adicionales) que no formaban parte de ese stack, dejando en escucha solo la API y el Vite del `jejeje` (p. ej. 3000 y 5177 en un caso concreto por puertos ocupados).
- **Subida a GitHub y ramas**: se inicializó el control de versiones con `.gitignore` estricto (sin `node_modules` ni `.env`), se documentó el monorepo y se crearon ramas **frontend**, **backend** (subárbol de `jejeje`) y **otros** (resto sin `jejeje`).

---

## 3. Desarrollo local

### 3.1 Stack `jejeje` (recomendado para el producto)

1. Base **MySQL** (local, Docker, XAMPP o remoto). Configurar `jejeje/backend/.env` a partir de `jejeje/backend/.env.example`.
2. En `jejeje/backend`: `npm install`, `npx prisma generate`, migraciones o `db push` según `SETUP_DB.md`, luego `npm run dev`.
3. En `jejeje/frontend`: copiar `jejeje/frontend/.env.example` a `.env` si se desea fijar `VITE_API_URL`, luego `npm install` y `npm run dev`.

### 3.2 Spring Boot + PostgreSQL

1. Arrancar Docker (o instancia Postgres) y `docker compose up -d` en la raíz.
2. Desde `backend/`: `mvn spring-boot:run` (requiere **Java 21** y **Maven** en PATH).

### 3.3 Angular en `frontend/` o `n8n-number-processor/`

`npm start` o `ng serve` en la carpeta correspondiente; fijar `--port` para evitar solapes.

---

## 4. Ramas Git (cómo usarlas)

| Rama | Contenido |
|------|-----------|
| `main` | Monorepo completo. |
| `frontend` | Historial y archivos equivalentes a **`jejeje/frontend`**, con la raíz del repositorio = raíz del front (útil para despliegues solo-front o CI aislada). |
| `backend` | Igual para **`jejeje/backend`**. |
| `otros` | Árbol sin `jejeje/`: solo Angular, Spring, n8n, Docker, documentación de raíz, etc. |

Para un desarrollo normal, **trabajar en `main`** o en feature branches a partir de `main` es lo habitual. Las ramas `frontend` y `backend` se generan con `git subtree split` y sirven de **vista o despliegue** del subproyecto.

---

## 5. Seguridad

- No commitear archivos **`.env`** con contraseñas reales; usar siempre **`.env.example`** como plantilla.
- Rotar `JWT_SECRET` y `JWT_REFRESH_SECRET` en entornos no locales.

---

*Documento de referencia del estado del repositorio; actualizar cuando cambie el despliegue o la arquitectura.*
