import { z } from 'zod';

export const revokeSessionSchema = z.object({
  reason: z.string().optional(),
});
