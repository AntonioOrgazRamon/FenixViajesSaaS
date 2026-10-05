# Motor de recomendación (viajes) — estado y operación

## Flujo oficial

1. **Intención** (`TravelSearchIntent`): API `POST /api/v1/travel/trips/search-intent`, `TravelSearchService.searchByIntent`, o propuestas que construyen intent desde lead.
2. **`runTravelRecommendation`**: validación catálogo → (opcional Fase 2) retrieval híbrido → por cada viaje elegible: **constraints** → **scoring** → lista elegible.
3. **Diversidad** (`reorderWithDiversity`) sobre la lista elegible.
4. **Slots comerciales** (`pickCommercialSlots`): RECOMMENDED, BUDGET, LUXURY, ALTERNATIVE.
5. **Propuesta formal** (`ProposalGenerationService`): mismo motor cuando no hay lista manual; HTML/PDF y `ProposalVersion`.

**Smart proposal** (UI “propuesta inteligente”): delega en **`TravelSearchService.searchByIntent`** (mismo motor y mismos slots que la búsqueda por intención).

## Feature flags (env)

| Variable | Default actual | Efecto |
|----------|----------------|--------|
| `TRAVEL_HYBRID_RETRIEVAL_ENABLED` | **`false`** (vacío = apagado) | `true` / `1` / `yes` activa Fase 2 (pool híbrido + embedding de intención en request). |
| `OPENAI_API_KEY` | opcional | Sin clave: Fase 2 no puede embeddar intención; el canal vector queda en 0 (el resto sigue). |

Con flag **apagado**, el comportamiento es **Fase 1 sobre todo el catálogo APPROVED** (sin recorte por pool híbrido).

## Qué está activo / desactivado

- **Activo por defecto:** Fase 1 (constraints, scoring, diversidad, slots, persistencia opcional de `RecommendationRun`).
- **Desactivado por defecto:** retrieval híbrido y uso práctico de embeddings en el pipeline HTTP (código presente, no ejecuta rama híbrida).

## Cómo probar Fase 1

```bash
cd apps/api
# Sin híbrido (default si no pones env)
npm run test:travel-search
```

Opcional explícito en `.env`:

```env
TRAVEL_HYBRID_RETRIEVAL_ENABLED=false
```

## Cómo activar Fase 2 en piloto

1. Aplicar migraciones (incl. `travel_trip_embeddings`).
2. En `.env`: `TRAVEL_HYBRID_RETRIEVAL_ENABLED=true` y `OPENAI_API_KEY=...`.
3. Generar vectores de catálogo: `npm run travel:embed -- --companyId=<uuid>` (ver script).
4. Revisar coste/latencia y recall (pool cap configurable en código: `HYBRID_RETRIEVAL_POOL_CAP`).

## Comandos útiles

```bash
cd apps/api
npx prisma migrate deploy
npx prisma migrate status
npx prisma validate
npx tsc --noEmit
npm run test:travel-search
npm run smoke:recommendation
npm run test:hybrid-retrieval   # pruebas parciales Fase 2 (p. ej. con DATABASE_URL)
```

```bash
cd apps/panel
npm run build
```

## Riesgos conocidos

- **`prisma generate`** puede fallar en Windows con `EPERM` si otro proceso bloquea `query_engine-windows.dll.node`; cerrar procesos y repetir.
- Con Fase 2 **activa** y catálogo grande, el **top-K del híbrido** puede excluir viajes que solo el scoring global vería (mitigar con flag off o mayor pool tras validación).
- Persistencia de `RecommendationRun` requiere migración **Fase 1** aplicada.

## Endpoints oficiales de recomendación

- Búsqueda por intención (motor completo): **`POST /api/v1/travel/trips/search-intent`**.
- Admin embeddings / preview (Fase 2, no necesarios con flag off): bajo `/api/v1/travel/trips/embeddings/*` y `/retrieval/preview` (ver `trip.routes.ts`).
