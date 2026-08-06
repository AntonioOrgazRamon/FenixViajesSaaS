# Modelo de datos: propuestas comerciales de viajes

## Objetivo

Persistir propuestas reales por lead, con versionado e histórico de viajes seleccionados, **aisladas por `companyId`**. El campo legacy `LeadDetail.travelContext` sigue siendo el mecanismo ligero actual; las tablas nuevas son la base para API y reporting sin sustituir ese JSON hasta que se integren los servicios.

## Enum `ProposalStatus`

| Valor | Uso |
| --- | --- |
| `DRAFT` | Borrador |
| `GENERATED` | Contenido (HTML/PDF) generado |
| `SENT_TO_SELLER` | Enviada internamente |
| `SENT_TO_CLIENT` | Enviada al cliente |
| `ARCHIVED` | Archivada |

## Modelos principales

### `Proposal` (`proposals`)

Cabecera por lead: tenant, ownership, estado comercial.

- Relaciones: `Company`, `Lead`, `User` (creador / asignado opcional), `ProposalVersion[]`.

### `ProposalVersion` (`proposal_versions`)

Snapshot versionado: intención, HTML generado, PDF (path/URL).

- `versionNumber`: único por `proposalId`.
- Relaciones: `Company`, `Proposal`, `User` (opcional), `ProposalTrip[]`, `ProposalArtifact[]`.

### `ProposalTrip` (`proposal_trips`)

Viajes del catálogo incluidos en una versión concreta.

- `orderIndex`, `score`, `reasons` (JSON).
- FK a `TravelTrip` con **RESTRICT** al borrar el viaje si sigue referenciado.

### Extensión: `ProposalArtifact` (`proposal_artifacts`)

Adjuntos o ficheros extra por versión (`PDF`, `HTML_FILE`, `ATTACHMENT`, `OTHER`). El PDF principal puede vivir en `ProposalVersion` (`pdf_storage_path` / `pdf_public_url`).

## Multi-tenant

Todas las tablas llevan `company_id` con FK a `companies` y **cascade** al eliminar la empresa. En servicios: siempre filtrar por `{ id, companyId }` (o derivar `companyId` del lead/propuesta y validar coherencia al escribir).

## Contratos TypeScript / Zod

`src/modules/proposals/proposal.schema.ts`: enums y schemas para crear propuesta + primera versión, añadir versión, parchear cabecera y artefactos.

## Índices

Filtrado por empresa + lead/estado, por `proposalId` + fechas, unicidad `(proposalId, versionNumber)` y `(proposalVersionId, travelTripId)`, e índices en `travel_trip_id` para impacto en catálogo.

## Migración

`prisma/migrations/20260518120000_travel_proposals/migration.sql`  
`prisma/migrations/migration_lock.toml` (`provider = mysql`)

## Compatibilidad con `travelContext`

El endpoint `POST /api/v1/travel/leads/:leadId/proposal` solo actualiza `LeadDetail.travelContext` (no escribe en `Proposal`). Hasta que se duplique la escritura en servicio, **no hay divergencia introducida por el schema**: coexisten ambos mundos.

## Riesgos

1. **Doble fuente de verdad**: `travelContext` vs tablas `Proposal*` hasta sincronizar en código.
2. **RESTRICT en `travelTripId`**: borrar un `TravelTrip` fallará si hay `proposal_trips`; hay que quitar filas o usar soft-delete en catálogo.
3. **`companyId` duplicado** en versiones/viajes: debe igualarse al de la propuesta/lead en cada `create`; no lo valida la BD entre tablas distintas.
4. **Migración y orden**: aplicar migraciones en entornos compartidos antes de desplegar código que use el cliente Prisma nuevo.

## Ejemplo JSON (vista API anidada)

Representación lógica de lectura (no es un endpoint existente):

```json
{
  "proposal": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "companyId": "11111111-2222-3333-4444-555555555555",
    "leadId": "22222222-3333-4444-5555-666666666666",
    "createdByUserId": "33333333-4444-5555-6666-777777777777",
    "assignedUserId": null,
    "status": "GENERATED",
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:30:00.000Z"
  },
  "versions": [
    {
      "id": "44444444-5555-6666-7777-888888888888",
      "companyId": "11111111-2222-3333-4444-555555555555",
      "proposalId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "versionNumber": 1,
      "intentSnapshot": {
        "budgetMax": 3500,
        "currency": "EUR",
        "destinations": ["Patagonia"],
        "notesFromSeller": "Cliente prefiere grupos reducidos"
      },
      "generatedHtml": "<html><body><h1>Propuesta …</h1></body></html>",
      "pdfStoragePath": "companies/1111.../proposals/a1b2.../v1.pdf",
      "pdfPublicUrl": null,
      "createdByUserId": "33333333-4444-5555-6666-777777777777",
      "createdAt": "2026-05-18T10:15:00.000Z",
      "trips": [
        {
          "id": "55555555-6666-7777-8888-999999999999",
          "companyId": "11111111-2222-3333-4444-555555555555",
          "travelTripId": "66666666-7777-8888-9999-000000000000",
          "orderIndex": 0,
          "score": 0.92,
          "reasons": {
            "bullets": [
              "Encaja con destino preferido",
              "Duración 12 días dentro del rango"
            ]
          },
          "createdAt": "2026-05-18T10:15:00.000Z"
        }
      ]
    }
  ]
}
```

Payload de creación acotado (alineado con Zod `createProposalWithVersionSchema`):

```json
{
  "leadId": "22222222-3333-4444-5555-666666666666",
  "status": "DRAFT",
  "assignedUserId": null,
  "intentSnapshot": { "budgetMax": 3500, "currency": "EUR" },
  "generatedHtml": null,
  "pdfStoragePath": null,
  "pdfPublicUrl": "",
  "trips": [
    {
      "travelTripId": "66666666-7777-8888-9999-000000000000",
      "orderIndex": 0,
      "score": 0.92,
      "reasons": { "bullets": ["Encaja con destino preferido"] }
    }
  ]
}
```
