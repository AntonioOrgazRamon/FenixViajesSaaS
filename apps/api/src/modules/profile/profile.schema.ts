import { z } from 'zod';

export const timeFormatValues = z.enum(['24h', '12h']);
export const dateFormatValues = z.enum(['dmy', 'mdy', 'ymd', 'locale']);

export const profilePreferencesSchema = z
  .object({
    notifyProduct: z.boolean().optional(),
    notifySecurity: z.boolean().optional(),
    notifyBilling: z.boolean().optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .strict();

export const updateProfileExtendedSchema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  displayName: z.string().max(150).optional().nullable(),
  phone: z.string().max(32).optional().nullable(),
  language: z.enum(['es', 'en']).optional(),
  timezone: z.string().max(100).optional().nullable(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
  timeFormat: timeFormatValues.optional().nullable(),
  dateFormat: dateFormatValues.optional().nullable(),
  profilePreferences: profilePreferencesSchema.optional(),
});

export const changeEmailSchema = z.object({
  new_email: z.string().email(),
  password: z.string().min(1),
});

const hexColor = z
  .string()
  .regex(
    /^#[0-9A-Fa-f]{6}$/,
    'Color en formato #RRGGBB'
  );

export const patchDefaultAvatarSchema = z.object({
  initials: z
    .string()
    .max(3, 'Máximo 3 caracteres')
    .optional()
    .nullable(),
  backgroundColor: hexColor,
  textColor: hexColor,
  shape: z.enum(['circle', 'rounded', 'square']),
});
