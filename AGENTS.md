# AGENTS.md — Fenix Viajes SaaS

Entrada para agentes de IA. Se carga en **cada** sesión: lo demás se enlaza, no se copia. `[A CONFIRMAR]` = sin verificar, no es un hecho.

## Paso 0 · cada sesión
`git status` y `git log --oneline -5` · trabaja en una rama (el equipo integra por PR) · busca la tarea en docs/development/TAREAS.md (si no está, pregunta) · lee el `AGENTS.md` de la carpeta donde trabajes · abre solo lo que pida «Cuándo abrir».

## Alcance
CRM multiempresa para agencias de viajes: leads, catálogo (importación PDF/JSON con revisión), recomendación, propuestas versionadas (HTML/PDF), usuarios/empresas, auditoría y control de gasto de OpenAI.
- **Fuera hoy** [A CONFIRMAR]: reservas, pagos, facturación, postventa (D004, D005, D008, D012 pendientes). No las construyas.

`apps/api` (Express, Prisma, MySQL) · `apps/panel` (React, Vite) · `apps/lead-capture-widget` (Angular, **fuera** del workspace) · `packages/contracts` (hoy solo `Role`).

## Reglas firmes
Autoridad: docs/product/06_DECISIONS.md (D…) y docs/architecture/DECISIONES_TECNICAS.md (T…). Código en `apps/api/src` salvo indicación.

| Regla | Definida en | Código | Cómo se comprueba hoy |
|---|---|---|---|
| Ningún dato de negocio cruza empresas | D024 | `common/company-context.ts`, `requireCompany.ts`; `companyId` en tablas | Solo revisión de código. Sin test. Sin políticas en la BD. PDF accesibles por enlace con identificador no adivinable (T009). |
| SUPER_ADMIN indica siempre la empresa | 03 | `resolveTenantCompanyId` | Solo revisión de código. Sin test. |
| Cada generación de propuesta crea versión nueva; nunca sobrescribe | D020 | `smart-proposal.service.ts`; `@@unique` en `schema.prisma` | Constraint de unicidad. Sin test. Nada impide borrar en cascada. |
| Solo viajes `APPROVED` en búsqueda, recomendación y propuestas | D022 | filtros `status: 'APPROVED'` en `services/` | Solo revisión de código. Sin test. Los scripts `travel-auto-approve*` saltan la revisión humana. |
| Lead: solo transiciones de estado permitidas | D023 | `lead-status.ts` | Sin test. ⚠️ El diagrama de 03 no coincide con el código. |
| Las acciones relevantes quedan auditadas | D025 | `AuditLog`, `audit.repository.ts` | Solo revisión de código. Sin test. |
| No inflar coincidencias con poca información | D021 | `match-honesty.engine.ts` | `test:travel-search` / `test:hybrid-retrieval` lo cubren solo indirectamente [A CONFIRMAR] |
| Toda llamada de IA pasa por el control de gasto (ni otro SDK ni gateway) | T002 | `openai-guarded.executor.ts` | `npm run test:openai-guard` (necesita BD) |
| `contracts` sin dependencias de `apps/*` ni Prisma; `Role` = `enum Role` | T007 | `packages/contracts/src/role.ts` | Solo revisión de código. |

**Reglas fijas de trabajo**
- **No toques una consulta de negocio sin conservar el filtro por `companyId`** (`where: { id, companyId }`). Toda tabla nueva de negocio lleva `companyId`.
- No resuelvas en código una decisión pendiente (D001–D019): para y pregunta.
- Secretos solo en `.env` (ignorado); en el repo, solo `.env.example`.

## Arrancar y probar
```bash
npm install  # api, panel, contracts; widget: cd apps/lead-capture-widget && npm install
npm run dev -w apps/api  # :3000, requiere apps/api/.env y MySQL
npm run dev -w apps/panel  # :5173
npm run verify  # typecheck:api + build panel + lint ≤ techo
npm run test:segments -w apps/api  # resto de test:* en apps/api/AGENTS.md
```
Los `test:*` exigen `DATABASE_URL` aunque no se conecten.
**Línea base (2026-10-05)**: tipos API 0 errores · build panel OK · lint panel **37 errores / 3 avisos** · `test:travel-search` **falla** · API sin `build`/`start` · sin CI.

## Definición de «hecho»
1. `npm run verify` pasa. El techo de lint (37, `scripts/lint-ceiling.mjs`) **solo baja**: si corriges errores, bájalo en el mismo commit; nunca lo subas para que pase un cambio.
2. Los `test:*` relacionados (y el de la app que toques, ver su `AGENTS.md`) pasan; nómbralos.
3. Docs afectadas actualizadas en el mismo commit.
4. En TAREAS.md, `[x]` solo con evidencia: commit, comando y resultado. **Sin evidencia, no está hecha.**

## Convenciones
- Un commit por tarea (Conventional Commits). Dominio y docs en español; código en inglés.
- **Ideas, no hacer**: un hueco fuera de tu tarea se apunta en TAREAS.md § «Ideas, no hacer»; no se construye.
- Los hallazgos de TAREAS.md (H2, H3…) no se arreglan salvo que la tarea lo pida expresamente.

## Cuándo abrir cada archivo
| Si vas a… | Abre |
|---|---|
| Trabajar en una app o paquete | su `AGENTS.md` |
| Producto: reglas (03), casos límite (05), decisiones (06), prioridad (07), términos (08) | docs/product/README.md (índice) |
| Ver o actualizar tareas | docs/development/TAREAS.md |
| Diseño técnico (recomendación, importación, IA…) | docs/architecture/README.md (índice) |
| Montar BD o correo | docs/development/SETUP_DB.md, SETUP_EMAIL.md |
| Ver el pasado | docs/history/ (no es documentación viva) |

## Mantenimiento
- Decisión de producto → solo 06 · técnica → DECISIONES_TECNICAS.md (también descartadas) · tarea → solo TAREAS.md · comando, línea base o regla firme → aquí · app → su `AGENTS.md` · doc muerto → docs/history/.
- **Presupuesto**: este archivo ≤ 2.700 tokens (medido 2026-10-05: 2,6k); cada `AGENTS.md` de carpeta ≤ 1.300. Medida válida: `/context` («Memory files»). Estimación rápida: `wc -c` ÷ 2,1.
- **Auditoría** (al cerrar cada bloque y al menos una vez al mes): rutas y comandos existen · línea base al día · presupuesto respetado · enlaces sin romper · ningún `[x]` sin evidencia en TAREAS.md.
