import { z } from 'zod';

/** Alineado con enum `ProposalStatus` en Prisma. */
export const proposalStatusEnum = z.enum([
  'DRAFT',
  'GENERATED',
  'SENT_TO_SELLER',
  'SENT_TO_CLIENT',
  'ARCHIVED',
]);

/** Alineado con enum `ProposalArtifactKind` en Prisma. */
export const proposalArtifactKindEnum = z.enum(['PDF', 'HTML_FILE', 'ATTACHMENT', 'OTHER']);

export type ProposalStatusDto = z.infer<typeof proposalStatusEnum>;
export type ProposalArtifactKindDto = z.infer<typeof proposalArtifactKindEnum>;

/** Fila de viaje seleccionado dentro de una versión (DTO de boundary). */
export const proposalTripInputSchema = z.object({
  travelTripId: z.string().uuid(),
  orderIndex: z.number().int().min(0).optional(),
  score: z.number().finite().nullable().optional(),
  reasons: z.unknown().nullable().optional(),
});

/** Crear cabecera de propuesta + primera versión (patrón recomendado en servicio). */
export const createProposalWithVersionSchema = z.object({
  leadId: z.string().uuid(),
  status: proposalStatusEnum.optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  intentSnapshot: z.unknown().nullable().optional(),
  generatedHtml: z.string().nullable().optional(),
  pdfStoragePath: z.string().max(1000).nullable().optional(),
  pdfPublicUrl: z.string().max(1000).url().nullable().optional().or(z.literal('')),
  trips: z.array(proposalTripInputSchema).min(1),
});

/** Nueva versión inmutable (incrementa `versionNumber` en servidor). */
export const addProposalVersionSchema = z.object({
  intentSnapshot: z.unknown().nullable().optional(),
  generatedHtml: z.string().nullable().optional(),
  pdfStoragePath: z.string().max(1000).nullable().optional(),
  pdfPublicUrl: z.string().max(1000).url().nullable().optional().or(z.literal('')),
  trips: z.array(proposalTripInputSchema).min(1),
});

export const patchProposalHeaderSchema = z.object({
  status: proposalStatusEnum.optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
});

export const proposalArtifactInputSchema = z.object({
  kind: proposalArtifactKindEnum,
  storagePath: z.string().max(1000),
  publicUrl: z.string().max(1000).url().nullable().optional().or(z.literal('')),
  mimeType: z.string().max(120).nullable().optional(),
  fileSize: z.number().int().min(0).nullable().optional(),
  metadata: z.unknown().nullable().optional(),
});

export type CreateProposalWithVersionInput = z.infer<typeof createProposalWithVersionSchema>;
export type AddProposalVersionInput = z.infer<typeof addProposalVersionSchema>;
export type PatchProposalHeaderInput = z.infer<typeof patchProposalHeaderSchema>;
export type ProposalTripInput = z.infer<typeof proposalTripInputSchema>;
export type ProposalArtifactInput = z.infer<typeof proposalArtifactInputSchema>;

/** Body de POST /api/v1/proposals/:leadId/generate */
export const generateProposalSchema = z
  .object({
    intentSnapshot: z.unknown().optional(),
    trips: z.array(proposalTripInputSchema).optional(),
    /** Por defecto true si existe OPENAI_API_KEY en servidor; el servidor fuerza false si no hay clave. */
    useAiCopy: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.trips !== undefined && data.trips.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Si envías trips, incluye al menos un travelTripId',
        path: ['trips'],
      });
    }
  });

export type GenerateProposalBody = z.infer<typeof generateProposalSchema>;
