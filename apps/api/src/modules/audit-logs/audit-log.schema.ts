import { z } from 'zod';

export const getAuditLogsSchema = z.object({
  companyId: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional(),
  action: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
});
