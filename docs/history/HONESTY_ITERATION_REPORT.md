# Informe — honestidad travel / recomendación / propuestas

Iteración posterior a `QA_SECOND_PASS_REPORT.md`: alinear **percepción comercial** con **realidad del motor**, sin reescribir el recomendador ni imponer embeddings.

**QA ejecutado en esta sesión (local)**

- `npm run test:travel-search` — OK (schema `2.1.0`, `trustSummary` presente).
- `npm run qa:travel-json-import` — OK (tests en memoria; smoke DB omitido sin `--companyId`).
- `npm run qa:recommendation-advanced`, `qa:geo-deep`, `qa:proposals-deep` — **requieren** `--companyId=<uuid>` y catálogo APPROVED; no se lanzaron contra BD en esta máquina por falta de identificador explícito en el comando.

---

## Puntuación (0–10, criterio ingeniería + demo)

| Dimensión | Nota | Comentario breve |
|-----------|------|------------------|
| **Recommendation honesty** | **8** | `match-honesty.engine` limita score/confianza con pocas dimensiones; `deriveHonestItemMatchState` evita STRONG artificial; respuesta con `trustSummary` ampliado. |
| **Proposal honesty** | **8** | Copy determinista por `matchState` (STRONG / WEAK / NO_MATCH / NEEDS_CLARIFICATION); en NO_MATCH/NEEDS_CLARIFICATION se muestran como máximo **dos** tarjetas; panel de transparencia y limitaciones en HTML/PDF. |
| **Confidence realism** | **8** | Tarjetas muestran `conf %`, `raw→ajustado` cuando aplica; bullets globales incluyen estado y confianza; persistencia de ítems con `rawScore` y dimensiones en `explainability`. |
| **SMTP responsiveness** | **8** | Finalización de propuesta **no bloquea** en envío (fire-and-forget en `proposal.service` y smart-proposal); destinatarios en **paralelo**; timeouts SMTP **configurables** y por defecto más cortos. |
| **Geo usefulness** | **7** | Bonus moderado (`best * 0.85`, techo 11) y penalización suavizada (-8); comparativa OFF/ON no re-medida aquí — ejecutar `qa:geo-deep` con empresa real. |
| **Demo quality** | **8** | Mensajes claros, sin “top perfecto” cuando el estado global es NO_MATCH; IA de copy **no** sustituye el mensaje base en NO_MATCH/NEEDS_CLARIFICATION. |

---

## Cambios realizados (resumen técnico)

1. **`travel-search.schema` `2.1.0`**: `trustSummary` incluye `intentCompleteness` y `catalogEligibleRatio`; tipo exportado `RecommendationMatchState`.
2. **`pipeline.ts`**: Rellena las nuevas métricas de confianza agregada en `trustSummary`.
3. **`proposal-html-template.ts`**: Paneles **Transparencia** y **Limitaciones**; sección de opciones con título/intro dinámicos; lista variable `proposalOptions`.
4. **`proposal-generation.service.ts`**: Construcción de tarjetas honestas (recorte en NO_MATCH / NEEDS_CLARIFICATION); trust lines; límites a IA de intro en casos de baja confianza estructural.
5. **`proposal.service.ts`** y **`smart-proposal.service.ts`**: `finalizeProposalVersionGeneration` en segundo plano (`void` + log de error).
6. **`proposal-ready.dispatcher.ts`**: Envíos email en `Promise.all` por destinatario.
7. **`email.service.ts`** + **`config`**: `SMTP_*_TIMEOUT_MS` configurables.
8. **`recommendation-persistence.service.ts`**: `explainability` ampliado (`rawScore`, `matchCoverageDimensions`, `intentSignalBreadth`).
9. **`proposal.controller.ts`**: `sellerNotificationPendingAsync` en la respuesta JSON cuando aplica.
10. **`scripts/validate-travel-search.ts`**: Assert de schema `2.1.0` y forma de `trustSummary`.

---

## Qué mejoró de verdad

- El **estado global** (`NO_MATCH`, etc.) deja de contradecir propuestas con cuatro “perfiles perfectos”.
- **Scores altos con poca información** quedan acotados por la capa de honestidad ya existente y se **explican** en PDF (confianza, raw si hubo cap).
- La **latencia percibida** de generación deja de depender del SMTP en el camino crítico principal.

---

## Qué sigue siendo MVP

- Sin re-ejecución automática de `qa:recommendation-advanced` / `qa:geo-deep` / `qa:proposals-deep` en CI sin empresa de prueba.
- **Retry** SMTP/backoff explícito no implementado (solo fire-and-forget + actividad en error en el worker async).
- UI SPA no actualizada en esta iteración (si el front consume `travelSearchResponseZ` estricto, debe aceptar nuevos campos de `trustSummary`).

---

## Riesgos restantes

- **`recipientKind` / `recipientEmails` vacíos** en la respuesta síncrona de finalize: la API ya no espera al correo; el front debe basarse en `sellerNotificationPendingAsync` y en actividades `SELLER_NOTIFIED`.
- **Casos límite**: NEEDS_CLARIFICATION con picks pobres puede seguir mostrando una sola tarjeta — coherente con honestidad pero puede sorprender en demo si no se narra.

---

## Qué no tocaría ahora

- Reescritura del motor de scoring/ranking o embeddings obligatorios.
- Agentes autónomos u “IA de recomendación” adicional.
- Cambios grandes en el modelo Prisma salvo necesidad productiva clara.
