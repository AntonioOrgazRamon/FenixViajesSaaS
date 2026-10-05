# Tareas

**Única fuente del estado de las tareas técnicas** del repositorio. La prioridad de producto vive en [docs/product/07_PRODUCT_ROADMAP.md](../product/07_PRODUCT_ROADMAP.md) y las decisiones, en [06_DECISIONS.md](../product/06_DECISIONS.md). Aquí no se repiten.

Reglas:
- Una tarea es una línea `- [ ]`. Se marca `- [x]` **solo con evidencia**: hash del commit, comando ejecutado y resultado.
- Sin porcentajes. El recuento sale de los datos:
  - hechas: `grep -c '^- \[x\]' docs/development/TAREAS.md`
  - sin hacer (incluye bloqueadas y decisiones): `grep -c '^- \[ \]' docs/development/TAREAS.md`
  - hallazgos: `grep -c '^| H' docs/development/TAREAS.md`
- `[A CONFIRMAR]` = dato sin verificar, no es un hecho.
- Una tarea cambia de sección cuando cambia su estado; no se copia en dos.

## Hecho

- [x] Contexto para agentes de IA (`AGENTS.md`, `CLAUDE.md`, contexto por carpeta, decisiones técnicas). Evidencia: PR #2 fusionado (`bae7e4e`, rama `chore/agent-context`), https://github.com/AntonioOrgazRamon/FenixViajesSaaS/pull/2.

## En curso

- (vacío)

## Listo para hacer (no depende de nadie)

Orden: H7, H8.

- [ ] **H7 · Scripts `build` y `start` en `apps/api`.** Hoy `apps/api/package.json` no los tiene.
  - Aceptación: `npm run build -w apps/api` compila a una carpeta de salida sin errores; `npm run start -w apps/api` arranca el API compilado y `GET /health` responde `{"status":"ok"}`; `npm run verify` sigue pasando; el procedimiento queda en `apps/api/AGENTS.md` y en la sección «Arrancar y probar» de `AGENTS.md`, sin pasar de su presupuesto.
- [ ] **H8 · Línea base de migraciones.** La primera (`20260426170000_travel_catalog`) hace `ALTER` sobre una tabla que ya existía, así que una base vacía no se puede levantar solo con las migraciones.
  - Aceptación: sobre una base MySQL vacía, `npx prisma migrate deploy` crea el esquema completo sin errores; `npx prisma migrate diff` entre las migraciones y `schema.prisma` no muestra diferencias; la base actual sigue funcionando (marcar la línea base como aplicada con `migrate resolve`, documentado); el procedimiento queda en [SETUP_DB.md](./SETUP_DB.md). Depende de H13 solo para decidir qué copia SQL manda; no hace falta resolver H13 antes.

## Bloqueado

Motivo común: **a la espera del visto bueno y del pago de Fenix**. Nada de esto se empieza antes de que se desbloquee.

- [ ] Servidor de pruebas (staging) con contraseña y `noindex`.
- [ ] SMTP real para la recuperación de contraseña: buzón emisor, contraseña de aplicación y `.env` del despliegue. Cómo hacerlo: [SETUP_EMAIL.md](./SETUP_EMAIL.md).
- [ ] Clave de OpenAI y tope de gasto (ver [OPENAI_USAGE_GUARD.md](../architecture/OPENAI_USAGE_GUARD.md)).
- [ ] Despliegue.

## Decisiones con el cliente

No se resuelven en código ni aquí: se resuelven en [06_DECISIONS.md](../product/06_DECISIONS.md).

- [ ] D001–D019 pendientes.
- [ ] Lista «Fuera hoy» de la sección Alcance de `AGENTS.md` (reservas, pagos, facturación, postventa), marcada `[A CONFIRMAR]`; relacionada con D004, D005, D008 y D012.
- [ ] Motivo de que `apps/lead-capture-widget` esté fuera del workspace de npm (T006 en [DECISIONES_TECNICAS.md](../architecture/DECISIONES_TECNICAS.md)).

## Hallazgos fuera de alcance

Detectados en la auditoría de contexto del 2026-10-05. **No se arreglan salvo que una tarea lo pida expresamente.** Si una tarea arregla uno, se convierte en `- [ ]` en «Listo para hacer» y su fila se borra de esta tabla al cerrarla. H7 y H8 ya son tareas (ver arriba). H1 (`/uploads` sin login) dejó de ser un fallo: es la decisión T009 en [DECISIONES_TECNICAS.md](../architecture/DECISIONES_TECNICAS.md).

Orden: H2 antes de tener clientes reales · H6 antes de incrustar el formulario en webs de clientes · H3, H4, H5 y H9 sin fecha.

| ID | Hallazgo | Archivo:línea | Gravedad |
|---|---|---|---|
| H2 | Ninguna regla firme tiene test; `npm test` es un marcador de posición. Primero, tests de aislamiento por `companyId` | `apps/api/package.json:6` | Alta |
| H3 | Borrar un lead o una empresa elimina en cascada las versiones de propuesta (D020) | `apps/api/prisma/schema.prisma:1169,1194,1217,1239` | Media |
| H4 | El precio «congelado» de una versión solo vive en HTML/PDF; `ProposalTrip` apunta al viaje vivo | `apps/api/prisma/schema.prisma:1186-1189,1218` | Media |
| H5 | `npm run test:travel-search` falla («FAIL: schema travel search») | `apps/api/scripts/validate-travel-search.ts` (línea [A CONFIRMAR]) | Media |
| H6 | El widget pide pegar un JWT, lo guarda en `localStorage` y usa `POST /leads` en vez del endpoint público documentado | `apps/lead-capture-widget/src/app/services/app-settings.service.ts:19`; `lead-form.service.ts:21`; contradice `docs/architecture/FRONTEND_LEADS_FORM_INTEGRATION.md` | Media |
| H9 | Lint del panel: 37 errores y 3 avisos | `apps/panel` (`eslint.config.js`) | Media |
| H10 | El diagrama de estados del lead no coincide con las transiciones del código | `docs/product/03_BUSINESS_RULES.md:11` frente a `apps/api/src/modules/leads/lead-status.ts:4-5` | Baja |
| H11 | Los scripts de autoaprobación saltan la revisión humana de D022 | `apps/api/scripts/travel-auto-approve.ts`, `travel-auto-approve-priced.ts` | Baja |
| H12 | La generación de propuestas se registra en `LeadActivity`, no en `AuditLog` (¿cumple D025? [A CONFIRMAR]) | `apps/api/src/modules/leads/smart-proposal.service.ts:659,759` | Baja |
| H13 | El esquema de base de datos existe en varias copias que pueden divergir | `apps/api/prisma/schema_full.sql`, `schema_mysql_full.sql`, `migration_incremental_leads_profile.sql`, `db-updates/` | Baja |

## Ideas, no hacer

Huecos detectados durante otras tareas. Se apuntan aquí en lugar de construirlos; pasan a «Listo para hacer» solo si alguien lo decide.

- Convertir `docs/history/qa-audit-output.txt` de UTF-16 (con CRLF) a UTF-8 para poder buscarlo con `grep`.
- Comprobar si Cursor carga `AGENTS.md` (raíz y anidados) [A CONFIRMAR]; solo si alguien del equipo lo usa. Pasos: abrir la raíz en Cursor, chat de agente nuevo; preguntar sin herramientas por la primera fila de «Reglas firmes» (debe citar «Ningún dato de negocio cruza empresas…»); en otro chat, adjuntar `@apps/api/src/common/company-context.ts` y preguntar por el título de la sección sobre scripts de `apps/api/AGENTS.md` («Scripts peligrosos» si los anidados se cargan). Anotar versión y resultado y actualizar T008 en [DECISIONES_TECNICAS.md](../architecture/DECISIONES_TECNICAS.md).
- No añadir login a `/uploads`: los PDF de propuestas se abren por enlace a propósito (T009 en [DECISIONES_TECNICAS.md](../architecture/DECISIONES_TECNICAS.md)).
