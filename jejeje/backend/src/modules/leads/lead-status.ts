import { LeadStatus } from '@prisma/client';

const TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  PENDING_REVIEW: ['NEW', 'QUALIFYING', 'LOST'],
  NEW: ['QUALIFYING'],
  QUALIFYING: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['CONTACTED', 'LOST'],
  CONTACTED: ['WAITING', 'CONVERTED', 'LOST'],
  WAITING: ['CONTACTED', 'CONVERTED', 'LOST'],
  CONVERTED: ['ARCHIVED'],
  LOST: ['ARCHIVED'],
  ARCHIVED: [],
};

export function isValidLeadStatusTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}
