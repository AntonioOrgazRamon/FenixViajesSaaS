# Travel Media Enrichment System

Sistema de enriquecimiento visual para viajes del catálogo usando **APIs oficiales** (Unsplash como fuente principal, Pexels como respaldo). No hay scraping de buscadores, ni binarios pesados en disco en esta fase: se almacenan **URLs y metadatos** en base de datos para lectura rápida en propuestas y UI.

## Arquitectura (resumen)

1. **Disparo**: al aprobar un `TravelTrip` o al actualizarlo si sigue en `APPROVED` y cambian señales usadas para las queries (`title`, `mainDestination`, `description`), se programa un job asíncrono (`setImmediate`) que no bloquea la respuesta HTTP.
2. **Job** (`TravelMediaJob`): estados `PENDING` → `RUNNING` → `SUCCESS` | `PARTIAL` | `FAILED`.
3. **Queries**: módulo `travel-media-query-builder.ts` — combina destino principal, países/ciudades de relaciones, highlights e itinerario para varias búsquedas temáticas (naturaleza, cultura, atmósfera), evitando el uso exclusivo del título.
4. **Providers**: interfaz común (`TravelImageSearchProvider`); implementaciones `unsplash.provider.ts` y `pexels.provider.ts`.
5. **Persistencia** (`TravelMediaAsset`): filas por imagen; exactamente una `isPrimary = true` por viaje tras cada ejecución exitosa (los assets previos del trip se sustituyen en la misma corrida).
6. **Consumo en propuestas**: `getPrimaryHeroImageByTripIds` en `travel-media-resolve.ts` — **solo lectura Prisma**. La generación de HTML/PDF **no** llama a Unsplash/Pexels; solo inyecta URLs ya guardadas.
7. **Smart proposal / cards**: `SmartProposalService.getState` enriquece `recommendedTrips` con `heroImageUrl` desde la misma lectura de BD.
8. **PDF (Puppeteer)**: tras cargar el HTML, se espera un breve margen para que imágenes remotas (CDN del proveedor) se pinten en el lienzo.

## Modelos Prisma

- `TravelMediaAsset`: `companyId`, `tripId`, `sourceProvider`, `queryUsed`, `imageUrl`, `thumbnailUrl`, dimensiones, crédito de fotógrafo, `providerAssetId`, `isPrimary`, `orderIndex`, `metadataJson`, etc.
- `TravelMediaJob`: trazabilidad de ejecución, `querySummary`, `providerUsed`, `assetsCreated`, errores.

Índices relevantes: `tripId`, `companyId`, `providerAssetId`, `isPrimary`.

## Configuración (env)

| Variable | Descripción |
|----------|-------------|
| `TRAVEL_MEDIA_ENABLED` | `true`/`1`/`yes` (por defecto en código: activado si se omite) |
| `TRAVEL_MEDIA_PROVIDER` | `unsplash` (defecto) o `pexels` — el otro actúa de fallback si tiene clave |
| `TRAVEL_MEDIA_MAX_IMAGES` | Máximo de assets por viaje tras cada job (1–20, defecto 5) |
| `UNSPLASH_ACCESS_KEY` | Clave de la [Unsplash API](https://unsplash.com/developers) |
| `PEXELS_API_KEY` | Clave de la [Pexels API](https://www.pexels.com/api/) |

Sin claves válidas el servicio registra advertencia y no rompe flujos; las propuestas siguen con placeholders o sin hero.

## Cache y coste

- **Cache lógica**: una vez escritos los `TravelMediaAsset`, todas las lecturas posteriores son desde MySQL; no se re-consulta el proveedor en cada generación de propuesta.
- **Re-ejecución**: nueva aprobación o actualización relevante del viaje **reemplaza** los assets del trip (nuevo job).
- **Costes API**: dependerán de los planes Unsplash/Pexels y del volumen de viajes aprobados/actualizados. Hay un pequeño `sleep` entre queries para no martillar rate limits.

Consultar siempre las condiciones de uso actuales de cada proveedor y mostrar el crédito al fotógrafo donde exija la licencia (metadatos ya guardados en BD para uso en plantillas).

## Workflow operativo

```text
TravelTrip → APPROVED (o update con señal relevante)
    → scheduleTravelMediaEnrichment(companyId, tripId)
    → TravelMediaEnrichmentService.runForTrip
    → providers.searchLandscapes por cada query
    → dedupe + primary + persistencia
Propuestas / smart-proposal → getPrimaryHeroImageByTripIds → HTML/PDF/UI
```

## QA

Scripts en `apps/api/package.json`:

- `npm run qa:travel-media` — ejecuta (o inspecciona) enriquecimiento para `QA_COMPANY_ID` y opcionalmente `QA_TRIP_ID`; muestra tiempos y conteos de assets/jobs.
- `npm run qa:travel-media-proposals` — estadísticas de assets; con `QA_LEAD_ID` comprueba que `SmartProposalService.getState` expone `heroImageUrl` y cuenta `<img>` en la última versión HTML.

Variables: `QA_COMPANY_ID`, opcionales `QA_TRIP_ID`, `QA_LEAD_ID`.

## Riesgos y límites legales

- Las imágenes están sujetas a las **licencias de Unsplash / Pexels** y a sus políticas de atribución y uso comercial; este módulo guarda URLs y metadatos de crédito para cumplir en plantillas.
- Las URLs pueden cambiar o dejar de estar disponibles en el CDN del proveedor; mitigación: re-ejecutar el job o sustituir por placeholder en plantilla.
- **No** sustituye el asesoramiento legal; revisar contratos y uso de marca en entornos enterprise.

## Extensiones futuras (sin compromiso)

- Proxy propio o CDN con copias caché de imágenes (hoy solo URLs).
- Señales adicionales en catálogo/demo reutilizando `getPrimaryHeroImageByTripIds` en listados.
- Dedupe “visual” más estricto (hashes perceptuales) si el volumen lo exige.

## Referencias en código

- Servicio: `apps/api/src/services/travel/media/travel-media-enrichment.service.ts`
- Resolución solo-BD: `apps/api/src/services/travel/media/travel-media-resolve.ts`
- Plantilla propuesta: `apps/api/src/services/proposals/proposal-html-template.ts`
- Integración generación: `apps/api/src/services/proposals/proposal-generation.service.ts`
