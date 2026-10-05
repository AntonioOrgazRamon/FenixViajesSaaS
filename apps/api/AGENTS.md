# apps/api — contexto para agentes

Se carga solo al trabajar aquí. Reglas firmes y «hecho»: [AGENTS.md raíz](../../AGENTS.md).

## Estructura
- `src/index.ts`: monta las rutas. API bajo `/api/v1`; salud en `GET /health`; `/uploads` estático (⚠️ sin autenticación, hallazgo H1).
- Rutas: `auth`, `public`, `profile`, `leads`, `superadmin/companies`, `users`, `sessions`, `audit-logs`, `travel/documents`, `travel/trips`, `travel/import-json`, `proposals`, `admin/openai`.
- `src/modules/<módulo>`: controller, service, `*.schema.ts` (Zod) y `*.routes.ts`.
- `src/services/{geo,leads,openai,proposals,recommendation,travel}`: lógica de dominio compartida entre módulos.
- `src/common`: `config` (valida el entorno con Zod al cargar: sin `DATABASE_URL` no arranca nada, ni los scripts), `company-context.ts`, `middlewares` (`requireAuth`, `requireRole`, `requireCompanyMember`), `errors`.
- Errores normalizados: `{ success: false, error: { code, message } }`.
- `prisma/schema.prisma` es la fuente del modelo. Los `.sql` sueltos son copias que pueden divergir (hallazgo H13).

## Al tocar código aquí
- Rutas de negocio: `requireAuth` + `requireRole` y la empresa con `resolveTenantCompanyId(req)` (o `req.user.companyId` tras `requireCompanyMember`). Nunca la empresa que mande el cliente sin validarla (`assertPasteImportCompanyScope`).
- Toda consulta de negocio conserva `companyId` en el `where`. Las tablas nuevas de negocio llevan `companyId` e índices que empiecen por él.
- Viajes que llegan a búsqueda o propuestas: siempre `status: 'APPROVED'`.
- IA: solo `guardedChatCompletion` / `guardedEmbeddingCreate` de `src/services/openai`.

## Verificación
```bash
npx tsc --noEmit -p apps/api
DATABASE_URL="mysql://x:x@127.0.0.1:1/none" npm run <script> -w apps/api   # scripts sin BD real
```
- **Sin BD** (pasan con la URL ficticia): `test:hotels`, `test:segments`, `test:index-coverage`, `test:catalog-pipeline`, `test:candidate-quality`, `test:title-repair`, `test:hybrid-retrieval`. `test:travel-search` falla hoy (H5).
- **Con BD**: `test:openai-guard`, `geo:*`, `qa:*`, `e2e:*`, `smoke:*`.

## Scripts peligrosos
En `scripts/` hay scripts que **borran o cambian datos reales**: `delete-all-travel-trips`, `purge-all-travel-documents`, `delete-travel-document`, `qa-reset-commercial-data`, `update-travel-prices-from-audit`, `travel-auto-approve*` (saltan la revisión de D022), `set-user-role`, `seed-*`. Ejecútalos solo si la tarea lo pide y tras confirmar a qué BD apunta `DATABASE_URL`.
