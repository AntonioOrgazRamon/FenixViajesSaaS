import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  /** Base URL pública del API (sin barra final) para enlaces a avatares subidos bajo /uploads */
  PUBLIC_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().default('super-secret-key-change-me'),
  JWT_REFRESH_SECRET: z.string().default('super-refresh-secret-key-change-me'),
});

const envVars = envSchema.safeParse(process.env);

if (!envVars.success) {
  console.error('Invalid environment variables:', envVars.error.format());
  process.exit(1);
}

export const config = envVars.data;
