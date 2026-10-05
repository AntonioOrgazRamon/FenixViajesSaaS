# AGENTS.md — Fenix Viajes SaaS

Entrada para agentes de IA (Claude Code, Cursor…). Se carga en **cada** sesión: ≤ 150 líneas / ~2.500 tokens. Lo que no cabe se enlaza, no se copia. `[A CONFIRMAR]` = sin verificar, no es un hecho.

## Paso 0 · al empezar cada sesión
1. Este archivo ya está cargado. Si vas a trabajar en una carpeta con su propio `AGENTS.md`, léelo.
2. `git status` y `git log --oneline -5`. Trabaja en una rama: el equipo integra por PR.
3. Busca la tarea en [docs/development/TAREAS.md](docs/development/TAREAS.md). Si no está, pregunta antes de empezar.
4. Abre solo lo que pida la tabla «Cuándo abrir cada archivo».

## Alcance
CRM multiempresa para agencias de viajes: captación y cualificación de leads, catálogo de viajes (importación PDF/JSON con revisión), motor de recomendación y propuestas comerciales versionadas (HTML/PDF). Monorepo con npm workspaces.
- **Dentro hoy**: leads, catálogo, recomendación, propuestas, usuarios/empresas, auditoría, control de gasto de OpenAI.
- **Fuera hoy** [A CONFIRMAR]: reservas, pagos, facturación, postventa (decisiones D004, D005, D008 y D012 pendientes). No las construyas.

| Carpeta | Qué es | Stack |
|---|---|---|
| `apps/api` | API REST `/api/v1` | Express, TypeScript, Prisma, MySQL |
| `apps/panel` | Panel interno de comerciales y administradores | React 19, Vite, TanStack Query, Zustand |
| `apps/lead-capture-widget` | Formulario de captación (**fuera** del workspace: npm aparte) | Angular 19 |
| `packages/contracts` | Tipos compartidos del contrato HTTP (piloto: solo `Role`) | TypeScript |

## Reglas firmes (invariantes)
Autoridad: [docs/product/06_DECISIONS.md](docs/product/06_DECISIONS.md). La última columna dice qué protege de verdad cada regla hoy.

| Regla | Dónde se define | Dónde vive en el código | Cómo se comprueba hoy |
|---|---|---|---|
| Ningún dato de negocio cruza empresas | D024; 03 §Aislamiento | `apps/api/src/common/company-context.ts`, `common/middlewares/requireCompany.ts`, `companyId` en todas las tablas de negocio | Solo revisión de código. Sin test. Sin políticas en la BD. ⚠️ `/uploads` se sirve sin autenticación (TAREAS.md, hallazgo H1). |
| SUPER_ADMIN siempre indica la empresa; nunca se asume | 03 §Aislamiento | `resolveTenantCompanyId` en `company-context.ts` | Solo revisión de código. Sin test. |
| Las versiones de propuesta no se sobrescriben; cada generación crea una nueva | D020 | `modules/leads/smart-proposal.service.ts` (`nextNum`); `@@unique([proposalId, versionNumber])` en `schema.prisma` | Constraint de unicidad. Sin test. Nada impide borrar en cascada. |
| Solo los viajes `APPROVED` llegan a búsqueda, recomendación y propuestas | D022 | Filtros `status: 'APPROVED'` en `services/travel`, `services/recommendation`, `services/geo` y `services/proposals/proposal-generation.service.ts` | Solo revisión de código. Sin test. Los scripts `travel-auto-approve*` saltan la revisión humana. |
| El estado del lead solo sigue transiciones permitidas | D023 | `modules/leads/lead-status.ts` | Sin test. ⚠️ El diagrama de 03 no coincide con el código. |
| Las acciones relevantes quedan auditadas | D025 | Modelo `AuditLog`, `modules/audit/audit.repository.ts` | Solo revisión de código. Sin test. |
| No se inflan coincidencias con poca información | D021 | `services/recommendation/match-honesty.engine.ts` | `test:travel-search` / `test:hybrid-retrieval` lo cubren solo indirectamente [A CONFIRMAR] |
| Toda llamada a OpenAI pasa por el control de gasto | docs/architecture/OPENAI_USAGE_GUARD.md | `services/openai/openai-guarded.executor.ts` (único `new OpenAI`) | `npm run test:openai-guard` (necesita BD) |
| `contracts` no depende de `apps/*` ni de Prisma; `Role` cambia junto con `enum Role` | packages/contracts/README.md | `packages/contracts/src/role.ts` | Solo revisión de código. |

**Reglas fijas de trabajo**
- **No toques una consulta de negocio sin conservar el filtro por `companyId`** (`where: { id, companyId }`). Toda tabla nueva de negocio lleva `companyId`.
- No añadas llamadas de IA (otro SDK, proveedor o gateway) fuera de `openai-guarded.executor.ts`.
- No resuelvas en código una decisión pendiente (D001–D019). Si la tarea la necesita, para y pregunta.
- No «mejores» las puntuaciones de recomendación saltándote D021.
- Secretos solo en `.env` (ignorado por git). En el repo, únicamente `.env.example`.

## Arrancar y probar
```bash
npm install                                        # api, panel, contracts
(cd apps/lead-capture-widget && npm install)       # widget: npm aparte
npm run dev -w apps/api                            # :3000 — requiere apps/api/.env (ver .env.example) y MySQL
npm run dev -w apps/panel                          # :5173
npm run verify                                     # «hecho» mínimo: tipos API + build panel + lint ≤ techo
npm run typecheck:api                              # solo tipos del API
npm run build -w apps/panel                        # tsc -b + vite build
npm run lint -w apps/panel
npm run test:segments -w apps/api                  # y el resto de test:* (ver apps/api/AGENTS.md)
```
BD: [docs/development/SETUP_DB.md](docs/development/SETUP_DB.md). Los `test:*` exigen `DATABASE_URL` aunque no se conecten.

**Línea base conocida (2026-10-05)**: tipos del API 0 errores · build del panel OK · lint del panel **37 errores / 3 avisos** · `test:travel-search` **falla** · el API no tiene `build` ni `start` · no hay CI.

## Definición de «hecho»
Una tarea está hecha solo si:
1. `npm run verify` pasa: tipos del API sin errores, build del panel y lint del panel ≤ 37 errores (techo en `scripts/lint-ceiling.mjs`; si bajas los errores, baja el techo en el mismo commit).
2. Si tocaste el widget: `npm run build` en `apps/lead-capture-widget`.
3. Los `test:*` relacionados con el cambio pasan; nómbralos.
4. La documentación afectada está actualizada en el mismo commit (ver «Mantenimiento»).
5. En TAREAS.md se marca `[x]` con evidencia: hash del commit, comando ejecutado y resultado. **Sin evidencia, no está hecha.**

## Convenciones
- Un commit por tarea, en Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`), como en el historial.
- Dominio y documentación en español. Identificadores de código en inglés, como en el código actual.
- **Ideas, no hacer**: si ves un hueco fuera de tu tarea, apúntalo en TAREAS.md § «Ideas, no hacer». No lo construyas.
- Los hallazgos de TAREAS.md (H1, H2…) no se arreglan salvo que la tarea lo pida expresamente.
- Si encuentras una decisión de producto explicada fuera de 06, es un defecto: deja solo la referencia por ID.

## Cuándo abrir cada archivo
| Si vas a… | Abre |
|---|---|
| Trabajar en una app o paquete | El `AGENTS.md` de esa carpeta |
| Entender una regla de negocio | [docs/product/03_BUSINESS_RULES.md](docs/product/03_BUSINESS_RULES.md) |
| Saber si algo está decidido, y por qué | [docs/product/06_DECISIONS.md](docs/product/06_DECISIONS.md) (producto) · [docs/architecture/DECISIONES_TECNICAS.md](docs/architecture/DECISIONES_TECNICAS.md) (técnica) |
| Saber qué significa un término | [docs/product/08_GLOSSARY.md](docs/product/08_GLOSSARY.md) |
| Tocar un caso «¿y si…?» | [docs/product/05_EDGE_CASES.md](docs/product/05_EDGE_CASES.md) |
| Priorizar trabajo de producto | [docs/product/07_PRODUCT_ROADMAP.md](docs/product/07_PRODUCT_ROADMAP.md) |
| Ver o actualizar tareas | [docs/development/TAREAS.md](docs/development/TAREAS.md) |
| Tocar recomendación | docs/architecture/RECOMMENDATION_ENGINE_STATUS.md, TRAVEL_SCORING_CALIBRATION.md |
| Tocar importación de catálogo | docs/architecture/MODULO_CATALOGO_VIAJES.md, TRAVEL_JSON_IMPORT.md |
| Tocar geo, media o perfil de lead | docs/architecture/TRAVEL_GEO_MODEL.md, TRAVEL_MEDIA_ENRICHMENT.md, LEAD_TRAVEL_PROFILE.md |
| Tocar propuestas (modelo de datos) | docs/architecture/travel-proposals-data-model.md, TRAVEL_AND_PROPOSAL_LIBRARY.md |
| Tocar IA o costes | docs/architecture/OPENAI_USAGE_GUARD.md, OPENAI_DEPENDENCY_MATRIX.md |
| Montar BD o correo | docs/development/SETUP_DB.md, SETUP_EMAIL.md |
| Ver el pasado | docs/history/ (instantáneas; **no** es documentación viva) |

## Mantenimiento
| Cuando cambie… | Actualiza |
|---|---|
| Una decisión de producto | Solo 06_DECISIONS.md (y referencias por ID) |
| Una decisión técnica | DECISIONES_TECNICAS.md (también las descartadas, con su motivo) |
| El estado de una tarea | Solo TAREAS.md |
| Un comando, la línea base o una regla firme | Este archivo |
| Algo propio de una app | El `AGENTS.md` de esa carpeta |
| Un documento que deja de ser vivo | Muévelo a docs/history/ |

**Presupuesto de contexto**: esta raíz ≤ 2.500 tokens; cada `AGENTS.md` de carpeta ≤ 700. Mídelo con `wc -c AGENTS.md apps/*/AGENTS.md packages/*/AGENTS.md` (caracteres ÷ 3,6 ≈ tokens).
**Auditoría periódica** (al cerrar cada bloque de trabajo y como mínimo una vez al mes): rutas y comandos de este archivo siguen existiendo · línea base actualizada · presupuesto respetado · enlaces sin romper · TAREAS.md sin tareas `[x]` sin evidencia.
