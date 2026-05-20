/**
 * Etiquetas en español para enums y códigos que llegan del API (valor técnico → copia UI).
 */

export const LEAD_STATUS_LABELS_ES: Record<string, string> = {
  PENDING_REVIEW: 'Pendiente de revisión',
  NEW: 'Nuevo',
  QUALIFYING: 'En cualificación',
  QUALIFIED: 'Cualificado',
  CONTACTED: 'Contactado',
  WAITING: 'En espera',
  CONVERTED: 'Convertido',
  LOST: 'Perdido',
  ARCHIVED: 'Archivado',
};

export function labelLeadStatusEs(code: string): string {
  return LEAD_STATUS_LABELS_ES[code] ?? code;
}

export const LEAD_PRIORITY_LABELS_ES: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export function labelLeadPriorityEs(code: string): string {
  return LEAD_PRIORITY_LABELS_ES[code] ?? code;
}

/** LeadActivityType (Prisma) */
export const LEAD_ACTIVITY_TYPE_LABELS_ES: Record<string, string> = {
  CREATED: 'Lead creado',
  UPDATED: 'Ficha actualizada',
  STATUS_CHANGED: 'Cambio de estado',
  ASSIGNED: 'Asignación',
  NOTE_ADDED: 'Nota interna',
  AGENT_RUN: 'Automatización ejecutada',
  ENRICHED: 'Datos enriquecidos',
  QUALIFIED: 'Cualificación',
  CONTACTED: 'Contacto registrado',
  IMPORT: 'Importación',
  EXTERNAL_EVENT: 'Evento externo',
  PROPOSAL_GENERATED: 'Propuesta generada',
  SELLER_NOTIFIED: 'Vendedor notificado',
};

export function labelLeadActivityTypeEs(code: string): string {
  return LEAD_ACTIVITY_TYPE_LABELS_ES[code] ?? code.replace(/_/g, ' ');
}

/** LeadAgentRunStatus */
export const LEAD_AGENT_RUN_STATUS_LABELS_ES: Record<string, string> = {
  PENDING: 'Pendiente',
  RUNNING: 'En ejecución',
  SUCCESS: 'Completado',
  FAILED: 'Fallido',
  SKIPPED: 'Omitido',
};

export function labelLeadAgentRunStatusEs(code: string): string {
  return LEAD_AGENT_RUN_STATUS_LABELS_ES[code] ?? code;
}

export const PROPOSAL_STATUS_LABELS_ES: Record<string, string> = {
  DRAFT: 'Borrador',
  GENERATED: 'Generada',
  SENT_TO_SELLER: 'Enviada al vendedor',
  SENT_TO_CLIENT: 'Enviada al cliente',
  ARCHIVED: 'Archivada',
};

export function labelProposalStatusEs(code: string): string {
  return PROPOSAL_STATUS_LABELS_ES[code] ?? code;
}

/** TravelStyleAxis (Prisma) — filtros y playground */
export const TRAVEL_STYLE_AXIS_LABELS_ES: Record<string, string> = {
  CULTURE: 'Cultura',
  BEACH: 'Playa',
  NATURE: 'Naturaleza',
  ADVENTURE: 'Aventura',
  GASTRONOMY: 'Gastronomía',
  WELLNESS: 'Bienestar',
  NIGHTLIFE: 'Vida nocturna',
  CITY_BREAK: 'Escapada urbana',
  CRUISE: 'Crucero',
  SAFARI: 'Safari',
  SKI: 'Esquí',
  ROAD_TRIP: 'Ruta en coche',
  SHOPPING: 'Compras',
  FAMILY: 'Familia',
  HONEYMOON: 'Luna de miel',
  SENIOR_FRIENDLY: 'Senior friendly',
  ACCESSIBILITY: 'Accesibilidad',
  WILDLIFE: 'Fauna salvaje',
  PHOTOGRAPHY: 'Fotografía',
};

export function labelTravelStyleAxisEs(code: string): string {
  return TRAVEL_STYLE_AXIS_LABELS_ES[code] ?? code.replace(/_/g, ' ');
}
