import { z } from 'zod';
import { validateNewPasswordForReset } from '../../common/validation/passwordPolicy';
import { updateProfileExtendedSchema } from '../profile/profile.schema';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceName: z.string().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(10),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

/** Misma regla de negocio que `PATCH /api/v1/profile` (módulo profile). */
export const updateProfileSchema = updateProfileExtendedSchema;

export const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const verifyResetTokenSchema = z.object({
  token: z.string(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Falta el enlace o token de restablecimiento'),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })
  .superRefine((data, ctx) => {
    const r = validateNewPasswordForReset(data.newPassword);
    if (!r.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newPassword'], message: r.message });
    }
  });
