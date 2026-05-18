import { z } from 'zod';
import { validateNewPasswordForReset } from '../../common/validation/passwordPolicy';

export const createCompanySchema = z.object({
  company: z.object({
    name: z.string().min(2),
    slug: z.string().min(2),
  }),
  initialAdmin: z.object({
    email: z.string().email(),
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    phone: z.string().optional(),
    password: z.string().superRefine((val, ctx) => {
      const r = validateNewPasswordForReset(val);
      if (!r.ok) {
        ctx.addIssue({ code: 'custom', message: r.message });
      }
    }),
  }),
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
});
