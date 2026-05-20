# Informe de cierre MVP técnico — Travel (brutalmente honesto)

Este documento resume el estado tras las herramientas añadidas (`travel:auto-approve`, QA recomendación, comparación geo, E2E propuestas, informe catálogo) y los toggles de configuración. La sección **Ejecución verificada** refleja una corrida real en este repo (tenant Fenix Viajes).

## Estado general

**Sólido para demo técnica en este tenant**, con matices:

1. **Catálogo:** los 18 viajes pasaron a `APPROVED` vía criterio controlado (warnings esperados: sin hoteles, luxury/budget UNKNOWN).
2. **Recomendación:** QA MVP completó sin errores; tiempos ~200–300 ms por consulta en catálogo de 18 viajes.
3. **Geo (script `qa:geo-compare`):** en la mayoría de intents el **top 5 no cambió** respecto al baseline; para Asia/Japón/Tokio/Maldivas el grafo devolvió `NO_GEO_PLACE_FOR_INTENT` o candidatos insuficientes para prefilter — coherente con un catálogo 100 % Argentina/Chile/Uruguay.
4. **Propuestas:** cuatro escenarios generaron `GENERATED`, HTML ~15k caracteres y PDF en disco; las notificaciones SMTP **fallaron** por red/TLS del entorno local (timeouts + `wrong version number`), pero la persistencia y actividades quedaron registradas (`PROPOSAL_GENERATED`, `SELLER_NOTIFIED` con título de fallo).
5. **Pendiente honesto:** activar `TRAVEL_GEO_RETRIEVAL_ENABLED=true` en **staging** con catálogo multi-región para medir valor real de geo; corregir SMTP (`SMTP_SECURE`/puerto) para demo de correo.

Sin `APPROVED`, producción **no muestra catálogo** en recomendación ni propuestas.

## Ejecución verificada (2026-05-18)

| Paso | Comando / resultado |
|------|---------------------|
| Tenant | `ea318069-f2ca-43ac-b9d8-a58fdeb4d0b3` (Fenix Viajes) |
| Auto-aprobación | **18 analizados, 18 aprobados, 0 rechazados** (todos con warnings `NO_HOTELS`, `LUXURY_UNKNOWN`, `BUDGET_TIER_UNKNOWN`) |
| QA recomendación | `qa:recommendation-mvp` → **exit 0** (intents Argentina, Patagonia, Uruguay, Japón, Asia, Maldivas, presupuesto bajo, lujo, naturaleza, gastronomía, luna de miel) |
| Geo compare | `qa:geo-compare` → **exit 0**; top 5 idéntico OFF vs staging bypass en los casos probados; telemetría con `NO_GEO_PLACE_FOR_INTENT` / `GEO_CANDIDATES_*` / `PREFILTER_SKIPPED_LT_3` según intent |
| Catálogo | `travel:catalog-quality` → `docs/TRAVEL_CATALOG_QUALITY.md` (**8 sin precio**, **18 sin hoteles**, tier Bueno 10 / Mejorable 8) |
| E2E propuestas | `travel:mvp-proposals-e2e` (4 escenarios, `useAiCopy: false`) → **4 × `GENERATED`**, PDF bajo `backend/proposals/<companyId>/…pdf`; ~**85 s** por escenario en gran parte por reintentos SMTP a varios vendedores |

## Puntuaciones subjetivas (0–10)

| Área | Nota | Comentario |
|------|-----:|------------|
| Recommendation engine | **7** | Reglas claras y explicables; hybrid/geo/embeddings opcionales. |
| Geo retrieval | **4–6** | Grafo existe; valor real aparece al activar flag en servidor + revisar prefilter mínimo. |
| Proposal generation | **7–8** | Determinista con `useAiCopy: false`; PDF depende de entorno (puppeteer). |
| Import pipeline | **8** | JSON robusto; PDF/IA fuera de este alcance. |
| Arquitectura backend | **8** | Capas separadas, telemetry, flags por env. |
| Calidad catálogo | **6** | Datos reales: 0 hoteles en 18 viajes, 8 sin precio; itinerarios/highlights bien cargados. |
| Demo readiness | **8** | Catálogo aprobado + QA + 4 propuestas PDF/HTML en BD; email depende de SMTP válido. |

## Cosas realmente buenas

- Multi-tenant con filtros consistentes en servicios.
- Scoring desglosado (`contributions`) útil para vendedor y auditoría.
- Fallback cuando destino no matchea (`relaxedAlternatives` + hints).
- Propuesta puede vivir **sin IA** (`useAiCopy: false`).

## Cosas peligrosas

- **`OPENAI_API_KEY` + hybrid preview**: embeddings de intención pueden llamarse y fallar por cuota → usar **`TRAVEL_SKIP_INTENT_EMBEDDING=true`** en demos.
- **Geo prefilter** con `TRAVEL_GEO_PREFILTER_MIN_MATCHES`: puede vaciar pool si el grafo está mal enlazado → validar en staging antes de producción.
- **SMTP**: notificación vendedor puede fallar sin tirar la generación; revisar `LeadActivity` / logs.

## Bugs reales (conocidos)

- **SMTP en desarrollo:** configuración incorrecta (TLS vs puerto) y/o IPv6 timeout hacia relay tipo Gmail produce ~21 s por intento de envío; la generación de propuesta **no** debe depender de que el correo salga (ya degrada con actividad de fallo).

## Riesgos

- Catálogo sin precio → sesgos en budget y percepción “mala recomendación”.
- Diversidad MMR puede dominar tiempo de CPU en catálogos grandes (medir antes de optimizar).

## Qué ya parece producto real

- Pipeline recomendación + constraints + slots comerciales.
- Propuesta versionada + PDF + intent snapshot JSON.

## Qué sigue pareciendo MVP

- Activación geo global en prod sin playbook de rollback.
- Hybrid + embeddings como “mejora opcional”, no como núcleo estable.

## Qué NO tocaría ahora

- Reescritura del motor de scoring.
- Agentes autónomos o más superficie OpenAI.

## Qué haría después

1. `TRAVEL_GEO_RETRIEVAL_ENABLED=true` en **staging** solamente; comparar métricas cualitativas.
2. Completar precios / hoteles en datos críticos para demos premium.
3. Re-ejecutar `qa:recommendation-mvp` tras cada cambio de política `recommendationPolicy` en empresa.

## Comandos útiles

```bash
cd backend
npm run travel:auto-approve -- --companyId=<uuid> --dry-run
npm run travel:auto-approve -- --companyId=<uuid>
npm run qa:recommendation-mvp -- --companyId=<uuid>
npm run qa:geo-compare -- --companyId=<uuid>
npm run travel:catalog-quality -- --companyId=<uuid>
npm run travel:mvp-proposals-e2e -- --companyId=<uuid> --only=argentina-cultural-premium
```

## Rendimiento (no optimizado)

- **Recomendación:** observado **~200–300 ms** por intent en catálogo de 18 viajes (`qa:recommendation-mvp` / logs pipeline).
- **Propuesta completa:** observado **~85 s** por escenario cuando hay **varios destinatarios de notificación** y SMTP falla por timeout (4 × ~21 s); optimización futura sería acortar timeout o paralelizar/notificar en background sin bloquear la respuesta HTTP (fuera del alcance MVP).
- La fase **diversity** puede dominar CPU en catálogos grandes; aquí no fue cuello visible.
