import type { TripAiExtract } from './trip-ai.schemas';
import {
  countTripSignals,
  extractTitleLineCandidate,
  isBlockedFirstLineOrTitle,
  isHotelPageText,
  isLegalOrInfoOrIndexPage,
} from './trip-segmentation-icarion';

export type TravelSegmentDetectedType =
  | 'TRAVEL'
  | 'NARRATIVE_FRAGMENT'
  | 'HOTEL_FRAGMENT'
  | 'EDITORIAL_SECTION'
  | 'EXTENSION_SECTION'
  | 'UNKNOWN';

export type TravelSegmentValidationResult = {
  isValidTravel: boolean;
  confidence: number;
  reasons: string[];
  detectedType: TravelSegmentDetectedType;
  normalizedTitle?: string;
};

const NARRATIVE_TITLE_START =
  /^(CON|EN|DEL|DE LA|DE LOS|AL|A LA|VER|VEMOS|VEREMOS|DISFRUTAR|DISFRUTA|PASEAR|PASEAREMOS|MARAVILLARNOS|PARADA|SUS|UN|UNA|ESTE|ESTA|PODER|MARAVILLOS)\b/i;
const NARRATIVE_VERB =
  /\b(DESCUBR|DISFRUT|PASEAR|PASEAREMOS|MARAVILLARNOS|VEREMOS|SEGUIREMOS|VISITAREMOS|VISITAR|FOTOGRAFI|PODER\s+FOTO|PARADA\s+EN|DEL\s+D[IÍ]A|EN\s+UN\s+TEMPLO|EMBARQUE|ADMIRAR|CONOCER)\b/i;
const BAD_ENDING = /\b(QUE|Y|DE|CON|A|DEL|POR|EN)\s*$/i;

export function normalizeTravelTitle(title: string): string {
  return title
    .replace(/[’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—]\s*$/, '')
    .replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, '')
    .trim();
}

export function looksNarrativeOrBrokenTitle(title: string): boolean {
  const t = normalizeTravelTitle(title);
  if (!t) return true;
  if (t.length < 5 || t.length > 95) return true;
  if (NARRATIVE_TITLE_START.test(t)) return true;
  if (NARRATIVE_VERB.test(t)) return true;
  if (BAD_ENDING.test(t)) return true;
  if (/\bD[ÍI]A[S]?\s*\d+\b/i.test(t)) return true;
  if (/[,:;.!?]/.test(t) && t.length > 20) return true;
  return false;
}

function detectSegmentType(text: string, titleHint: string): TravelSegmentDetectedType {
  const t = titleHint.trim();
  if (/EXTENSIONES?\s+A\s+PLAYAS?/i.test(text) || /EXTENSIONES?\s+A\s+PLAYAS?/i.test(t)) {
    return 'EXTENSION_SECTION';
  }
  if (isLegalOrInfoOrIndexPage(text)) {
    return 'EDITORIAL_SECTION';
  }
  if (isHotelPageText(text)) {
    return 'HOTEL_FRAGMENT';
  }
  if (looksNarrativeOrBrokenTitle(t)) {
    return 'NARRATIVE_FRAGMENT';
  }
  return 'UNKNOWN';
}

export function validateTravelSegment(input: {
  segmentText: string;
  titleHint: string;
}): TravelSegmentValidationResult {
  const reasons: string[] = [];
  const text = input.segmentText;
  const titleRaw = input.titleHint || extractTitleLineCandidate(text) || '';
  const title = normalizeTravelTitle(titleRaw);
  const detectedType = detectSegmentType(text, title);
  const signals = countTripSignals(text);

  let score = 0;
  if (title && !isBlockedFirstLineOrTitle(title) && !looksNarrativeOrBrokenTitle(title)) {
    score += 0.28;
    reasons.push('title-valid');
  } else {
    reasons.push('title-invalid');
  }
  if (signals.flags.includes('itinerary')) score += 0.23;
  if (signals.flags.includes('duration')) score += 0.14;
  if (signals.flags.includes('servicios')) score += 0.1;
  if (signals.flags.includes('salidas')) score += 0.1;
  if (signals.flags.includes('precio')) score += 0.1;
  if (signals.flags.includes('a_tener')) score += 0.05;

  if (detectedType === 'NARRATIVE_FRAGMENT') {
    score -= 0.35;
    reasons.push('detected-narrative');
  } else if (detectedType === 'HOTEL_FRAGMENT') {
    score -= 0.45;
    reasons.push('detected-hotel-fragment');
  } else if (detectedType === 'EDITORIAL_SECTION' || detectedType === 'EXTENSION_SECTION') {
    score -= 0.5;
    reasons.push(`detected-${detectedType.toLowerCase()}`);
  }

  const hasStrongStructure =
    signals.flags.includes('itinerary') &&
    signals.flags.includes('duration') &&
    signals.flags.includes('servicios') &&
    signals.flags.includes('salidas');

  if (!hasStrongStructure) reasons.push('missing-strong-structure');
  const confidence = Math.max(0, Math.min(1, score));
  const isValidTravel = confidence >= 0.7 && hasStrongStructure && detectedType !== 'NARRATIVE_FRAGMENT' && detectedType !== 'HOTEL_FRAGMENT' && detectedType !== 'EDITORIAL_SECTION' && detectedType !== 'EXTENSION_SECTION';

  return {
    isValidTravel,
    confidence,
    reasons,
    detectedType: isValidTravel ? 'TRAVEL' : detectedType,
    normalizedTitle: title || undefined,
  };
}

export function calculateTripQualityScore(
  trip: Pick<
    TripAiExtract,
    'title' | 'mainDestination' | 'description' | 'durationDays' | 'durationNights' | 'itineraryDays' | 'services' | 'departures' | 'hotels'
  >,
  segmentValidation: TravelSegmentValidationResult,
): { qualityScore: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 0.15;
  const title = (trip.title ?? '').trim();
  const destination = (trip.mainDestination ?? '').trim();
  const description = (trip.description ?? '').replace(/\s+/g, ' ').trim();

  if (segmentValidation.isValidTravel) score += 0.2;
  else warnings.push('segment_invalid');
  if (title && !looksNarrativeOrBrokenTitle(title) && !isBlockedFirstLineOrTitle(title)) score += 0.15;
  else warnings.push('title_invalid');
  if (trip.durationDays != null && trip.durationNights != null) score += 0.12;
  else warnings.push('duration_missing');
  if (trip.itineraryDays.some((d) => d.dayNumber === 1)) score += 0.12;
  else warnings.push('day1_missing');
  if (trip.services.length > 0) score += 0.08;
  else warnings.push('services_missing');
  if (trip.departures.length > 0) score += 0.06;
  else warnings.push('departures_missing');
  if (trip.hotels.length > 0) score += 0.08;
  else warnings.push('hotels_missing');
  if (
    destination &&
    !/EXTENSIONES A PLAYAS|SERVICIOS INCLUIDOS|PRECIO ORIENTATIVO|SALIDAS/i.test(destination)
  ) {
    score += 0.08;
  } else {
    warnings.push('destination_invalid');
  }
  if (
    description &&
    description.length > 20 &&
    !/^([A-ZÁÉÍÓÚÑ]+\s+20\d{2}\s*\/\s*20?\d{2,4})+$/i.test(description)
  ) {
    score += 0.06;
  } else {
    warnings.push('description_noise');
  }
  return { qualityScore: Math.max(0, Math.min(1, score)), warnings };
}

