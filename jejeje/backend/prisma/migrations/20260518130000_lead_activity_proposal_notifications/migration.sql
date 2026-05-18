-- Nuevos tipos de actividad: propuesta generada y aviso a vendedor.

ALTER TABLE `lead_activities`
MODIFY COLUMN `activity_type` ENUM(
  'CREATED',
  'UPDATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'NOTE_ADDED',
  'AGENT_RUN',
  'ENRICHED',
  'QUALIFIED',
  'CONTACTED',
  'IMPORT',
  'EXTERNAL_EVENT',
  'PROPOSAL_GENERATED',
  'SELLER_NOTIFIED'
) NOT NULL;
