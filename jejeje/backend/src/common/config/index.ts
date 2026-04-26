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
  SMTP_SECURE: z.coerce.boolean().default(false),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().default('super-secret-key-change-me'),
  JWT_REFRESH_SECRET: z.string().default('super-refresh-secret-key-change-me'),
  /** Tamaño máximo de PDF de catálogo (MB) */
  TRAVEL_PDF_MAX_MB: z.string().default('150'),
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
});

const envVars = envSchema.safeParse(process.env);

if (!envVars.success) {
  console.error('Invalid environment variables:', envVars.error.format());
  process.exit(1);
}

export const config = envVars.data;
