# Modelo geográfico de viajes (GeoPlace / TripGeoPlace)

Este documento describe la **capa geo progresiva** que convive con el modelo legacy (`Destination`, `TravelTripDestination`, `TravelTrip.mainDestination`) sin eliminarlo.

## Modelo actual (legacy)

- **`Destination`**: nombre + `DestinationKind` plano (`COUNTRY`, `REGION`, `CITY`, `AREA`, `ATTRACTION`) + `normalizedName`.
- **`TravelTripDestination`**: N destinos por viaje con `orderIndex`.
- **`TravelTrip.mainDestination`**: texto libre para UX / dossier.
- **Matching**: principalmente **léxico** sobre `mainDestination`, nombres de destinos y corpus del viaje (`travel-search.scoring`, `scoring.engine`).
- **Limitación**: no hay grafo continente → país → ciudad continuo; el retrieval por intención cargaba **todos** los viajes `APPROVED` antes de puntuar (coste CPU/memoria crece con el catálogo).

## Modelo nuevo (progresivo)

- **`GeoPlace`** (por empresa, `companyId` obligatorio):
  - Jerarquía opcional `parentId` → autoself `GeoPlace`.
  - `kind`: `CONTINENT`, `MACRO_REGION`, `COUNTRY`, `REGION`, `CITY`, `ISLAND`, `AREA`, `ATTRACTION`, `POI`.
  - `canonicalName`, `normalizedKey` estable (`buildGeoNormalizedKey`), `externalRef`, `legacyDestinationId` (traza del backfill).
  - Índices: `(companyId, normalizedKey)`, `(companyId, kind)`, `parentId`.
- **`TripGeoPlace`**:
  - Enlace `(tripId, geoPlaceId)` con `role`: `PRIMARY`, `STOP`, `TRANSIT`, `OPTIONAL`.
  - `orderIndex`, `confidence`, `source`: `MANUAL`, `IMPORT`, `AI`, `BACKFILL`.

**Dual-read**: las APIs y el dossier siguen leyendo destinos legacy; el motor puede usar `TripGeoPlace` cuando hay datos y flags activos.

## Migración SQL

- Migración: `backend/prisma/migrations/20260520103000_travel_geo_model/migration.sql`.
- **Solo añade tablas** `geo_places` y `trip_geo_places` + FKs; **no borra** tablas ni columnas legacy.
- Si aparece error **P3015** (“Could not find migration file”), revisa que no exista una carpeta vacía bajo `prisma/migrations/` sin `migration.sql` (en el repo se eliminó el folder huérfano `20260206140000_travel_geo_model` que bloqueaba `migrate deploy`).

## Checklist operativo (orden recomendado)

Desde `backend/`:

1. `npx prisma validate`
2. `npx prisma migrate status` → si hay pendientes, `npx prisma migrate deploy`
3. `npx prisma generate` (si falla **EPERM** en Windows al renombrar `query_engine`, cerrar procesos que bloqueen `.dll` / antivirus y repetir)
4. `npx tsc --noEmit`
5. `npm run geo:list-companies` → elegir `companyId`
6. `npm run geo:backfill -- --companyId=...` (requiere filas en `destinations` / `travel_trip_destinations`)
7. `npm run geo:seed-hierarchy -- --companyId=...` (dry-run) → revisar plan → `npm run geo:seed-hierarchy -- --companyId=... --apply` si procede
8. `npm run geo:report` / `npm run geo:audit` / `npm run geo:validate`
9. `npm run geo:test-retrieval -- --companyId=... --destination="..."` y `npm run geo:smoke-compare-flag -- --companyId=...`
10. Solo entonces valorar `TRAVEL_GEO_RETRIEVAL_ENABLED=true` en `.env`

**Importante:** si los viajes solo tienen `mainDestination` pero **no** hay `TravelTripDestination`, el backfill creará **0** `GeoPlace`/`TripGeoPlace`. Hay que rellenar el catálogo legacy de destinos (importación o datos) antes de que la capa geo aporte valor.

## Backfill

- Script: `npm run geo:backfill -- --companyId=<uuid>` o `--allCompanies`.
- Crea **`GeoPlace` con el mismo `id` que `Destination`** para simplificar el mapeo (`TripGeoPlace.geoPlaceId` = antiguo `destinationId`).
- `TripGeoPlace` desde `TravelTripDestination`: primer destino ordenado → `PRIMARY`, resto → `STOP`, `source=BACKFILL`.
- Lo que **no** infiere el backfill (jerarquía continente–país, duplicados semánticos): **revisión manual** en `GeoPlace.parentId` y limpieza de nombres.

## Uso en matching y recomendación

1. **`TravelSearchService`** enriquece cada fila con `tripGeoPlaces` + ancestros (`enrichTripSearchRowsWithGeoPlaces`).
2. **`TripGeoRetrievalService`** (si `TRAVEL_GEO_RETRIEVAL_ENABLED=true`):
   - Resuelve texto de intención → `GeoPlace` (`GeoPlaceService.resolveIntentToGeoPlaces`).
   - Expande **ascendientes + descendientes** con `expandGeoPlaceClosure` (profundidad `TRAVEL_GEO_CLOSURE_MAX_DEPTH`).
   - Obtiene **candidatos** `tripId` vía `trip_geo_places` ∩ expansión.
   - Si hay menos de `TRAVEL_GEO_PREFILTER_MIN_MATCHES` candidatos → **no** aplica prefiltrado; sigue el catálogo completo (fallback).
   - Si aplica prefiltrado: el pool no-relajado = **unión** de `{ trips que matchean geo } ∪ { trips APPROVED sin ningún TripGeoPlace }` para no **silenciar** viajes aún no enlazados.
3. **`destinationPoints` / `scoreTripBreakdown`**:
   - Mantiene **cap léxico** (0–30).
   - Añade **bonus** si algún `TripGeoPlace` cae en raíz/expansión de la intención (directo, ascendiente o descendiente implícito en el set expandido).
   - **Penalización** si hay enlaces geo pero **ninguno** relacionado con la expansión (viajes mal etiquetados).
   - Viajes **sin** `TripGeoPlace`: sin penalización geo (siguen solo léxico).
4. **Hybrid retrieval** (Fase 2): el canal structured usa la misma función `destinationPoints` con contexto geo cuando está disponible.

### Variables de entorno

| Variable | Default | Efecto |
|----------|---------|--------|
| `TRAVEL_GEO_RETRIEVAL_ENABLED` | off | Activa planificación geo + prefiltrado opcional. |
| `TRAVEL_GEO_PREFILTER_MIN_MATCHES` | 3 | Mínimo de viajes geo-candidatos para acotar pool. |
| `TRAVEL_GEO_CLOSURE_MAX_DEPTH` | 14 | Profundidad BFS subiendo/bajando la jerarquía. |

## Cómo corregir zonas (manual)

1. Crear nodos macro (`CONTINENT`, `MACRO_REGION`) y enlazar `parentId` de países/regiones/ciudades.
2. Ajustar `TripGeoPlace.role` (`PRIMARY` vs `STOP`) para reflejar circuito vs escala.
3. Usar `externalRef` (ej. geonames) cuando integres fuentes externas.
4. Tras cambios, ejecutar `npm run geo:validate -- --companyId=...`.

## Validación (`geo:validate`)

Reporta (entre otros):

- Viajes `APPROVED` sin ningún `TripGeoPlace`.
- `legacy_destination_id` duplicado en `geo_places`.
- Divergencias **informativas** entre `mainDestination` y geo `PRIMARY`.
- Países sin padre “tipo continente” (heurística: padre `CONTINENT` o `MACRO_REGION`; el resto queda como **INFO** para revisión).

## Qué queda legacy

- Tablas `destinations` y `travel_trip_destinations` siguen siendo fuente de verdad operativa hasta migración completa.
- `mainDestination` sigue publicándose en dossier / texto.
- Matching sin backfill o con flag geo desactivado = comportamiento **léxico histórico**.

## Cómo comprobar organización por zonas

1. `npx prisma migrate deploy` (o dev migrate) + `npm run geo:backfill -- --companyId=...`.
2. Crear jerarquía mínima en BD (ej. `Asia` → `Japón` → `Tokio`) vía SQL o herramienta admin.
3. `npm run geo:test-retrieval -- --companyId=... --destination="Asia"` → lista `candidateTrips` que incluye viajes etiquetados en descendientes.
4. Activar `TRAVEL_GEO_RETRIEVAL_ENABLED=true` y observar en logs (con `telemetryVerbose`) las notas `geoNotes` del plan.
5. Comparar tiempos/tamaño de pool: `telemetry.counts.retrievalPool` y `geoPrefilterActive` cuando el prefiltrado aplica.

## Riesgos pendientes

- **Resolución ambigua** (“Granada” país vs ciudad): `resolveIntentToGeoPlaces` puede devolver varias raíces; conviene feedback humano y datos `parentId`.
- **Calidad del grafo**: sin padres correctos, expansión y bonus geo pueden ser ruidosos.
- **Duplicados semánticos** mismos lugares con distinto `normalizedKey`: mitigado por unicidad `(companyId, normalizedKey, kind)` pero no por sinónimos.
- **Prefiltro + viajes sin geo**: la unión con “viajes sin enlaces” mantiene recall pero reduce algo el beneficio de CPU hasta que todo el catálogo tenga `TripGeoPlace`.

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run geo:list-companies` | Lista empresas (`id`, nombre, slug). |
| `npm run geo:backfill` | `Destination` → `GeoPlace`, `TravelTripDestination` → `TripGeoPlace`. |
| `npm run geo:report` | Métricas agregadas (totales, calidad, muestras). |
| `npm run geo:audit` | Auditoría jerárquica + clusters semánticos (sin fusionar). |
| `npm run geo:normalize` | Dry-run: métricas + plan de `geo:seed-hierarchy`. `--apply` ejecuta la semilla segura. |
| `npm run geo:seed-hierarchy` | Crea continentes + macro `Océano Índico`; enlaza países/ciudades **solo** si existe un único `GeoPlace` candidato y `parentId` es null. |
| `npm run geo:validate` | Informe de inconsistencias (viajes sin geo, etc.). |
| `npm run geo:test-retrieval` | Plan de expansión/candidatos (`bypassFeatureFlag`). `--smoke` sin DB. |
| `npm run geo:smoke-compare-flag` | Compara `runTravelRecommendation` sin vs con `geoScoringContext`/prefiltro (sin tocar `.env`). |

### Activación del flag

No cambies `.env` hasta tener `TripGeoPlace` para la mayoría de viajes relevantes y haber validado `geo:smoke-compare-flag`. El código ya hace **fallback** al catálogo completo cuando no hay candidatos geo o el prefiltrado no alcanza el mínimo configurado.

Estado detallado de la última corrida local: ver `docs/GEO_PLACE_REVIEW.md`.
