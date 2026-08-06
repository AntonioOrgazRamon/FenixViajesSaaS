# Auditoría sistema travel (clean run, sin OpenAI en propuestas)

**Empresa:** Fenix Viajes  
**companyId:** `ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3`  
**Fecha ejecución:** 2026-05-19 (local)  
**Preflight recomendado:** `OPENAI_ENABLED=false`, `TRAVEL_HYBRID_RETRIEVAL_ENABLED=false` en shell antes de scripts QA.

---

## Estado general

**usable** — Motor determinista, propuestas HTML/PDF y recomendación funcionan sobre el subconjunto **APPROVED** del catálogo. No **demo-ready** al 100% hasta alinear catálogo aprobado con expectativas de intención (muchas ofertas siguen en `PENDING_REVIEW`) y hasta migrar `travel_media_assets`.

| Dimensión | Nota (0–10) | Comentario breve |
|-----------|---------------|------------------|
| Catálogo (datos) | 8 | 104 viajes, sin precio 0, geo/itinerario completos en métricas |
| Recommendation | 6 | Sólido, pero **solo 18 viajes APPROVED** entran al motor; intents asiáticos devuelven mucho Cono Sur por pool |
| Geo | 7 | Bypass ON suele mantener top5; divergencia en consultas muy amplias (“América del Sur”) |
| Proposals | 7 | Genera bien con `useAiCopy: false`; falla si recomendación deja 0 candidatos |
| PDF | 8 | ~200KB PDFs generados; rutas bajo `uploads/proposals/<companyId>/` |
| Playground UX | — | **Revisión manual** en `/travel/recommendation-playground` (no automatizada) |
| UX confianza (premiumUx) | 8 | `trustSummary` + narrativa determinista coherentes |
| Demo readiness | 6 | Bloqueada por pool APPROVED pequeño + migración media pendiente |

---

## FASE 0 — Reset comercial (dry-run)

**Script:** `backend/scripts/qa-reset-commercial-data.ts`  
**Comando:** `npm run qa:reset-commercial-data -- --companyId=ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3`  

**Resultado (dry-run, no borró datos):**

| Recurso | Cantidad |
|---------|----------|
| leads | 10 |
| proposals | 10 |
| proposalVersions | 12 |
| leadActivities | 43 |
| leadNotes | 0 |
| leadAgentRuns | 7 |
| recommendationRuns | 14 |
| proposalArtifacts | 12 |
| PDFs referenciados | 12 (todos **MISSING** en disco — rutas huérfanas) |

**Validación no-catálogo:** TravelTrip 104, Destination 348, GeoPlace 355, TripGeoPlace 1175, Users 7, JSON import batches 46 — **intactos**.

**Aplicar borrado (operador):**  
`npm run qa:reset-commercial-data -- --companyId=<uuid> --apply`

---

## FASE 1 — Catálogo (`travel:catalog-overview`)

- **Total viajes:** 104  
- **APPROVED / PENDING_REVIEW:** 18 / 86  
- **Sin precio / sin geo / sin itinerario:** 0 / 0 / 0  
- **GeoPlace / TripGeoPlace:** 355 / 1175  
- **Huérfanos geo:** 7  
- **Media:** tabla `travel_media_assets` **ausente** en BD local → sin métrica de imágenes hasta migración Prisma.

---

## FASE 2 — Auto-aprobación con precio (`travel:auto-approve-priced`)

**Script:** `backend/scripts/travel-auto-approve-priced.ts`  

- **Criterios:** mismo bloque que `travel:auto-approve` **+** `indicativePrice` obligatorio.  
- **Dry-run ejecutado:** 86 `PENDING_REVIEW` analizados → **86 ✓ APROBAR** (todos cumplen slug, destino, geo, itinerario, highlights, precio).  
- **PEND_REVIEW ahora:** 86; si se aplica `--apply`, quedarían **0** pendientes y **104** aprobados (comprobar negocio antes).

**Comandos:**

```bash
npm run travel:auto-approve-priced -- --companyId=ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3
npm run travel:auto-approve-priced -- --companyId=ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3 --apply
```

---

## FASE 3 — Recomendación avanzada (10 casos)

**Script:** `backend/scripts/qa-recommendation-advanced.ts`  
**Salida:** por caso: top 5, scores, `matchState`, `confidence`, `trustSummary`, `premiumUx` (reasoning, tradeoffs), heurística `QA_parece_logico`.

**Hallazgo clave:** Los logs del pipeline muestran **`catalog: 18`** = solo viajes **APPROVED**. Con 86 aún pendientes, intents tipo “Tailandia” o “Asia” **no ven** la mayor parte del catálogo → rankings pueden favorecer Cono Sur **por pool**, no por “error” de código.

- **Argentina cultural premium:** STRONG_MATCH, top Argentina coherente.  
- **Intent vacío:** `NEEDS_CLARIFICATION` / top por dossier (WEAK_MATCH en items).  
- **Planeta Zargoth:** WEAK_MATCH + relajación; revisar que score no “venda” destino absurdo (marketing).

---

## FASE 4 — Geo deep (`qa:geo-deep`)

- Con **solo 18 APPROVED**, muchos destinos muestran top5 **idéntico** OFF vs ON.  
- **América del Sur:** top5 **cambió** con geo ON (reorden parcial).  
- **Patagonia:** `geo_prefilter_active_on: true` pero mismo top5 en la muestra.  
- Conclusión: **Geo ON** es seguro y mejora sutileza cuando el pool es grande; con pool 18 el efecto es limitado. Activación en prod cuando el catálogo aprobado cubra más regiones.

---

## FASE 5–6 — Leads mock + proposals deep

**Script:** `backend/scripts/qa-proposals-deep.ts` — **8 escenarios** (`useAiCopy: false`).

**Fix aplicado:** `getPrimaryHeroImageByTripIds` tolera ausencia de tabla `travel_media_assets` (P2021 → mapa vacío) para no bloquear propuestas.

**Ejecución real:** 6/8 escenarios completaron OK (propuesta GENERATED, HTML ~22k chars, PDF **~200 KB** cada uno).  

**Fallo:** `viaje-corto-barato` → recomendación **NO_MATCH**, **eligible: 0** → `ValidationError`: no hay candidatos para generar propuesta. El script **continúa** con el resto de escenarios y termina con código **1** si hubo fallos.

**Ranking discutible:** `tailandia-playa-cultura` con **WEAK_MATCH** y **relaxedAlternatives** siguió mostrando circuitos **Argentina** en top — coherente con **pool solo Cono Sur aprobado**, no con intención Tailandia.

---

## FASE 7 — Playground

Comprobar manualmente:

- `/travel/recommendation-playground`
- `?demo=1` y `?debug=1`

Criterios: claridad, confianza, top 5, ruido, modo demo.

---

## FASE 8 — Media

- Tabla **`travel_media_assets`** no existe en esta BD → **0** héroes persistidos.  
- Tras migración + claves Unsplash/Pexels: `npm run qa:travel-media` / `qa:travel-media-proposals`.

---

## FASE 9 — Métricas y conclusiones

### Bugs / riesgos

1. **Pool recomendación = solo APPROVED** — Con 18/104 aprobados, la demo sesga fuerte al Cono Sur.  
2. **Propuesta falla en NO_MATCH con 0 eligible** — correcto pero rompe E2E si el caso no se diseña con presupuesto viable.  
3. **PDFs huérfanos** en reset (rutas en BD sin archivo).  
4. **Migración media** pendiente (o env sin tabla).

### Rankings “absurdos” (contexto)

- Tailandia / Asia / Japón con top Argentina cuando el catálogo aprobado no incluye esos destinos.

### Casos buenos

- Argentina / Patagonia / Uruguay (pool alineado).  
- Premium UX y trust panel legibles.

### Casos flojos

- Intents fuera del hemisferio sin producto APPROVED equivalente.  
- Presupuesto muy bajo sin circuitos cortos aprobados.

### Qué está listo

- Scripts QA: reset comercial, overview, auto-approve-priced, recommendation-advanced, geo-deep, proposals-deep.  
- Propuestas deterministas sin copy IA.  
- Resolución hero sin bloqueo si falta tabla media.

### Qué falta

- Aprobar más catálogo (`--apply` auto-approve-priced) o política clara de qué entra al motor.  
- Migración `travel_media_assets`.  
- (Opcional) endurecer E2E proposals: capturar NO_MATCH sin crash de script.

### Qué NO tocar ahora

- No borrar **TravelTrip**, **Destination**, **Geo**, **usuarios**, **empresas**, **JSON imports** sin ventana de mantenimiento.  
- No `--apply` reset en producción sin backup.

### Siguiente paso recomendado

1. Ejecutar `travel:auto-approve-priced -- --apply` en **staging** y repetir `qa:recommendation-advanced` + `qa:geo-deep`.  
2. Aplicar migración Prisma para media + re-ejecutar enriquecimiento.  
3. Re-ejecutar `qa:proposals-deep` tras ampliar APPROVED o ajustar intent “barato corto”.

---

## Comandos rápidos (copiar)

```bash
cd backend
npm run qa:reset-commercial-data -- --companyId=ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3
npm run travel:catalog-overview -- --companyId=ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3
npm run travel:auto-approve-priced -- --companyId=ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3
npm run qa:recommendation-advanced -- --companyId=ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3
npm run qa:geo-deep -- --companyId=ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3
npm run qa:proposals-deep -- --companyId=ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3
```
