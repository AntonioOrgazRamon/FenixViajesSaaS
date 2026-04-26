import { z } from 'zod';

export const updateProfileExtendedSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  language: z.enum(['es', 'en']).optional(),
  timezone: z.string().max(100).optional().nullable(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
});

export const changeEmailSchema = z.object({
  new_email: z.string().email(),
  password: z.string().min(1),
});

export const avatarBodySchema = z.object({
  avatarUrl: z.string().url().max(500),
});
