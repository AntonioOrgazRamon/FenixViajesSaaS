import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  /** Base URL pública del API (sin barra final) para enlaces a avatares subidos bajo /uploads */
  PUBLIC_URL: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim();
      return t && t.length > 0 ? t : 'http://localhost:3000';
    }),
  /**
   * Origen de la SPA (sin barra final) para enlaces de «restablecer contraseña» en el email.
   * En desarrollo suele ser http://localhost:5173
   */
  FRONTEND_BASE_URL: z.string().default('http://localhost:5173'),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  /** Minutos de validez del enlace de restablecimiento (15–30 recomendado) */
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().min(5).max(120).default(30),
  /** Nombre visible de la plataforma en asunto/cuerpo del correo */
  APP_NAME: z.string().default('CRM'),
  /** Email remitente, p. ej. noreply@tudominio.com (obligatorio para enviar por SMTP) */
  EMAIL_FROM: z.string().optional(),
  /** SMTP: si no está configurado, no se envía email (desarrollo: solo log) */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /**
   * true solo para puerto 465 (TLS directo). En 587 debe ser false (STARTTLS).
   * No usar z.coerce.boolean(): en .env `SMTP_SECURE=false` es string y `Boolean("false")` === true.
   */
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s === '') return false;
      const t = s.trim().toLowerCase();
      return t === '1' || t === 'true' || t === 'yes';
    }),
  /** Timeouts SMTP (ms): más bajos = fallo antes en relays lentos; propuesta no debe quedar bloqueada. */
  SMTP_CONNECTION_TIMEOUT_MS: z.coerce.number().min(2000).max(120_000).default(8000),
  SMTP_GREETING_TIMEOUT_MS: z.coerce.number().min(2000).max(120_000).default(7000),
  SMTP_SOCKET_TIMEOUT_MS: z.coerce.number().min(2000).max(180_000).default(14_000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().default('super-secret-key-change-me'),
  JWT_REFRESH_SECRET: z.string().default('super-refresh-secret-key-change-me'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_OAUTH_STATE_SECRET: z.string().optional(),
  GOOGLE_ALLOWED_HOSTED_DOMAIN: z.string().optional(),
  /** Tamaño máximo de PDF de catálogo (MB) */
  TRAVEL_PDF_MAX_MB: z.string().default('150'),
  /** Tamaño máximo archivo JSON de importación de viajes (MB). */
  TRAVEL_JSON_IMPORT_MAX_MB: z.string().default('8'),
  /** Directorio bajo process.cwd() para guardar PDFs y JSON extraídos */
  TRAVEL_PDF_BASE_DIR: z.string().default('uploads/travel-pdfs'),
  /** Modelo OpenAI para extracción estructurada (FASE 5) */
  TRAVEL_OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_API_KEY: z.string().optional(),
  /**
   * Logs de depuración del pipeline de hoteles (importación por segmento).
   * `true` / `1` activa; en producción dejar en false.
   */
  TRAVEL_HOTEL_PIPELINE_LOG: z
    .string()
    .optional()
    .transform((s) => s === '1' || s === 'true' || s === 'yes'),
  /**
   * Pipeline estructural determinista (Día 1 + validación dura, sin IA). Por defecto activo.
   * Desactivar con `false` / `0` para el flujo histórico con IA.
   */
  TRAVEL_IMPORT_STRUCTURAL_PIPELINE: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s === '') return true;
      return !(s === '0' || s === 'false' || s === 'no');
    }),
  /**
   * Crear filas “stub” para entradas de índice no encontradas. Por defecto desactivado (no basura en BBDD).
   */
  TRAVEL_IMPORT_INDEX_STUB_TRIPS: z
    .string()
    .optional()
    .transform((s) => s === '1' || s === 'true' || s === 'yes'),
  /** Modelo OpenAI para embeddings de catálogo / intención (Fase 2). */
  TRAVEL_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  /** Dimensiones opcionales (p. ej. 512 para text-embedding-3-small); vacío = default del modelo. */
  TRAVEL_EMBEDDING_DIMS: z
    .string()
    .optional()
    .transform((s) => {
      const n = parseInt(s?.trim() ?? '', 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    }),
  TRAVEL_EMBEDDING_TIMEOUT_MS: z.coerce.number().min(5000).default(25000),
  TRAVEL_EMBEDDING_MAX_RETRIES: z.coerce.number().min(0).max(5).default(2),
  /** Pesos fusión híbrida (lexical + vector + structured). */
  TRAVEL_RETRIEVAL_LEXICAL_WEIGHT: z.coerce.number().min(0).max(1).default(0.25),
  TRAVEL_RETRIEVAL_VECTOR_WEIGHT: z.coerce.number().min(0).max(1).default(0.45),
  TRAVEL_RETRIEVAL_STRUCTURED_WEIGHT: z.coerce.number().min(0).max(1).default(0.3),
  /**
   * Fase 2: retrieval híbrido + embeddings. Por defecto DESACTIVADO hasta piloto estable
   * (`true` / `1` / `yes` para activar).
   */
  TRAVEL_HYBRID_RETRIEVAL_ENABLED: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s === '') return false;
      return s === '1' || s === 'true' || s === 'yes';
    }),
  /**
   * Prefiltro geo + scoring jerárquico (TripGeoPlace). Por defecto desactivado hasta backfill estable.
   */
  TRAVEL_GEO_RETRIEVAL_ENABLED: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s === '') return false;
      return s === '1' || s === 'true' || s === 'yes';
    }),
  /** Mínimo de viajes geo-matching para aplicar prefiltrado (evita pools vacíos). */
  TRAVEL_GEO_PREFILTER_MIN_MATCHES: z.coerce.number().min(1).max(500).default(3),
  /** Profundidad máxima BFS ascendente/descendiente al expandir GeoPlace. */
  TRAVEL_GEO_CLOSURE_MAX_DEPTH: z.coerce.number().min(1).max(24).default(14),
  /**
   * Si true: no se llama a OpenAI para embeddar la intención en retrieval híbrido (vector=0).
   * Útil cuando hay cuota 429 o demos sin IA.
   */
  TRAVEL_SKIP_INTENT_EMBEDDING: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s === '') return false;
      return s === '1' || s === 'true' || s === 'yes';
    }),
  /** Máx requests / ventana para endpoints admin de embeddings. */
  TRAVEL_EMBEDDING_ADMIN_RATE_PER_MIN: z.coerce.number().min(1).default(30),

  /** Enriquecimiento visual de viajes (Unsplash / Pexels). Sin claves no se llama a APIs. */
  TRAVEL_MEDIA_ENABLED: z
    .string()
    .optional()
    .transform((s) => {
      if (s === undefined || s === '') return true;
      return s === '1' || s === 'true' || s === 'yes';
    }),
  /** unsplash | pexels — principal; el otro se usa como respaldo si hay clave. */
  TRAVEL_MEDIA_PROVIDER: z.enum(['unsplash', 'pexels']).default('unsplash'),
  TRAVEL_MEDIA_MAX_IMAGES: z.coerce.number().min(1).max(20).default(5),
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  PEXELS_API_KEY: z.string().optional(),

  // --- OpenAI: interruptores y límites de gasto (seguridad coste-first) ---
  OPENAI_ENABLED: z
    .string()
    .optional()
    .transform((s) => (s === undefined || s === '' ? true : s === '1' || s === 'true' || s === 'yes')),
  /** Kill switch de entorno; si true, bloquea todas las llamadas (la BD puede añadir otro). */
  OPENAI_GLOBAL_KILL_SWITCH: z
    .string()
    .optional()
    .transform((s) => s === '1' || s === 'true' || s === 'yes'),
  OPENAI_INTENT_ENABLED: z
    .string()
    .optional()
    .transform((s) => (s === undefined || s === '' ? true : s === '1' || s === 'true' || s === 'yes')),
  OPENAI_COPY_ENABLED: z
    .string()
    .optional()
    .transform((s) => (s === undefined || s === '' ? true : s === '1' || s === 'true' || s === 'yes')),
  OPENAI_EMBEDDINGS_ENABLED: z
    .string()
    .optional()
    .transform((s) => (s === undefined || s === '' ? true : s === '1' || s === 'true' || s === 'yes')),
  OPENAI_PDF_EXTRACTION_ENABLED: z
    .string()
    .optional()
    .transform((s) => (s === undefined || s === '' ? true : s === '1' || s === 'true' || s === 'yes')),

  /** Tipado de cambio aproximado USD→EUR para estimaciones locales. */
  OPENAI_USD_TO_EUR_RATE: z.coerce.number().positive().default(0.93),
  /** JSON opcional: { "modelo": { "inputPer1MUsd": n, "outputPer1MUsd": n, "embeddingPer1MUsd": n } } */
  OPENAI_MODEL_PRICING_JSON: z.string().optional(),

  OPENAI_MAX_DAILY_EUROS_PER_COMPANY: z
    .coerce.number()
    .min(0)
    .default(process.env.NODE_ENV === 'production' ? 500 : 1),
  OPENAI_MAX_MONTHLY_EUROS_PER_COMPANY: z
    .coerce.number()
    .min(0)
    .default(process.env.NODE_ENV === 'production' ? 5000 : 10),
  OPENAI_GLOBAL_MAX_DAILY_EUROS: z
    .coerce.number()
    .min(0)
    .default(process.env.NODE_ENV === 'production' ? 2000 : 2),
  OPENAI_GLOBAL_MAX_MONTHLY_EUROS: z
    .coerce.number()
    .min(0)
    .default(process.env.NODE_ENV === 'production' ? 20000 : 10),
  OPENAI_USER_MAX_DAILY_EUROS: z
    .coerce.number()
    .min(0)
    .default(process.env.NODE_ENV === 'production' ? 50 : 0.5),

  /** Sub-topes diarios por tipo (€). Si no se define, se usa el tope de empresa para esa comprobación. */
  OPENAI_OP_INTENT_MAX_DAILY_EUROS: z.coerce.number().min(0).optional(),
  OPENAI_OP_COPY_MAX_DAILY_EUROS: z.coerce.number().min(0).optional(),
  OPENAI_OP_EMBEDDING_MAX_DAILY_EUROS: z.coerce.number().min(0).optional(),
  OPENAI_OP_PDF_AI_MAX_DAILY_EUROS: z.coerce.number().min(0).optional(),

  OPENAI_MAX_CALLS_PER_MINUTE_PER_COMPANY: z.coerce.number().min(1).default(24),
  OPENAI_MAX_CALLS_PER_HOUR_PER_COMPANY: z.coerce.number().min(1).default(100),
  OPENAI_MAX_CALLS_PER_MINUTE_PER_USER: z.coerce.number().min(1).default(12),
  OPENAI_MAX_TOKENS_PER_REQUEST: z.coerce.number().min(256).default(120_000),
  OPENAI_MAX_EMBEDDING_BATCH_ITEMS: z.coerce.number().min(1).max(2048).default(20),
  OPENAI_MAX_PDF_AI_CALLS_PER_DAY_PER_COMPANY: z
    .coerce.number()
    .min(0)
    .default(process.env.NODE_ENV === 'production' ? 200 : 20),
  OPENAI_MAX_PROPOSAL_COPY_CALLS_PER_HOUR_PER_COMPANY: z.coerce.number().min(1).default(10),

  /** Reintentos SDK dentro del wrapper (0 recomendado para evitar duplicar coste). */
  OPENAI_GUARD_SDK_MAX_RETRIES: z.coerce.number().min(0).max(2).default(0),

  /** Cooldown entre llamadas equivalentes (ms); usado con idempotencyKey. */
  OPENAI_IDEMPOTENCY_TTL_MS: z.coerce.number().min(0).default(90_000),
  /** Bloqueo corto lead+operación para evitar doble click. */
  OPENAI_LEAD_OP_COOLDOWN_MS: z.coerce.number().min(0).default(8_000),

  /** Rate limit IP para rutas sensibles OpenAI (req/min). */
  OPENAI_HTTP_RATE_PER_IP_PER_MIN: z.coerce.number().min(1).default(40),
});

const envVars = envSchema.safeParse(process.env);

if (!envVars.success) {
  console.error('Invalid environment variables:', envVars.error.format());
  process.exit(1);
}

const parsedConfig = envVars.data;

const JWT_INSECURE_DEFAULTS = new Set([
  'super-secret-key-change-me',
  'super-refresh-secret-key-change-me',
]);

/** En producción se exigen secretos JWT fuertes y distintos (fallo al arrancar si no). */
if (parsedConfig.NODE_ENV === 'production') {
  const minLen = 32;
  if (parsedConfig.JWT_SECRET.length < minLen || JWT_INSECURE_DEFAULTS.has(parsedConfig.JWT_SECRET)) {
    console.error(
      '[security] En producción, JWT_SECRET debe tener al menos 32 caracteres y no usar el valor por defecto del código o del ejemplo.',
    );
    process.exit(1);
  }
  if (
    parsedConfig.JWT_REFRESH_SECRET.length < minLen ||
    JWT_INSECURE_DEFAULTS.has(parsedConfig.JWT_REFRESH_SECRET)
  ) {
    console.error(
      '[security] En producción, JWT_REFRESH_SECRET debe tener al menos 32 caracteres y no usar el valor por defecto del código o del ejemplo.',
    );
    process.exit(1);
  }
  if (parsedConfig.JWT_SECRET === parsedConfig.JWT_REFRESH_SECRET) {
    console.error('[security] En producción, JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos.');
    process.exit(1);
  }
}

export const config = parsedConfig;
