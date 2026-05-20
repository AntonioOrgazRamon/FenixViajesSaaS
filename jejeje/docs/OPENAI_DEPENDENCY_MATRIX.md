# Matriz de dependencia OpenAI (travel / CRM)

Objetivo: saber qué sigue funcionando si la API falla (429, kill switch, sin clave) **sin activar embeddings de catálogo**.

## Resumen

| Capacidad | Sin `OPENAI_API_KEY` | Con clave pero 429 / error embed |
|-----------|---------------------|-----------------------------------|
| Recomendación Fase 1 (rules + lexical + structured) | OK | OK |
| `TRAVEL_HYBRID_RETRIEVAL_ENABLED` + vector intent | Vector = 0 (warnings) | Misma degradación si embed intent falla |
| Embeddings de viajes (`travel:embed`) | No ejecutable útil | Depende de cuota |
| Copy IA en propuestas (`useAiCopy` efectivo true) | Falso por código → texto determinista | Igual si guard rechaza |
| Extracción PDF con IA | Desactivada / errores según flags | Igual |
| Import JSON travel | OK (no requiere OpenAI) | OK |

## Interruptores relevantes (`backend/src/common/config/index.ts`)

- `OPENAI_ENABLED`, `OPENAI_GLOBAL_KILL_SWITCH`, `OPENAI_EMBEDDINGS_ENABLED`, etc.
- **`TRAVEL_SKIP_INTENT_EMBEDDING`** (nuevo): si es `true`, **no** se llama a OpenAI para embeddar la **intención** en retrieval híbrido → canal vector = 0, sin excepciones por cuota. Recomendado en demos y cuando haya 429 en embeddings.

## Puntos de código

| Área | Archivo / comportamiento |
|------|---------------------------|
| Embed consulta intención | `hybrid-retrieval.service.ts` → respeta `TRAVEL_SKIP_INTENT_EMBEDDING` |
| Copy propuesta | `proposal-copy-ai.service.ts` + `ProposalGenerationService` (`useAiCopy` false → determinista) |
| Extracción catálogo | Servicios bajo `trip-ai-*` / import structural pipeline |

## Garantías deseadas (MVP)

1. **Recommendation**: debe producir ranking con hybrid OFF (por defecto) solo con motor determinista.
2. **Propuestas**: `useAiCopy: false` → HTML/PDF sin modelo generativo.
3. **Import JSON**: solo Prisma + Zod + normalización; no bloquear por OpenAI.
