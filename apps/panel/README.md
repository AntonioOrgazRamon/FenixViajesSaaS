# apps/panel

Panel interno de Fenix Viajes SaaS: la herramienta que usan comerciales y administradores de cada agencia para trabajar leads, catálogo y propuestas. Habla con `apps/api` por HTTP.

**Stack**: React 19, Vite 5, TypeScript, Tailwind CSS v4, React Router 7, TanStack Query (estado de servidor), Zustand (sesión), React Hook Form + Zod, Axios.

## Arrancar

```bash
cp .env.example .env          # VITE_API_URL=http://localhost:3000/api/v1
npm install                   # desde la raíz del monorepo (workspace)
npm run dev -w apps/panel     # http://localhost:5173
npm run build -w apps/panel   # tsc -b + vite build
npm run lint -w apps/panel
```

## Estructura

`src/features/<área>` (app, auth, leads, profile, proposals, sessions, superadmin, system, travel, users), `src/components`, `src/routes`, `src/store`, `src/lib`, `src/providers`.

Los tipos compartidos con el API (por ahora, `Role`) vienen de `@fenix/contracts` ([packages/contracts](../../packages/contracts)).

Reglas y comandos para agentes de IA: [AGENTS.md](./AGENTS.md).
