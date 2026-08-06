# LeadTravelProfile (perfil de viaje del lead)

## Resumen

`LeadTravelProfile` es la **fuente estructurada** que negocio usa antes de generar propuestas: destino, actividades, fechas, presupuesto, tipo de viaje y aeropuerto de salida. Coexiste con el CRM legacy (`Lead.message`, `Lead.normalizedPayload`, `LeadDetail.travelContext`) **sin borrar nada**.

## Auditoría del modelo anterior (Fase 1)

| Dato | Dónde se guardaba |
|------|-------------------|
| Nombre / email / teléfono | `Lead.firstName`, `lastName`, `fullName`, `email`, `phone` |
| Mensaje libre | `Lead.message` |
| Intención heurística / formularios | `Lead.normalizedPayload` (p. ej. `travel`, `contact`) |
| Contexto enriquecido / extractor IA | `LeadDetail.travelContext`, `currentContext`, otros JSON |
| Propuestas / intent resuelto | `ProposalVersion.intentSnapshot`, motor `TravelSearchIntent` |

**Gaps previos:** no había tabla 1:1 con campos de negocio (presupuesto por persona vs total, tipo de viaje enum, aeropuerto de salida, actividades estructuradas). Todo dependía de JSON heterogéneo + mensaje libre.

## Nuevo modelo (Prisma)

- Tabla `lead_travel_profiles` / modelo `LeadTravelProfile`
- Relación **1:1** con `Lead` (`lead.travelProfile`)
- Enums: `TravelLeadBudgetType`, `TravelLeadTripType`

Campos principales: destino texto, `preferredDestinations` / `activityTags` JSON, fechas texto o `travelDateFrom` / `To`, `flexibleDates`, **`durationDays` (duración orientativa en días)**, presupuesto (`budgetAmount`, `budgetCurrency`, `budgetType`), `tripType`, aeropuerto texto/código, `rawFormPayload`.

## Prioridad de intención (recomendación / propuestas)

Orden de snapshots en `buildLeadIntentSnapshots` → `buildTravelSearchIntentFromSnapshots`:

1. `Lead.normalizedPayload`
2. `LeadDetail.travelContext`
3. `LeadDetail.currentContext`
4. `{ message: Lead.message }`
5. **`LeadTravelProfile`** (último → **gana** sobre lo anterior)
6. En `ProposalService.generateForLead`, `body.intentSnapshot` se añade **al final** de la cadena (prioridad máxima si el API lo envía)

Regla de producto: **perfil estructurado > manual en JSON > travelContext > mensaje > heurísticas**; la API de propuesta puede forzar un snapshot último.

## Mapeo a `TravelSearchIntent`

- `destinationText` / preferidos → `destination`, `preferredDestinations`
- Actividades / tags → `preferences`, `tags`, `travelStyleAxes` (p. ej. luna de miel → `HONEYMOON`)
- Fechas → `approximateStartDate`, `month`
- **Duración en días** → `durationDays` en el snapshot de viaje (influye scoring / constraints)
- Presupuesto: `PER_PERSON` → `budgetPerPerson`; `TOTAL` → `totalBudget`; `UNKNOWN` + importe → heurística suave como `budgetPerPerson` para no perder señal (ver mapper)
- Tipo de viaje → etiqueta humana + ejes
- Aeropuerto → `departureAirport`

Código: `lead-travel-profile.mapper.ts`, ampliación de `proposal-intent.mapper.ts`, `intentEffectiveBudgetPerPerson` en `travel-search.schema.ts`.

## API (multi-tenant)

- `POST /api/v1/leads` — `name`, `email`, `phone`, `message`, `travelProfile?`
- `GET /api/v1/leads/:leadId/travel-profile` — `{ data: perfil | null }`
- `PATCH /api/v1/leads/:leadId/travel-profile` — upsert parcial por `companyId`

## Frontend

- `/leads/new` — alta con perfil opcional
- Ficha lead — panel **Perfil de viaje** (`PATCH` perfil)

## Propuestas HTML/PDF

Sección **“Datos clave del viaje (negocio)”** en `proposal-html-template.ts`, datos desde `buildKeyClientTravelLines` en `proposal-generation.service.ts`.

## QA

```bash
cd backend
npm run qa:lead-travel-profile
```

Opcional: `QA_COMPANY_ID`. Si no hay viajes aprobados, la generación HTML puede omitirse con WARN.

## Migración

`apps/api/prisma/migrations/20260521150000_lead_travel_profile/migration.sql`  
`apps/api/prisma/migrations/20260521160000_lead_travel_profile_duration_days/migration.sql` — columna `duration_days`
