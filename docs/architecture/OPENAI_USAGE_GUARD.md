# OpenAI: control de gasto (guard)

## Resumen

- **Todas** las llamadas al SDK pasan por `src/services/openai/openai-guarded.executor.ts` (`guardedChatCompletion` / `guardedEmbeddingCreate`).
- **Pre-flight** (`OpenAIUsageGuard`): kill switch (env + BD), flags por operación, API key, topes € globales/tenant/usuario/operación, rate limits in-memory, PDF IA/día, copy IA/hora, idempotencia, cooldown por lead.
- **Auditoría**: tabla `openai_usage_logs` (tokens, coste estimado €, estado, código error, duración).
- **Tenant**: `openai_usage_budgets` (topes opcionales, `hardBlocked`, `maxCallsPerHour`, etc.).
- **Plataforma**: fila `openai_system_state` (`id=default`) para kill switch en BD.

## Endpoints admin (SUPER_ADMIN)

- `GET /api/v1/admin/openai/usage`
- `GET /api/v1/admin/openai/budget?companyId=`
- `PATCH /api/v1/admin/openai/budget`
- `POST /api/v1/admin/openai/kill-switch` body `{ "active": boolean }`
- `GET /api/v1/admin/openai/alerts`

## Variables de entorno

Ver `apps/api/.env.example` (sección OpenAI). Valores por defecto en código: desarrollo con topes bajos; producción con topes más altos (ajustar siempre con volumen real).

## Comandos

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
npm run test:openai-guard
```

## Cómo limitar un gasto accidental grande (p. ej. 5.000 €)

1. **OPENAI_GLOBAL_MAX_DAILY_EUROS** y **OPENAI_GLOBAL_MAX_MONTHLY_EUROS** por debajo del peor caso aceptable.
2. **OPENAI_GLOBAL_KILL_SWITCH=true** o **POST /admin/openai/kill-switch** en incidente.
3. Topes por empresa en BD (`PATCH .../budget`) + **hardBlocked** para tenants abusivos.
4. **OPENAI_GUARD_SDK_MAX_RETRIES=0** para evitar duplicar coste en fallos transitorios.
5. Revisión periódica de `openai_usage_logs` y alertas en logs (umbrales 50/80/100% del tope diario tenant).

## Limitaciones

- Rate limits in-memory: un solo proceso Node; en cluster, repartir o usar Redis.
- La estimación € es aproximada (pricing tabla + `OPENAI_USD_TO_EUR_RATE`); contraste con facturación OpenAI.
