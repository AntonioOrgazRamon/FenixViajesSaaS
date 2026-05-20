import type { Lead, LeadDetail, LeadTravelProfile } from '@prisma/client';
import { leadTravelProfileToMapperSnapshot } from './lead-travel-profile.mapper';

export type LeadWithIntentRelations = Lead & {
  details?: LeadDetail | null;
  travelProfile?: LeadTravelProfile | null;
};

/**
 * Cadena de snapshots para `buildTravelSearchIntentFromSnapshots`.
 * Orden: legacy primero; `LeadTravelProfile` al final (mayor prioridad).
 * Opcionalmente se añaden snapshots extra al final (p. ej. intent manual del body de API).
 */
export function buildLeadIntentSnapshots(
  lead: LeadWithIntentRelations,
  ...tailSnapshots: unknown[]
): unknown[] {
  const snapshots: unknown[] = [];

  if (
    lead.normalizedPayload &&
    typeof lead.normalizedPayload === 'object' &&
    !Array.isArray(lead.normalizedPayload)
  ) {
    snapshots.push(lead.normalizedPayload);
  }

  if (lead.details?.travelContext && typeof lead.details.travelContext === 'object') {
    snapshots.push(lead.details.travelContext);
  }

  if (lead.details?.currentContext && typeof lead.details.currentContext === 'object') {
    snapshots.push(lead.details.currentContext);
  }

  if (lead.message?.trim()) {
    snapshots.push({ message: lead.message });
  }

  if (lead.travelProfile) {
    snapshots.push(leadTravelProfileToMapperSnapshot(lead.travelProfile));
  }

  for (const t of tailSnapshots) {
    if (t !== undefined && t !== null) snapshots.push(t);
  }

  return snapshots;
}
