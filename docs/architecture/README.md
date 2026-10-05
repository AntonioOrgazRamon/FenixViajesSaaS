# docs/architecture — índice

Referencia técnica del diseño del sistema. **Bajo demanda**: ábrelo solo cuando vayas a tocar el área correspondiente. El código manda: si un documento y el código no coinciden, el documento está desactualizado; márcalo y apúntalo en [TAREAS.md](../development/TAREAS.md).

| Si vas a tocar… | Abre |
|---|---|
| Por qué algo técnico es como es | [DECISIONES_TECNICAS.md](./DECISIONES_TECNICAS.md) |
| Recomendación y puntuación | [RECOMMENDATION_ENGINE_STATUS.md](./RECOMMENDATION_ENGINE_STATUS.md), [TRAVEL_SCORING_CALIBRATION.md](./TRAVEL_SCORING_CALIBRATION.md) (⚠️ desactualizado) |
| Importación de catálogo (PDF / JSON) | [MODULO_CATALOGO_VIAJES.md](./MODULO_CATALOGO_VIAJES.md), [TRAVEL_JSON_IMPORT.md](./TRAVEL_JSON_IMPORT.md) |
| Geografía de viajes | [TRAVEL_GEO_MODEL.md](./TRAVEL_GEO_MODEL.md) |
| Imágenes de viajes (Unsplash / Pexels) | [TRAVEL_MEDIA_ENRICHMENT.md](./TRAVEL_MEDIA_ENRICHMENT.md) |
| Perfil de viaje del lead | [LEAD_TRAVEL_PROFILE.md](./LEAD_TRAVEL_PROFILE.md) |
| Propuestas: modelo de datos y bibliotecas | [travel-proposals-data-model.md](./travel-proposals-data-model.md), [TRAVEL_AND_PROPOSAL_LIBRARY.md](./TRAVEL_AND_PROPOSAL_LIBRARY.md) |
| IA: control de gasto y dependencias | [OPENAI_USAGE_GUARD.md](./OPENAI_USAGE_GUARD.md), [OPENAI_DEPENDENCY_MATRIX.md](./OPENAI_DEPENDENCY_MATRIX.md) |
| Formulario público de leads | [FRONTEND_LEADS_FORM_INTEGRATION.md](./FRONTEND_LEADS_FORM_INTEGRATION.md) (⚠️ contradice al widget, H6) |
| Cuenta, apariencia y tema | [CUENTA_Y_TEMA.md](./CUENTA_Y_TEMA.md) |

Si añades o mueves un documento de esta carpeta, actualiza esta tabla en el mismo commit. Lo que deja de ser vivo va a [docs/history/](../history/).
