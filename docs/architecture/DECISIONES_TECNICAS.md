# Decisiones técnicas

> **Responsabilidad de este documento**: registrar las decisiones **técnicas** (cómo está construido el sistema), con su motivo y las opciones descartadas. Las decisiones de **producto** viven solo en [docs/product/06_DECISIONS.md](../product/06_DECISIONS.md) y aquí no se repiten. Si una decisión técnica depende de una de producto, se cita su ID.

Estados: **Vigente** · **Descartada** (con motivo, para no volver a plantearla sin información nueva) · **Sustituida** (indica por cuál).
Cada entrada cita la fuente de la que sale. `[A CONFIRMAR]` = motivo no documentado en ninguna fuente; no se da por hecho.

## Índice

| ID | Decisión | Estado |
|---|---|---|
| T001 | MySQL con UUID en `CHAR(36)` para poder pasar a PostgreSQL | Vigente |
| T002 | Toda llamada a OpenAI pasa por un ejecutor con control de gasto | Vigente |
| T003 | El PDF de catálogo no se envía entero a la IA | Vigente |
| T004 | Importación JSON en staging antes de crear viajes | Vigente |
| T005 | Motor de recomendación determinista; retrieval híbrido y geo opcionales | Vigente |
| T006 | `apps/lead-capture-widget` fuera del workspace de npm | Vigente |
| T007 | `packages/contracts` nace como piloto con un solo contrato (`Role`) | Vigente |
| T008 | Contexto para agentes de IA: `AGENTS.md` como única entrada | Vigente |
| T009 | Los PDF de propuestas se sirven por enlace sin autenticación | Vigente [A CONFIRMAR] |

---

## T001 · MySQL con UUID en `CHAR(36)`

- **Decisión**: la base de datos es MySQL/MariaDB (encaja con el hosting Hostinger). Los identificadores son UUID guardados como `CHAR(36)`.
- **Motivo**: poder migrar a PostgreSQL cambiando el `provider` de Prisma y volcando datos, sin rediseñar claves.
- **Descartado**: nada documentado.
- **Consecuencia**: la búsqueda vectorial nativa (`pgvector`) no está disponible mientras se use MySQL.
- **Fuente**: `docs/development/SETUP_DB.md`; cabecera de `apps/api/prisma/schema.prisma`.

## T002 · Ejecutor de OpenAI con control de gasto

- **Decisión**: todas las llamadas al SDK de OpenAI pasan por `apps/api/src/services/openai/openai-guarded.executor.ts` (`guardedChatCompletion` / `guardedEmbeddingCreate`). Antes de cada llamada se comprueban el kill switch (env y BD), los flags por operación, los topes en € (global, empresa, usuario y operación) y los límites de ritmo. Cada uso queda registrado en `openai_usage_logs`.
- **Motivo**: controlar el gasto de IA por empresa (multi-tenant) y poder cortarlo de inmediato.
- **Descartado**: llamar al SDK directamente desde cada servicio (implícito en «**todas** las llamadas»).
- **Fuente**: `docs/architecture/OPENAI_USAGE_GUARD.md`; en el código solo hay dos `new OpenAI(`, los dos en el ejecutor (comprobado el 2026-10-05).

## T003 · El PDF de catálogo no se envía entero a la IA

- **Decisión**: subida → extracción de texto por página (`unpdf`) → segmentación heurística → enriquecimiento opcional con OpenAI → revisión humana → MySQL.
- **Motivo**: «arquitectura alineada con el documento de requisitos» [A CONFIRMAR: el motivo concreto no está escrito; ese documento de requisitos no está en el repositorio].
- **Descartado**: enviar el PDF completo a la IA en producción.
- **Fuente**: `docs/architecture/MODULO_CATALOGO_VIAJES.md`.

## T004 · Importación JSON en staging

- **Decisión**: los viajes importados por JSON (archivo o texto pegado) entran primero en `TravelJsonImportBatch` / `TravelJsonImportItem`. Los `TravelTrip` solo se crean tras `POST /api/v1/travel/import-json/batches/:batchId/import`.
- **Motivo**: cargar viajes revisados a mano sin pasar por el importador PDF, con un paso explícito de revisión antes de crear nada.
- **Fuente**: `docs/architecture/TRAVEL_JSON_IMPORT.md`.

## T005 · Motor de recomendación determinista

- **Decisión**: la Fase 1 (restricciones, puntuación, diversidad y slots comerciales sobre todo el catálogo `APPROVED`) está activa por defecto. El retrieval híbrido, el geográfico y los embeddings son opcionales, mediante flags (`TRAVEL_HYBRID_RETRIEVAL_ENABLED`, `TRAVEL_GEO_RETRIEVAL_ENABLED`), y vienen apagados.
- **Motivo**: [A CONFIRMAR]; no está escrito.
- **Consecuencia documentada**: la Fase 1 funciona sin clave de OpenAI o con errores 429 (ver `OPENAI_DEPENDENCY_MATRIX.md`).
- **Fuente**: `docs/architecture/RECOMMENDATION_ENGINE_STATUS.md`; `apps/api/.env.example` («Motor principal sigue siendo determinista; hybrid/geo/embeddings son opcionales»).

## T006 · Widget fuera del workspace

- **Decisión**: `apps/lead-capture-widget` (Angular) no está en `workspaces` del `package.json` raíz y se instala aparte.
- **Motivo**: [A CONFIRMAR]. El README raíz remitía a `docs/architecture/` para explicarlo, pero ese motivo no estaba escrito en ningún sitio.
- **Fuente**: `package.json` raíz; `README.md`. Pendiente en [TAREAS.md](../development/TAREAS.md).

## T007 · `packages/contracts` como piloto

- **Decisión**: el paquete contiene un solo contrato, `Role`, que antes estaba duplicado en tres sitios. `apps/panel` lo consume y `apps/api` todavía no.
- **Motivo**: era pequeño, la duplicación se podía verificar y cambiarlo tenía poco riesgo.
- **Descartado**: extraer de golpe todos los tipos compartibles entre `apps/api` y `apps/panel`. Se haría como un trabajo aparte y deliberado, no como efecto secundario de la migración a monorepo. Tampoco se conectó la capa Zod del API, porque toca validaciones de entrada (más superficie).
- **Reglas de dependencia**: lo pueden usar `apps/api`, `apps/panel` y `apps/lead-capture-widget`. El paquete no depende nunca de `apps/*` ni de `@prisma/client`. `Role` cambia en el mismo commit que `enum Role` de `schema.prisma`.
- **Fuente**: `packages/contracts/README.md`; `packages/contracts/src/role.ts`.

## T008 · Contexto para agentes de IA

- **Decisión**: `AGENTS.md` en la raíz es la única entrada común para Claude Code, Cursor y otras herramientas. `CLAUDE.md` solo lo importa (`@AGENTS.md`). Cada app o paquete tiene su `AGENTS.md`, más un `CLAUDE.md` que lo importa y se carga solo al trabajar en esa carpeta. Los documentos de producto se **enlazan**, no se importan. El estado de las tareas vive solo en `docs/development/TAREAS.md`.
- **Motivo**: que cada sesión empiece conociendo las reglas firmes, con un coste medido con `/context` (2,6k tokens siempre cargados el 2026-10-05, tras recortar de 4,2k; presupuesto ≤ 2.700) y una sola fuente de verdad por tema.
- **Descartado**:
  - Varios archivos de estado que haya que sincronizar a mano: se contradicen cuando uno se retrasa.
  - Porcentajes de avance escritos a mano: caducan solos. Se usan recuentos con `grep`.
  - Importar con `@` los documentos de producto: costaría entre ~7.000 (README + 03 + 08) y ~42.000 (todo `docs/product`) tokens por sesión (caracteres ÷ 2,1, el ratio medido).
  - Memoria del agente fuera del repositorio como fuente de reglas: no la comparte el equipo y duplica lo que dice el repo.
  - Reglas en `.cursor/`: la carpeta está en `.gitignore`.
- **Fuente**: auditoría de contexto del 2026-10-05.

## T009 · PDF de propuestas por enlace, sin autenticación

- **Decisión**: los PDF de propuestas se sirven por enlace sin autenticación; el control de acceso es el identificador aleatorio de la URL. Así el cliente final abre el PDF con el enlace, sin cuenta. `/uploads` se publica con `express.static` (`apps/api/src/index.ts:63`).
- **Motivo**: que el cliente final abra la propuesta sin login [A CONFIRMAR: motivo tal como lo da el equipo; no está escrito en ninguna fuente del repositorio].
- **Quién lo decidió**: [A CONFIRMAR].
- **Comprobado solo leyendo el código (2026-10-05)**:
  - El nombre del PDF es un UUID v4 aleatorio: `uuidv4()` en `modules/proposals/proposal.service.ts:233` (`pdfKey`) y en `modules/leads/smart-proposal.service.ts:590,705` (`versionId`). No es secuencial ni predecible. La ruta es `uploads/proposals/<companyId>/<uuid>.pdf`; `companyId` también es un UUID.
  - No hay listado de directorio: no hay `serve-index` ni equivalente (`grep` en `apps/api/src` y `package.json`); `express.static` solo sirve archivos concretos.
  - Los PDF de catálogo (`uploads/travel-pdfs/<companyId>/<uuid>.pdf`, `modules/travel/document.service.ts:57-61`) y los avatares (`uploads/avatars/<uuid>.<ext>`) también usan UUID v4 y cuelgan del mismo `/uploads`. Son documentos internos, no para el cliente final: si deben seguir así es [A CONFIRMAR].
- **Consecuencias**: quien tenga el enlace accede; un enlace no caduca ni se puede revocar sin borrar el archivo, y puede quedar en correos, historiales o registros. La confidencialidad depende de que el UUID no se filtre.
- **Descartado**: añadir login a `/uploads`; rompería el enlace para el cliente final. Está en «Ideas, no hacer» de [TAREAS.md](../development/TAREAS.md).
- **Fuente**: lectura de código el 2026-10-05; sustituye al hallazgo H1 de la auditoría de contexto.
