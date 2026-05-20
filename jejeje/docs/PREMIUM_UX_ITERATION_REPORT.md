# Premium UX iteration — travel / matching / propuestas / import

Objetivo: subir **percepción de producto maduro** en demo y propuestas **sin LLM**, sin reescribir el motor de recomendación y sin humo “enterprise”.

## Antes vs después (resumen)

| Área | Antes | Después |
|------|--------|---------|
| API de búsqueda | `trustSummary` + ítems con texto técnico en `reasons` | **`premiumUx`** (`2.2.0`): razonamiento legible, fortalezas/compensaciones, panel de confianza, geo en lenguaje natural |
| Propuesta HTML/PDF | Buena base de honestidad; algo “informe interno” | **Documento tipo consultoría**: resumen ejecutivo, panel de confianza en tarjetas, valor, geo, alternativas; tarjetas sin `factor raw/weight` |
| Import Center | Flujo sólido; poca sensación de “health del lote” | **Import Health Summary**, micro-copy demo, **skeletons**, barra de progreso percibida al validar |
| Demo | Igual que producción | **`?demo=1`** (persistente en `sessionStorage`) + badge **Demo** |

## Qué cambió visualmente

- **Propuestas**: tipografía con serif en títulos, fondos suaves, rejilla de confianza, panel de riesgo visible, bloques “Por qué encaja” por opción.
- **Import Center**: tarjeta “Import Health Summary” con métricas compactas y veredicto determinista.

## Qué cambió en percepción / confianza

- El usuario ve **una historia coherente** (ejecutivo → confianza → opciones → compensaciones) en lugar de métricas sueltas.
- El mensaje sigue siendo **honesto**: el panel incluye riesgo de recomendación parcial y vacíos de información.

## Qué cambió en matching UX (API)

Nuevo bloque obligatorio en `TravelSearchResponse`:

- `premiumUx.humanReadableReasoning`
- `premiumUx.whyRecommendedBullets`, `topStrengths`, `mainTradeoffs`
- `premiumUx.confidencePanel` (calidad, catálogo, confianza, información faltante, riesgo)
- `premiumUx.geoContextLine` (cuando el texto de destino incluye pista geo del merger)
- `premiumUx.similarAlternativesSummary`

**Schema**: `TRAVEL_SEARCH_SCHEMA_VERSION` = **`2.2.0`**.

## Qué cambió en proposals

- Maquetación renovada en `proposal-html-template.ts`.
- `proposal-generation.service.ts`: tarjetas con **“Encaje resumido”** legible y bloque **“Por qué recomendamos esta opción”** derivado de `explanationCustomer` + matches.

## Qué cambió en import UX

- Resumen de salud del lote + recomendación corta.
- Modo demo (`?demo=1`): copy más limpio y hints técnicos del paste movidos a `sr-only` para no romper accesibilidad.

## Qué parece ahora el producto

- **MVP técnico serio** → sigue siendo verdad en el núcleo (motor/import/geo intactos).
- **SaaS serio / orientado a demo premium**: más cercano gracias a narrativa y PDF.
- **Enterprise**: no objetivo explícito; se evitó capas nuevas innecesarias.

## Puntuación nueva (subjetiva ingeniería + demo)

| Eje | Nota /10 |
|-----|----------|
| UX | **8** |
| Demo quality | **8** |
| Perceived intelligence | **8** |
| Trust | **8** |
| Proposal quality | **8** |
| Recommendation quality (presentación) | **8** |

## QA

- `npm run test:travel-search` OK (`2.2.0`, `premiumUx` presente).
- `qa:recommendation-advanced`, `qa:geo-deep`, `qa:proposals-deep`: requieren `--companyId`; evaluar **percepción** con checklist manual (claridad, tono, ausencia de ruido técnico en PDF).

## Qué no se tocó (por diseño)

- Motor de scoring/ranking, import pipeline, geo core, approval, multi-tenant.
- LLM para “inventar” explicaciones: todo sale de datos ya calculados.

## Riesgos / siguiente paso

- Consumidores estrictos del JSON de search deben tolerar **`premiumUx`** y **`2.2.0`**.
- Conviene una **pantalla de playground** en frontend sobre `/travel/trips/search` para lucir el panel en demo (pendiente si se desea).
