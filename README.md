# Fenix Viajes SaaS

CRM multiempresa para agencias de viajes: captación y cualificación de leads, catálogo de viajes, motor de recomendación y generación de propuestas comerciales.

Este repositorio es un **monorepo** (npm workspaces): todo el producto vive en un único árbol de código, organizado por aplicaciones desplegables (`apps/`) y código compartido entre ellas (`packages/`).

## Aplicaciones (`apps/`)

| Carpeta | Qué es | Stack |
|---|---|---|
| [`apps/api`](./apps/api) | La API. Autenticación, multi-tenant, leads, catálogo de viajes, motor de recomendación, propuestas comerciales. | Node.js, Express, TypeScript, Prisma/MySQL |
| [`apps/panel`](./apps/panel) | El panel interno: la herramienta que usan comerciales y administradores de cada agencia para trabajar leads y generar propuestas. | React, Vite, TypeScript |
| [`apps/lead-capture-widget`](./apps/lead-capture-widget) | Formulario público embebible de captación de leads, independiente del panel interno. | Angular |

## Código compartido (`packages/`)

| Carpeta | Qué es |
|---|---|
| [`packages/contracts`](./packages/contracts) | Tipos y esquemas del contrato de API compartidos entre `apps/api` y sus consumidores. Nace pequeño a propósito — ver su propio README para el alcance actual. |

## Documentación (`docs/`)

| Carpeta | Para qué |
|---|---|
| [`docs/product/`](./docs/product) | **Documentación de producto**: qué es el negocio, cómo funciona, qué está decidido y qué no. Empieza aquí si quieres entender el producto sin leer código — sigue el orden de lectura en [`docs/product/README.md`](./docs/product/README.md). |
| [`docs/architecture/`](./docs/architecture) | Referencia técnica viva del diseño del sistema (motor de recomendación, modelo geográfico, propuestas, importación de catálogo, control de gasto de IA, etc.). |
| [`docs/development/`](./docs/development) | Cómo levantar el entorno local, configurar la base de datos, tareas de desarrollo pendientes. |
| [`docs/history/`](./docs/history) | Informes de sesiones de trabajo ya cerradas (auditorías resueltas, QA puntual, cierres de iteración). Fotografías de un momento concreto, no documentación viva. |

## Empezar en local

Cada aplicación se instala y arranca de forma independiente:

```bash
cd apps/api && npm install && npm run dev       # API en http://localhost:3000
cd apps/panel && npm install && npm run dev     # Panel en http://localhost:5173
cd apps/lead-capture-widget && npm install && npm start   # Widget en http://localhost:4200
```

Guía completa (base de datos, variables de entorno): [`docs/development/SETUP_DB.md`](./docs/development/SETUP_DB.md).

También puedes instalar `apps/api` y `apps/panel` desde la raíz gracias al workspace de npm (`npm install`); `apps/lead-capture-widget` mantiene su propio ciclo de instalación por separado (ver [`docs/architecture/`](./docs/architecture) si necesitas el motivo).

---

*Repositorio: [FenixViajesSaaS](https://github.com/AntonioOrgazRamon/FenixViajesSaaS).*
