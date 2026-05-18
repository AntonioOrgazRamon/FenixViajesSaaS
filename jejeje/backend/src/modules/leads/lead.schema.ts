import { z } from 'zod';

export const leadSourceEnum = z.enum([
  'WEB_FORM',
  'CHATBOT',
  'PLAN_CTA',
  'MANUAL',
  'IMPORT',
  'API',
  'OTHER',
]);

export const leadStatusEnum = z.enum([
  'PENDING_REVIEW',
  'NEW',
  'QUALIFYING',
  'QUALIFIED',
  'CONTACTED',
  'WAITING',
  'CONVERTED',
  'LOST',
  'ARCHIVED',
]);

export const leadPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const leadLanguageEnum = z.enum(['es', 'en']);

export const intakeBodySchema = z.object({
  source: leadSourceEnum,
  source_detail: z.string().max(150).optional(),
  company_slug: z.string().min(1).max(100),
  contact: z
    .object({
      full_name: z.string().max(255).optional(),
      first_name: z.string().max(120).optional(),
      last_name: z.string().max(120).optional(),
      email: z.string().email().optional(),
      phone: z.string().max(50).optional(),
    })
    .optional(),
  message: z.string().max(20000).optional(),
  context: z.record(z.string(), z.any()).optional(),
  raw_payload: z.unknown().optional(),
});

const reasonablePhoneRegex = /^[+()\-.\s\d]{7,20}$/;

export const publicLeadFormSchema = z.object({
  company_slug: z.string().min(1, 'Falta la empresa destino'),
  source_detail: z.string().max(150).optional(),
  origin: z.string().max(120).optional(),
  destination: z.string().trim().min(1, 'Falta el destino'),
  travel_date: z
    .string()
    .min(1, 'La fecha no es válida')
    .refine((v) => !Number.isNaN(new Date(v).getTime()), 'La fecha no es válida'),
  seats: z.coerce.number().int().gt(0, 'El número de plazas debe ser mayor que 0'),
  first_name: z.string().trim().min(1, 'Falta el nombre'),
  last_name: z.string().trim().min(1, 'Faltan los apellidos'),
  email: z.string().trim().min(1, 'Falta el correo.').email('El correo no es válido.'),
  phone: z
    .string()
    .trim()
    .min(1, 'Falta el teléfono')
    .refine((v) => reasonablePhoneRegex.test(v), 'El teléfono no tiene un formato válido'),
  raw_payload: z.unknown().optional(),
});

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  status: leadStatusEnum.optional(),
  source: leadSourceEnum.optional(),
  assigned_user_id: z.string().uuid().optional(),
  created_by_user_id: z.string().uuid().optional(),
  priority: leadPriorityEnum.optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'status']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

export const patchLeadSchema = z.object({
  status: leadStatusEnum.optional(),
  priority: leadPriorityEnum.optional().nullable(),
  assigned_user_id: z.string().uuid().nullable().optional(),
  first_name: z.string().max(120).nullable().optional(),
  last_name: z.string().max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  company_name: z.string().max(180).nullable().optional(),
  message: z.string().max(20000).nullable().optional(),
});

export const patchLeadDetailsSchema = z.object({
  purchase_history: z.unknown().optional(),
  current_context: z.unknown().optional(),
  requirements: z.unknown().optional(),
  preferences: z.unknown().optional(),
  technical_snapshot: z.unknown().optional(),
  commercial_snapshot: z.unknown().optional(),
  extra_data: z.unknown().optional(),
});

export const createNoteSchema = z.object({
  content: z.string().min(1).max(20000),
});

export const patchNoteSchema = z.object({
  content: z.string().min(1).max(20000),
});

export const runAgentsSchema = z.object({
  agent_keys: z.array(z.string().max(100)).min(1).max(10).optional(),
});
