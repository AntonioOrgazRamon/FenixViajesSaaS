# Calibración del scoring de recomendación (referencia)

**Versión modelo:** `rec-engine-v2.0.0` (`SCORING_MODEL_VERSION`).

Este documento describe los **pesos máximos por factor** en `scoreTripBreakdown` (`apps/api/src/services/recommendation/scoring.engine.ts`). No sustituye al código fuente.

## Factores principales (con intención completa)

| Factor (`contributions[].factor`) | Máx. pts | Notas |
|-----------------------------------|---------:|--------|
| `destination` | 30 | Incluye fusión léxico + geo cuando hay `DestinationPointsGeoOpts` |
| `duration` | 20 | Penaliza divergencia días |
| `budget` | 20 | Ratio precio/budget; sin precio en catálogo → puntos parciales |
| `calendar` | 15 | Mes explícito / salidas / temporada |
| `keywords` | 15 | Jaccard sobre corpus viaje vs tipo/tags/preferences |
| `ontology_style` | 12 | Ejes `travelStyleAxes` vs tags del viaje |
| `semanticSimilarity` | hasta 15 | Solo si retrieval híbrido aporta `semanticSimilarity01`; acotado si destino literal muy débil |

Si **no hay ninguna dimensión activa** (intención vacía), entra **`dossier_completeness`** (hasta 100 internamente como único factor visible).

## Constantes (`apps/api/src/services/recommendation/constants.ts`)

- `DESTINATION_STRONG_POINTS` (default **12**): umbral “fuerte” para destino.
- `DESTINATION_MAIN_POOL_MIN` (default **6**): contexto constraints / pool principal.
- `DEFAULT_MAX_BUDGET_HARD_RATIO` (**1.55**): cortes HARD por precio vs budget.
- `DEFAULT_DIVERSITY_LAMBDA` (**12**): MMR / penalización similitud entre candidatos ya elegidos (impacto en tiempo con catálogos grandes).
- `SEMANTIC_SIMILARITY_MAX_POINTS` (**15**): techo del factor semántico.
- Pesos retrieval híbrido por defecto: lexical **0.25**, vector **0.45**, structured **0.3**.

## Cambios en esta iteración MVP

- **No se modificaron pesos** del scoring en código: primero hay que ejecutar `npm run qa:recommendation-mvp` con catálogo **APPROVED** y revisar si aparecen rankings claramente defectuosos (evidencia).
- **Sí** se añadió **`TRAVEL_SKIP_INTENT_EMBEDDING`** para evitar llamadas de embedding de intención cuando hybrid está ON pero OpenAI no es fiable (429).

## Cómo recalibrar (cuando haya evidencia)

1. Reproducir caso con `npm run qa:recommendation-mvp -- --companyId=…`.
2. Si el problema es solo diversidad/lentitud → revisar `diversity.engine.ts` + `DEFAULT_DIVERSITY_LAMBDA` (con perfil antes/después).
3. Si el problema es presupuesto demasiado agresivo → revisar `DEFAULT_MAX_BUDGET_HARD_RATIO` o curva en `budgetFactor`.
4. Documentar aquí cualquier cambio futuro (valor viejo / nuevo / motivo / fecha).
