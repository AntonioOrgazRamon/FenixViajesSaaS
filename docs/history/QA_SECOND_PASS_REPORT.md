# Segunda batería QA — recomendación, geo, propuestas, import, rendimiento, SMTP

**Tenant:** Fenix Viajes (`ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3`)  
**Fecha ejecución:** 2026-05-18  
**Catálogo:** 18 `APPROVED` (+ smoke import QA puede crear/borrar filas `qa-travel-json-import-*`).  

**Logs completos (verbatim salvo encoding consola):**

- `docs/qa-second-pass-recommendation.log`
- `docs/qa-second-pass-geo.log`
- `docs/qa-second-pass-proposals.log`
- `docs/qa-second-pass-import.log`

**Scripts añadidos (solo QA, sin cambiar motor):**

- `npm run qa:recommendation-advanced -- --companyId=<uuid>`
- `npm run qa:geo-deep -- --companyId=<uuid>`
- `npm run qa:proposals-deep -- --companyId=<uuid>`

---

## Fase 1 — Recomendación avanzada (10 casos)

### Hallazgos reales

| Caso | match global | Notas |
|------|----------------|------|
| 1 Patagonia lujo | `STRONG_MATCH` | Top: Lagos/Glaciers… score **82**, destino 30, duración 18/20, budget 20/20, estilo 12/12; preferencias “lujo” **0/15** (token no matchea corpus). **diversity_ms ~157** vs scoring ~14 — MMR domina CPU en este tamaño de catálogo. |
| 2 Argentina barato | `WEAK_MATCH` | Presupuesto **1200** por debajo del suelo del catálogo → `BUDGET_BELOW_CATALOG_FLOOR` WARN; **8** elegibles tras constraints; top score **~49** — coherente. |
| 3 Uruguay vino | `STRONG_MATCH` | Solo **2** elegibles (`afterHardFilters: 2`); top **Colores de Argentina y Uruguay** score **74** — ranking sensato para el pool. |
| 4 Gastronomía premium | `WEAK_MATCH` | Sin destino; ranking por estilo/prefs/budget — esperable más disperso. |
| 5 Luna miel lujo | `WEAK_MATCH` | Sin destino; mismos patrones que 4/6. |
| 6 Naturaleza intensa | (ver log) | Solo ejes + duración 15. |
| 7 Viaje corto barato | `NO_MATCH` global típico | Presupuesto/duración duras vs catálogo largo/premium. |
| 8 Cultura urbana | `NEEDS_CLARIFICATION` | `INTENT_TOO_VAGUE` aunque `travelStyleAxes` aplicados — **mensaje engaña**: no está “vacío”, es solo ejes. Muchos viajes a **score 100** solo por `ontology_style 12/12` sobre factor único activo → **inflación percibida de score** cuando solo hay un factor. **diversity_ms ~205**. |
| 9 Planeta Zargoth | `WEAK_MATCH` + `relaxedAlternatives: true` | Fallback coherente; top por **dossier_completeness ~80**, no inventa destino. |
| 10 `{}` | `NEEDS_CLARIFICATION` | Comportamiento esperado (orientativo). |

### Riesgos detectados

- **Scores 100** con intención parcial (solo ontología): no es bug de ranking finales comerciales, pero en demo puede parecer “todo perfecto”.
- **Preferencias texto** (“lujo”, “vino”) a menudo dan **0/15** keywords si el corpus no repite tokens — el vendedor ve destino+budget fuertes pero “pocas coincidencias textuales”.
- **diversity** puede superar **scoring** en ms cuando hay muchos ítems cercanos en score.

---

## Fase 2 — Geo “real” (OFF vs ON)

**Método:** `TRAVEL_GEO_RETRIEVAL_ENABLED` en `.env` siguió en **false**. La rama ON usa `geoStagingBypass: true`, equivalente operativo a geo habilitado sin tocar env global.

### Resultado cuantitativo

- En **7/8** destinos el **top 5 fue idéntico** OFF vs ON.
- **América del Sur** fue la excepción importante:
  - OFF: `WEAK_MATCH`, `relaxedAlternatives: true`
  - ON: **`STRONG_MATCH`**, `relaxedAlternatives: false`
  - Top5 **cambió** (swap posiciones Hielos Milenarios vs Lagos…) — el grafo **sí desbloquea encaje** para continente.

### Conclusión brutal sobre geo ON

- **No es basura**: para intents tipo **continente/región resuelta en GeoPlace**, mejora match global y puede evitar modo relajado.
- **No es mágico**: “Cono Sur” siguió con `GEO_CANDIDATES_0` → mismo ranking que sin geo útil.
- **Recomendación:** validar en **staging** con `TRAVEL_GEO_RETRIEVAL_ENABLED=true`, monitorizar `geoNotes` y `geoPrefilterActive`; **no** dar por cerrado en prod hasta tener intents fuera del Cono Sur o más aliases en GeoPlace.

---

## Fase 3 — Propuestas profundas

Ejecución real (`qa:proposals-deep`):

| Escenario | Pipeline ms | Total ms (incl. SMTP×4) | Viajes en PDF | Observación |
|-----------|------------|-------------------------|---------------|-------------|
| Patagonia lujo | ~174 | **28241** | 4 | Lagos / Esencial / Caminos Patagónicos / Ritmos — **coherente Patagonia**. |
| Gastronomía premium | ~269 | **47811** | 4 | Noroeste vino, Paladar, Colores… — **coherente**. |
| Uruguay vino | ~9 | **27396** | **2** | Pool real solo 2 viajes — propuesta honesta. |
| Viaje corto barato | ~30 | **68909** | 4 | Motor **`NO_MATCH`** pero slots comerciales rellenan circuitos con score **~9** — **debilidad de demo**: conviene copy/UI que diga “sin encaje fuerte”. |

**SMTP (esta corrida):** los 4 admins recibieron OK (`emailOutcome.sent: true`). En corridas anteriores hubo `ETIMEDOUT` / TLS wrong version — entorno **no determinista**.

**PDF:** ~115–121 KB generados bajo `uploads/proposals/<companyId>/…`.

---

## Fase 4 — Importador JSON

`npm run qa:travel-json-import -- --companyId=…` → **exit 0**, smoke DB OK.

- Validación JSON rota → error claro.
- Staging + persistencia + geo enlazado en fixture.
- Warning realista: `hotels_all_dropped` en calidad (hotel de ejemplo barrido por guard).

---

## Fase 5 — Rendimiento (medido)

| Componente | Rango observado |
|--------------|-----------------|
| Recomendación total | ~**4–280 ms** por intent (catálogo 18) |
| Scoring | ~**1–14 ms** típico |
| Diversity | ~**0–215 ms** (pico con muchos empates / ranking dossier) |
| Propuesta — recomendación interna | ~**9–269 ms** |
| Propuesta — **total** | ~**28–69 s** con **4 correos secuenciales** |

**SMTP bloqueo:** el tiempo total de propuesta está dominado por **`dispatchProposalReadyEvent`** iterando destinatarios **en serie**. Incluso con éxito, suma latencias de red por admin.

---

## Fase 6 — SMTP (auditoría)

**Config observada en código:** `email.service.ts` usa `secure: SMTP_SECURE` (correcto: **587 + STARTTLS → false**, **465 SSL → true**).

**Problemas vistos en otras corridas:** IPv6 timeout hacia Gmail, `wrong version number` (mezcla puerto/TLS).

**Cambio aplicado en esta iteración:** timeouts explícitos en el transport (`connectionTimeout` / `greetingTimeout` / `socketTimeout`) para **acotar** colgadas; no eliminan la cola secuencial.

**Fallback recomendado:** notificación email **asíncrona** (job/cola) o parallel limitado — fuera del alcance “sin features”; documentado como mejora.

---

## Fase 7 — Estado REAL y notas 0–10

### Estado REAL del sistema

**Usable y demo-serio para catálogo Cono Sur aprobado**, con límites claros en intents ultra-baratos, intents solo-texto débiles, y propuestas que rellenan slots aunque el match global sea malo.

### Puntuaciones (honestas)

| Área | Nota | Por qué |
|------|-----:|---------|
| Recommendation engine | **7.5** | Explicable, estable; edge cases (solo ejes → scores altos; keywords débiles). |
| Geo retrieval | **6** | A menudo neutro en top5; **gran impacto** cuando resuelve continente (América del Sur). |
| Proposal generation | **7** | HTML/PDF sólidos; riesgo UX si `NO_MATCH` y scores ~9 sin advertencia fuerte. |
| Import pipeline | **8.5** | Determinista, guards útiles, smoke verde. |
| SMTP | **5** | Funciona en esta máquina ahora; antes fallaba; arquitectura serial sensible. |
| Performance | **6.5** | Búsqueda OK; diversity puede picar; propuestas lentas por email. |
| Calidad catálogo | **6** | Sin hoteles en datos; precios parciales — ver `TRAVEL_CATALOG_QUALITY.md`. |
| Demo readiness | **7.5** | Buena para Argentina/Patagonia/Uruguay; pobre para “presupuesto mochilero”. |

### Cosas MUY buenas

- Relajación controlada + fallback hints en destinos imposibles.
- Uruguay reduce pool a 2 viajes y el ranking **no miente**.
- Geo que convierte `América del Sur` de relajado a **match fuerte** es señal de valor real.

### Cosas peligrosas

- Propuesta con **`NO_MATCH`** y scores de un dígito sigue vendiendo 4 circuitos.
- `INTENT_TOO_VAGUE` con solo `travelStyleAxes` — copy incorrecto para usuario final.
- Cuatro admins → cuatro SMTP seriales por propuesta.

### Bugs / mejoras reales (no hype)

1. Mensaje validación **INTENT_TOO_VAGUE** cuando hay ejes definidos.
2. Proposal UX/policy cuando `matchState === NO_MATCH` (warning explícito en HTML).
3. SMTP: paralelizar o background (cuando se autorice feature mínima).

### Qué ya parece producto serio

- Motor + telemetría + scripts QA reproducibles.
- Import JSON con staging y calidad.

### Qué sigue pareciendo MVP

- Notificaciones solo email sincrónico multi-admin.
- Catálogo sin hoteles/precios incompletos para demos premium.

### Qué NO tocaría ahora

- Pesos del scoring sin nuevo dataset multi-región.
- Hybrid/embeddings.

### Qué arreglaría inmediatamente

- Copy de validación para intents solo-ejes.
- Timeouts SMTP (hecho).
- Reducir admins de prueba o asignar lead a un solo vendedor activo en demos.

### Qué haría después

- Staging `TRAVEL_GEO_RETRIEVAL_ENABLED=true` con tabla de aliases GeoPlace (Cono Sur, etc.).
- Enriquecer tokens/gastronomía en datos o sinónimos controlados en keywords.
- Job asíncrono para `PROPOSAL_READY`.
