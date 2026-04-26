import { z } from 'zod';

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
    password: z.string().min(6), // En un caso real se generaría o enviaría por email
  })
});

export const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
});
