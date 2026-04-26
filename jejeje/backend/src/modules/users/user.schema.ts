import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  role: z.enum(['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_USER']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'LOCKED', 'DELETED']).optional(),
  companyId: z.string().uuid().optional(),
  phone: z.string().optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  role: z.enum(['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_USER']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'LOCKED', 'DELETED']).optional(),
  companyId: z.string().uuid().optional(),
  phone: z.string().optional(),
});
