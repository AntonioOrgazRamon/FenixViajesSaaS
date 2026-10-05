# Tareas

**Única fuente del estado de las tareas técnicas** del repositorio. La prioridad de producto vive en [docs/product/07_PRODUCT_ROADMAP.md](../product/07_PRODUCT_ROADMAP.md) y las decisiones, en [06_DECISIONS.md](../product/06_DECISIONS.md). Aquí no se repiten.

Reglas:
- Una tarea es una línea `- [ ]`. Se marca `- [x]` **solo con evidencia**: hash del commit, comando ejecutado y resultado.
- Sin porcentajes. El recuento sale de los datos:
  - pendientes: `grep -c '^- \[ \]' docs/development/TAREAS.md`
  - hechas: `grep -c '^- \[x\]' docs/development/TAREAS.md`
  - hallazgos: `grep -c '^| H' docs/development/TAREAS.md`
- `[A CONFIRMAR]` = dato sin verificar, no es un hecho.

## En curso

- [ ] Contexto para agentes de IA (`AGENTS.md`, `CLAUDE.md`, contexto por carpeta, decisiones técnicas). Rama `chore/agent-context`. Se marca hecha al fusionar el PR, con su enlace como evidencia.

## Pendiente (código y repositorio)

- [ ] Convertir `docs/history/qa-audit-output.txt` de UTF-16 (con CRLF) a UTF-8 para que se pueda buscar con `grep` y leer con herramientas de texto.

## Pendiente fuera del código

- [ ] Configurar un SMTP real para la recuperación de contraseña: buzón emisor, contraseña de aplicación y `.env` del despliegue. Cómo hacerlo: [SETUP_EMAIL.md](./SETUP_EMAIL.md).
- [ ] Revisar la lista «Fuera hoy» de la sección Alcance de `AGENTS.md` (reservas, pagos, facturación, postventa), marcada `[A CONFIRMAR]`.
- [ ] Confirmar por qué `apps/lead-capture-widget` está fuera del workspace de npm (ver T006 en [DECISIONES_TECNICAS.md](../architecture/DECISIONES_TECNICAS.md)).
- [ ] Comprobar si Cursor carga `AGENTS.md` (raíz y anidados) [A CONFIRMAR]. Lo tiene que hacer una persona con Cursor, en la rama que contiene estos archivos:
  1. Abrir la carpeta raíz del repositorio en Cursor (no una subcarpeta) y abrir un **chat de agente nuevo** (`Ctrl+L` / `Cmd+L`, «New chat»).
  2. **Raíz**: sin adjuntar nada, enviar: «Sin usar herramientas: ¿tienes cargadas instrucciones de un AGENTS.md? Si es así, copia literalmente la primera fila de la tabla de "Reglas firmes"». Resultado esperado: cita la fila «Ningún dato de negocio cruza empresas…».
  3. **Anidado (control)**: en el mismo chat, enviar: «Sin usar herramientas: ¿tienes instrucciones de apps/api/AGENTS.md? Si es así, cita el título de su sección sobre scripts». Lo esperado es NO, porque aún no se ha tocado `apps/api`.
  4. **Anidado (prueba)**: en un chat nuevo, adjuntar `@apps/api/src/common/company-context.ts`, pedir «Resume este archivo en una línea» y después repetir la pregunta del paso 3. Si responde «Scripts peligrosos», Cursor carga los `AGENTS.md` anidados al trabajar en esa carpeta.
  5. Anotar aquí la versión de Cursor y el resultado de los pasos 2 a 4, y actualizar T008 en [DECISIONES_TECNICAS.md](../architecture/DECISIONES_TECNICAS.md). Si Cursor no carga los anidados, abrir la decisión de cómo cubrirlo.
- [ ] Decisiones de producto pendientes D001–D019: se resuelven en [06_DECISIONS.md](../product/06_DECISIONS.md), no aquí.

## Hallazgos fuera de alcance

Detectados en la auditoría de contexto del 2026-10-05. **No se arreglan salvo que una tarea lo pida expresamente.** Si una tarea arregla uno, se convierte en `- [ ]` en «Pendiente» y su fila se borra de esta tabla al cerrarla.

| ID | Hallazgo | Archivo:línea | Gravedad |
|---|---|---|---|
| H1 | `/uploads` se sirve sin autenticación: PDF de propuestas y de catálogo de todas las empresas (riesgo para D024) | `apps/api/src/index.ts:63`; URLs en `apps/api/src/modules/proposals/proposal.service.ts:250,274`; `apps/api/src/common/config/index.ts:63` | Alta |
| H2 | Ninguna regla firme tiene test; `npm test` es un marcador de posición | `apps/api/package.json:6` | Alta |
| H3 | Borrar un lead o una empresa elimina en cascada las versiones de propuesta (D020) | `apps/api/prisma/schema.prisma:1169,1194,1217,1239` | Media |
| H4 | El precio «congelado» de una versión solo vive en HTML/PDF; `ProposalTrip` apunta al viaje vivo | `apps/api/prisma/schema.prisma:1186-1189,1218` | Media |
| H5 | `npm run test:travel-search` falla («FAIL: schema travel search») | `apps/api/scripts/validate-travel-search.ts` (línea [A CONFIRMAR]) | Media |
| H6 | El widget pide pegar un JWT, lo guarda en `localStorage` y usa `POST /leads` en vez del endpoint público documentado | `apps/lead-capture-widget/src/app/services/app-settings.service.ts:19`; `lead-form.service.ts:21`; contradice `docs/architecture/FRONTEND_LEADS_FORM_INTEGRATION.md` | Media |
| H7 | El API no tiene scripts `build` ni `start` | `apps/api/package.json` (bloque `scripts`) | Media |
| H8 | Las migraciones no tienen línea base (la primera hace `ALTER` sobre una tabla ya existente) | `apps/api/prisma/migrations/20260426170000_travel_catalog/migration.sql:3` | Media |
| H9 | Lint del panel: 37 errores y 3 avisos | `apps/panel` (`eslint.config.js`) | Media |
| H10 | El diagrama de estados del lead no coincide con las transiciones del código | `docs/product/03_BUSINESS_RULES.md:11` frente a `apps/api/src/modules/leads/lead-status.ts:4-5` | Baja |
| H11 | Los scripts de autoaprobación saltan la revisión humana de D022 | `apps/api/scripts/travel-auto-approve.ts`, `travel-auto-approve-priced.ts` | Baja |
| H12 | La generación de propuestas se registra en `LeadActivity`, no en `AuditLog` (¿cumple D025? [A CONFIRMAR]) | `apps/api/src/modules/leads/smart-proposal.service.ts:659,759` | Baja |
| H13 | El esquema de base de datos existe en varias copias que pueden divergir | `apps/api/prisma/schema_full.sql`, `schema_mysql_full.sql`, `migration_incremental_leads_profile.sql`, `db-updates/` | Baja |

## Ideas, no hacer

Huecos detectados durante otras tareas. Se apuntan aquí en lugar de construirlos; pasan a «Pendiente» solo si alguien lo decide.

- (vacío)

## Hecho (con evidencia)

- (vacío)
