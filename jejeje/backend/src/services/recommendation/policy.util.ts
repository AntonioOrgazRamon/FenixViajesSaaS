import { LuxuryLevel } from '@prisma/client';
import type { RecommendationPolicy } from './types';
import {
  DEFAULT_MAX_BUDGET_HARD_RATIO,
  DESTINATION_MAIN_POOL_MIN,
  DESTINATION_STRONG_POINTS,
} from './constants';

function normalizeProviderKey(s: string | null | undefined): string {
  if (!s?.trim()) return '';
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function mergePolicy(
  companyJson: unknown,
  overrides?: Partial<RecommendationPolicy>,
): RecommendationPolicy {
  const base: RecommendationPolicy = {
    blockedProviders: [],
    maxBudgetHardRatio: DEFAULT_MAX_BUDGET_HARD_RATIO,
    destinationMainPoolMin: DESTINATION_MAIN_POOL_MIN,
    destinationStrongPoints: DESTINATION_STRONG_POINTS,
    allowRelaxedAlternatives: true,
  };
  if (companyJson && typeof companyJson === 'object' && !Array.isArray(companyJson)) {
    const o = companyJson as Record<string, unknown>;
    if (Array.isArray(o.blockedProviders)) {
      base.blockedProviders = o.blockedProviders
        .filter((x): x is string => typeof x === 'string')
        .map((s) => normalizeProviderKey(s))
        .filter(Boolean);
    }
    if (typeof o.maxBudgetHardRatio === 'number' && o.maxBudgetHardRatio > 1) {
      base.maxBudgetHardRatio = o.maxBudgetHardRatio;
    }
    if (typeof o.allowRelaxedAlternatives === 'boolean') {
      base.allowRelaxedAlternatives = o.allowRelaxedAlternatives;
    }
  }
  if (overrides) {
    return { ...base, ...overrides, blockedProviders: overrides.blockedProviders ?? base.blockedProviders };
  }
  return base;
}

const LUXURY_ORDER: Record<LuxuryLevel, number> = {
  UNKNOWN: 0,
  ECONOMY: 1,
  STANDARD: 2,
  COMFORT: 3,
  UPSCALE: 4,
  LUXURY: 5,
  ULTRA: 6,
};

export function luxuryRank(level: LuxuryLevel | undefined | null): number {
  if (!level) return 0;
  return LUXURY_ORDER[level] ?? 0;
}
