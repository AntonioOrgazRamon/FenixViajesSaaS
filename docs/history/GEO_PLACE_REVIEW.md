# Revisión operativa GeoPlace / TripGeoPlace

Documento de **estado y comandos ejecutados** en la sesión de validación (sin borrar datos de negocio). Multi-tenant: todo por `companyId`.

## Empresa usada

| Campo | Valor |
|--------|--------|
| Nombre | Fenix Viajes |
| `companyId` | `ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3` |
| Slug | `fenixviajes` |

Detección: `npm run geo:list-companies` (o consulta equivalente en BD).

## Corrección previa al migrate

- **Problema:** existía la carpeta vacía `backend/prisma/migrations/20260206140000_travel_geo_model/` **sin** `migration.sql`, lo que provocaba **P3015** y bloqueaba `prisma migrate deploy`.
- **Acción:** eliminar solo esa carpeta huérfana del árbol de migraciones (no toca datos MySQL).
- **Migración válida del modelo geo:** `20260520103000_travel_geo_model`.

## Comandos ejecutados y resultado

| Comando | Resultado |
|---------|-----------|
| `npx prisma validate` | Esquema válido |
| `npx prisma migrate status` | Tras deploy: **Database schema is up to date** |
| `npx prisma migrate deploy` | Aplicada `20260520103000_travel_geo_model` correctamente |
| `npx prisma generate` | En este entorno: **EPERM** renombrando `query_engine-windows.dll.node` (bloqueo típico de proceso/antivirus en Windows). **Repetir en tu máquina** con IDE/antivirus sin bloqueo sobre `node_modules/.prisma`. |
| `npx tsc --noEmit` | OK |
| `npm run geo:backfill -- --companyId=ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3` | **0** upserts: no hay filas en `destinations` para este tenant |
| `npm run geo:validate -- --companyId=...` | **3** WARN: viajes APPROVED sin `TripGeoPlace` |
| `npm run geo:report -- --companyId=...` | Ver tabla resumen abajo |
| `npm run geo:seed-hierarchy -- --companyId=... --apply` | Creados **7** nodos (6 `CONTINENT` + 1 `MACRO_REGION` Océano Índico bajo Oceanía). Sin enlaces país/ciudad (no hay `GeoPlace` legacy) |
| `npm run geo:test-retrieval` (varios destinos) | Ver sección “Retrieval por zonas” |
| `npm run geo:smoke-compare-flag -- --companyId=... --destination=Vietnam` | Sin diferencias vs baseline (sin contexto geo útil) |
| `npm run smoke:recommendation` | OK |
| `npm run e2e:diagnose` | Flujo propuesta OK con datos locales; llamada OpenAI del extractor puede fallar con **429 quota** (no bloquea validación geo) |

## Tabla resumen (PASO 3)

| Métrica | Valor |
|---------|------:|
| Total `Destination` | 0 |
| Total `GeoPlace` | 7 |
| Total `TravelTripDestination` | 0 |
| Total `TripGeoPlace` | 0 |
| Viajes APPROVED sin `TripGeoPlace` | 3 |
| `GeoPlace` sin `parentId` (excl. legacy macro/continente en métricas agregadas) | coherente con solo macrozonas raíz |
| Candidatos duplicados por `normalizeKey(canonicalName)` | 0 |
| Heurística países sin continente | 0 (no hay países) |
| Heurística ciudades sin país | 0 (no hay ciudades) |
| Huérfanos operativos | **Catálogo legacy incompleto**: viajes publicados sin filas en `travel_trip_destinations` |

## Auditoría de jerarquía (PASO 4)

- El modelo actual en BD **no** es una copia plana de `Destination`: es una **macro-jerarquía semilla** (`externalRef=geo-seed-hierarchy:v1`) hasta que existan nodos país/ciudad desde backfill.
- No hay duplicados semánticos detectados (sin datos país/ciudad).
- Clusters tipo Japón/Japan o Maldivas/Maldives: **sin coincidencias** hasta poblar `GeoPlace` desde destinos.

## Normalización segura (PASO 5–6)

Scripts añadidos:

- `npm run geo:audit` — informe jerárquico + grupos de alias (solo lectura).
- `npm run geo:normalize` — dry-run por defecto; `--apply` delega en la misma lógica que `geo:seed-hierarchy --apply` (upserts seguros, sin merges ni deletes).
- `npm run geo:seed-hierarchy` — plan dry-run por defecto; `--apply` crea continentes + `Océano Índico` y enlaza país/ciudad **solo** con coincidencia única y `parentId` null.

Maldivas: el enlace exige que exista la macro **`Océano Índico`** (se crea con `--apply`) **y** un `GeoPlace` candidato para Maldivas (tras backfill).

## Retrieval por zonas (PASO 7)

Con datos actuales (sin `TripGeoPlace`, solo macrozonas):

| Intención | Resultado |
|-----------|-----------|
| `Asia` | Resuelve continente (`expandedSize=1`), **0** candidatos trip → `PREFILTER_SKIPPED_LT_3` → fallback |
| `Japón` | `NO_GEO_PLACE_FOR_INTENT` (no existe nodo país/ciudad en catálogo geo) |
| `Tokio` | Idem |
| `Maldivas` | Idem |
| Destino desconocido | `NO_GEO_PLACE_FOR_INTENT` → mismo comportamiento que sin grafo (fallback textual en pipeline) |

Con **`Travel_TRIP_DESTINATION` + backfill** + jerarquía país/ciudad enlazada, los casos 1–4 pasan a depender de expansión BFS y de `trip_geo_places` (ver tests tras datos).

## Flag `TRAVEL_GEO_RETRIEVAL_ENABLED` (PASO 8)

- **No** se ha dejado activado en `.env` en esta sesión (petición explícita).
- Prueba equivalente: `npm run geo:smoke-compare-flag` inyecta contexto geo en `runTravelRecommendation` sin variable global.
- **Conclusión:** con el estado actual del tenant (**sin** destinos/`TripGeoPlace`), activar el flag **no mejora ranking** y **no rompe** resultados (fallback idéntico en la prueba Vietnam).  
- **Para producción:** activar solo cuando `geo:report` muestre cobertura alta de `trip_geo_places` y `geo:smoke-compare-flag` no reduzca recall de forma indeseada.

## Cambios en código (esta entrega)

| Archivo | Cambio |
|---------|--------|
| Eliminado `prisma/migrations/20260206140000_travel_geo_model/` | Carpeta vacía que rompía migrate |
| `scripts/geo-metrics.ts` | Métricas reutilizables |
| `scripts/geo-report.ts` | Wrapper sobre métricas |
| `scripts/geo-list-companies.ts` | Lista tenants |
| `scripts/geo-audit.ts` | Auditoría PASO 4 |
| `scripts/geo-normalize.ts` | Dry-run / `--apply` seguro |
| `scripts/geo-seed-hierarchy.ts` | Semilla macrojerarquía + enlaces seguros |
| `scripts/geo-smoke-compare-flag.ts` | Comparación pipeline sin tocar `.env` |
| `scripts/geo-validate.ts` | Corregido bug `geoNoParent` duplicado |
| `scripts/geo-seed-hierarchy.ts` | `nkSet` ignora claves vacías; alias Japón sin carácter problemático |
| `package.json` | Scripts npm nuevos |
| `docs/TRAVEL_GEO_MODEL.md` | Checklist operativo + tabla scripts |
| `docs/GEO_PLACE_REVIEW.md` | Este informe |

## Riesgos pendientes

1. Catálogo APPROVED sin `travel_trip_destinations` → backfill inútil hasta corregir datos de importación.
2. `prisma generate` EPERM local debe resolverse antes de CI/despliegue en Windows.
3. Resolución ambigua de ciudades/homonimia cuando existan muchos `GeoPlace`.
4. Prefiltro geo puede acotar pool cuando haya muchos `TripGeoPlace`; validar siempre con `geo:smoke-compare-flag`.

## Siguientes pasos (máximo 5)

1. Poblar **`Destination` + `TravelTripDestination`** para los viajes APPROVED (pipeline de importación o corrección manual controlada).
2. Ejecutar **`npm run geo:backfill`** de nuevo y revisar `geo:report`.
3. Ejecutar **`geo:seed-hierarchy --apply`** (tras revisar dry-run) para enlazar países/ciudades cuando existan candidatos únicos.
4. Repetir **`geo:test-retrieval`** para Asia / Japón / Tokio / Maldivas y **`geo:smoke-compare-flag`** con intents reales.
5. Solo entonces fijar **`TRAVEL_GEO_RETRIEVAL_ENABLED=true`** en `.env` y monitorizar `telemetry.counts.geoPrefilterActive` y `retrievalPool`.
