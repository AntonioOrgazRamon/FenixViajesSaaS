import { z } from 'zod';
import { validateNewPasswordForReset } from '../../common/validation/passwordPolicy';

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

export const updateProfileSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().optional(),
  locale: z.enum(['es', 'en']).optional(),
  timezone: z.string().optional(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
});

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
