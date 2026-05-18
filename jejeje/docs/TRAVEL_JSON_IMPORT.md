# Importación de viajes por JSON (staging)



Flujo **multi‑tenant** para cargar viajes revisados manualmente sin pasar por el importador PDF. Todo entra primero en tablas de **staging** (`TravelJsonImportBatch` / `TravelJsonImportItem`); los `TravelTrip` sólo se crean tras **`POST /api/v1/travel/import-json/batches/:batchId/import`**.



## Modos de entrada



| Modo | Descripción |

|------|-------------|

| **Upload file** | Multipart `POST /upload` con campo `file` (.json). Mismo pipeline que paste. |

| **Paste JSON** | `POST /paste` con cuerpo `{ "jsonContent": "<string>", ... }`. Pensado para pegar salida estructurada (p. ej. ChatGPT) sin archivo. |



Ambos modos comparten **`persistStagingBatch`**: parse → raíz array **o** objeto único → saneado → clasificación por ítem → batch.



## Formato oficial (contrato del sistema)



Cada elemento del array (o el objeto único raíz) debe seguir el **formato enriquecido**:



```json

{

  "source": {

    "documentName": "…",

    "pageStart": 1,

    "pageEnd": 12,

    "rawReference": "…",

    "confidence": 0.94

  },

  "trip": {

    "title": "…",

    "slug": "…",

    "mainDestination": "…",

    "countries": ["…"],

    "cities": ["…"],

    "durationDays": 10,

    "priceFrom": 1899,

    "currency": "EUR",

    "itinerary": [{ "day": 1, "title": "…", "description": "…", "locations": [] }],

    "highlights": ["…"],

    "includedServices": ["…"],

    "excludedServices": ["…"],

    "hotels": [{ "hotelName": "…", "city": "…", "category": "…" }],

    "secondaryDestinations": [],

    "continents": [],

    "regions": [],

    "islands": [],

    "seasonality": [],

    "travelStyles": [],

    "idealFor": [],

    "transport": [],

    "mealPlan": [],

    "importantNotes": [],

    "availabilityNotes": [],

    "requirements": [],

    "rawSnippets": []

  },

  "metadata": {

    "extractionConfidence": 0.92,

    "needsManualReview": false,

    "missingImportantFields": [],

    "possibleProblems": []

  }

}

```



- **`source`**: trazabilidad de extracción (documento, páginas, referencia, confianza opcional del extractor).

- **`trip`**: datos de catálogo que se mapean a `TravelTrip`, destinos, itinerario, servicios, hoteles, etc.

- **`metadata`**: calidad de extracción (`extractionConfidence`, `needsManualReview`, listas de huecos y problemas).

### Itinerario enriquecido (ChatGPT)

- Cada entrada puede usar **`day`** o **`dayNumber`** (entero ≥ 1). Opcional **`locations`**: lista de strings.
- Tras normalizar, **`normalizedJson.trip.itinerary`** sólo usa **`dayNumber`** (alineado con `TripItineraryDay`). El JSON original permanece en **`sourceJson`**.
- Si el array fuente contiene al menos una fila pero alguna carece de día válido, las filas inválidas se descartan y el ítem pasa a **INVALID** (política de longitud fuente vs normalizada).

### Ritmo y estilos

- **`pace`**: se aceptan alias (`moderate`, `balanced`, `medio`, `moderado`, `relaxed`, `intensive`, `fast`, …) y se normaliza a valores canónicos (`BALANCED`, `RELAXED`, `INTENSIVE`). Si no hay reconocimiento, el ítem puede seguir siendo válido con avisos; en BD el ritmo no reconocido se trata como **`UNKNOWN`** al persistir.
- **`travelStyles`**: texto libre (p. ej. etiquetas en español). No invalidan el ítem; cuando hay correspondencia semántica se rellena **`travelStyleAxes`** para tags internos.



Tipado Zod: `backend/src/services/travel/travel-json-import.schema.ts`. Normalización y reglas de negocio: `travel-json-import-validation.ts` (`normalizeEnrichedTravelJsonItem`, `classifyTravelJsonTrip`).



**Persistencia por ítem**



- `sourceJson`: JSON original del ítem (tras saneado anti‑XSS), tal cual llegó.

- `normalizedJson`: objeto enriquecido **normalizado completo** (`source` + `trip` + `metadata`), con strings recortados y listas limpias.



### Compatibilidad: formato plano legado



Si el JSON trae los campos del viaje **en la raíz** (sin `trip`) como en versiones anteriores, el backend los **envuelve** automáticamente en `{ source, trip, metadata }` y migra `metadata.confidence` / `metadata.needsManualReview` antiguos al nuevo bloque `metadata`. No es el contrato recomendado para nuevos prompts: el oficial es siempre **enriquecido**.



Ejemplo completo actualizado: `backend/fixtures/travel-import-sample.json`.



## Mapeo a base de datos



Desde **`normalizedJson.trip`** (tras validación):



| Origen (`trip`) | Destino |

|-----------------|--------|

| `title`, `slug`, `mainDestination`, `durationDays`, `priceFrom`, `currency`, descripciones | `TravelTrip` (`importSlug` desde `slug` normalizado) |

| `highlights[]` | `TripHighlight` |

| `includedServices` / `excludedServices` | `TripCatalogService` INCLUDED / NOT_INCLUDED |

| `itinerary[]` | `TripItineraryDay` |

| `hotels[]` | `TripHotel` |

| `countries`, `regions`, `cities`, `islands`, `secondaryDestinations`, `continents` | `Destination` + `TravelTripDestination` + sincronización geo (`GeoPlace` / `TripGeoPlace`) |



`source` y `metadata` completos se reflejan en observaciones de extracción (`[IMPORT_JSON_META]` dentro del flujo `TripAiExtract`) y en el volcado `rawText` de importación para trazabilidad.



## Validación



**INVALID** si:



- Fallo de parse Zod tras coercion (incl. ausencia de bloque `trip` válido).

- Falta o vacío: `trip.title`, `trip.slug`, `trip.mainDestination`.

- `trip.durationDays` no es entero ≥ 1.

- `trip.priceFrom` negativo o no numérico.

- `trip.itinerary`: si el array fuente no está vacío pero alguna fila no tiene `day` ni `dayNumber` válidos (entero positivo), la normalización pierde filas → **INVALID**.


**WARNING** si (y no hay errores previos):



- `metadata.needsManualReview === true`

- `metadata.extractionConfidence < 0.75`

- Falta `trip.priceFrom`

- `trip.countries` vacío

- `trip.cities` vacío

- `trip.itinerary` vacío

- `trip.highlights` vacío

- `metadata.possibleProblems` no vacío



Los ítems **INVALID** no se importan; **VALID** y **WARNING** sí (salvo slug duplicado en la empresa).



## Endpoints (`/api/v1/travel/import-json`)



| Método | Ruta | Descripción |

|--------|------|-------------|

| POST | `/upload` | Multipart `file` (.json). SUPER_ADMIN: `companyId` query o campo form. |

| POST | `/paste` | Body: `jsonContent`, `fileName` opcional. SUPER_ADMIN: `companyId` en body. |

| GET | `/batches` | Lista lotes. |

| GET | `/batches/:batchId` | Detalle + ítems. |

| PATCH | `/items/:itemId` | Fusiona cambios en `normalizedJson` (recomendado: `{ "normalizedJson": { "trip": { ... } } }`) y revalida. |

| POST | `/batches/:batchId/import` | Persiste viajes válidos (transacción por ítem + geo). |

| DELETE | `/batches/:batchId` | Borra staging si el lote **no** está `IMPORTED`. |



Roles: **COMPANY_ADMIN** y **SUPER_ADMIN** (catálogo). `COMPANY_USER` no importa.



Seguridad: tamaño máximo `TRAVEL_JSON_IMPORT_MAX_MB` en upload (multer) y paste (UTF‑8); rutas `/api/v1/travel/import-json/*` usan `express.json` con ese tope. Upload: sólo `.json`. Saneado de texto (`<script>`, `javascript:`, handlers `on*`).



Multi‑tenant: `COMPANY_ADMIN` no puede fijar `companyId` ajeno en `/paste`. `SUPER_ADMIN` debe incluir `companyId`.



## GeoPlace y recomendación



Tras crear `TravelTripDestination`, el import llama a `syncTripGeoPlacesFromDestinations`: `GeoPlace` + `TripGeoPlace` con `source = IMPORT`. Los viajes importados quedan en **`PENDING_REVIEW`** hasta aprobación.



## UI



Ruta **`/travel/import`** (“Travel Import Center”): pestañas **Upload file** y **Paste JSON**. Super admin elige empresa antes de validar.



La vista previa lee **`normalizedJson.trip`** y **`normalizedJson.metadata.needsManualReview`**. El editor aplica parches bajo **`trip`** (título, slug, destino, geo básica, precio, highlights, itinerario).



## QA



```bash

cd backend

npm run qa:travel-json-import

npm run qa:travel-json-import -- --companyId=<uuid-empresa>

```



Cubre: fixture enriquecido (Vietnam + avisos + dos Argentina ChatGPT con itinerario `day`), legado plano, objeto único enriquecido en paste, guards multi‑tenant, contrato flexible (`day`/`dayNumber`, estilos ES, `pace`), smoke opcional (upload + paste + import real y lotes de dos viajes).


## Cómo corregir errores



1. Subir o pegar JSON → revisar **INVALID** / **WARNING** por ítem.

2. **Editar** en UI (o `PATCH` API) campos dentro de `normalizedJson.trip`.

3. **Importar** de nuevo (omite inválidos y duplicados por slug).



Los PDF y el pipeline histórico (`/travel/documents`) **no se modifican**.


