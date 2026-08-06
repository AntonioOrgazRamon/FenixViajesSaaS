# Módulo catálogo de viajes (ingestión PDF)

Arquitectura alineada con el documento de requisitos: **no** se envía el PDF completo a la IA en producción. El flujo es: subida → extracción de texto por página (librería `unpdf`) → segmentación heurística de bloques → (opcional) enriquecimiento estructurado con OpenAI → validación en revisión humana → almacenamiento en MySQL (Prisma).

## Seguridad (multiempresa)

| Rol | Qué puede hacer |
|-----|------------------|
| `COMPANY_ADMIN` | Todo el catálogo de **su** empresa. |
| `SUPER_ADMIN` | Mismo, pero **debe** enviar `companyId` en body o query en cada petición. |
| `COMPANY_USER` | **No** sube ni procesa PDFs. Puede listar / buscar **solo viajes `APPROVED`**. No aprueba/rechaza. |

## Base path de la API

Todas las rutas cuelgan de ` /api/v1 ` (el producto no usa ` /api/... ` suelto).

- Documentos: ` /api/v1/travel/documents `
- Viajes: ` /api/v1/travel/trips `

## Endpoints principales

1. `POST /api/v1/travel/documents/upload` — multipart `file` (PDF). `SUPER_ADMIN`: campo `companyId` en el form.
2. `GET /api/v1/travel/documents` — listado (solo admin).
3. `GET /api/v1/travel/documents/jobs/:jobId` — estado del job de importación.
4. `GET /api/v1/travel/documents/:id` — detalle del documento.
5. `POST /api/v1/travel/documents/:id/process` — encola el pipeline (respuesta 202 con `jobId`).
6. `GET /api/v1/travel/trips` — `?status=` (admin) o solo aprobados para `COMPANY_USER`.
7. `GET /api/v1/travel/trips/search` — filtros: `q`, `country`, `minDays`, `maxDays`, `minPrice`, `maxPrice` (solo aprobados).
8. `POST /api/v1/travel/trips/manual` — crea un viaje manual (cuerpo JSON = esquema `tripAiExtractZ` en `src/services/travel/trip-ai.schemas.ts`).
9. `PATCH /api/v1/travel/trips/:id` — edición (admin).
10. `POST /api/v1/travel/trips/:id/approve` | ` /reject` — revisión (admin).
11. `POST /api/v1/travel/trips/leads/:leadId/proposal` — guarda en `lead_details.travel_context` las propuestas vinculadas a **viajes aprobados** (`selectedTripIds`, notas, borrador).

## Fases técnicas (código)

| Fase | Ubicación |
|------|------------|
| 1. Modelo | `prisma/schema.prisma` + `prisma/migrations/.../travel_catalog` |
| 2. Subida | `src/modules/travel/document.*` + `multer` |
| 3. Extracción | `src/services/travel/pdf-extraction.service.ts` |
| 4. Segmentación | `src/services/travel/trip-segmentation.service.ts` |
| 5. IA | `src/services/travel/trip-ai-extraction.service.ts` + `trip-ai.schemas.ts` |
| 6. Normalización | `src/services/travel/trip-normalization.service.ts` |
| 7. Orquestación | `src/services/travel/trip-import.service.ts` |
| 8–9. API revisión y búsqueda | `src/modules/travel/trip.*` |
| 11. Leads | `attachLeadProposal` en `trip.controller.ts` |
| 12. Trazas | `TravelImportJob`, `TravelDocument` estados, logs Pino en pipeline |
| 14. Tests | Pendiente ampliar: schema Zod, segmentación. |

## Base de datos

- `travel_context` en `lead_details` (JSON) para FASE 9/11.
- Pipelines de PDF pesados: el trabajo corre **en el mismo proceso Node** (`setImmediate`); en producción sustituir por cola (Bull, SQS, etc.) y workers.

## FASE 10 (búsqueda semántica)

Pendiente: capa de embeddings (pgvector o servicio vectorial) + texto enriquecido post-aprobación. No mezclado con la consulta relacional actual.

## Migración

Con MySQL accesible:

```bash
npx prisma migrate deploy
```

O en desarrollo, tras revisar: `npx prisma migrate dev`.

## Dependencias añadidas

- `unpdf` — extracción de texto por página.
- `openai` (opcional; instalar con `npm install --legacy-peer-deps` por conflicto de peer con `zod@4` en el ecosistema actual).
