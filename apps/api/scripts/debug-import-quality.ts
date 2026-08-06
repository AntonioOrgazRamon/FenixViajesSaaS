import { readFile } from 'fs/promises';
import { buildIcarionSegments } from '../src/services/travel/trip-segmentation-icarion';
import { deepCleanTouristicText } from '../src/services/travel/trip-touristic-deep-clean.service';
import { validateTravelSegment } from '../src/services/travel/travel-segment-validator.service';
import { extractStructuredTripCatalog } from '../src/services/travel/trip-structured-catalog-extract.service';
import { segmentTouristicDocument } from '../src/services/travel/trip-document-blocks.service';

type PageText = { page: number; text: string };
type ExtractedFile = { pages: PageText[]; totalPages?: number };

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: npx ts-node --transpile-only scripts/debug-import-quality.ts <path-json-extracted>');
    process.exit(1);
  }
  const raw = await readFile(file, 'utf-8');
  const data = JSON.parse(raw) as ExtractedFile;
  const pages = data.pages ?? [];
  const segs = buildIcarionSegments(pages, { log: false }).segments;

  let valid = 0;
  const rejectedByReason = new Map<string, number>();
  const titleCount = new Map<string, number>();
  const suspiciousTitles: string[] = [];
  let noPrice = 0;
  let noDuration = 0;
  let noDay1 = 0;
  let badDesc = 0;
  let invalidMainDestination = 0;
  let suspiciousHotels = 0;

  for (const s of segs) {
    const cleaned = deepCleanTouristicText(s.rawTextForAI);
    const val = validateTravelSegment({ titleHint: s.title, segmentText: cleaned });
    if (val.isValidTravel) valid++;
    else {
      for (const r of val.reasons) {
        rejectedByReason.set(r, (rejectedByReason.get(r) ?? 0) + 1);
      }
    }

    const titleKey = (val.normalizedTitle ?? s.title).toUpperCase().replace(/\s+/g, ' ').trim();
    titleCount.set(titleKey, (titleCount.get(titleKey) ?? 0) + 1);
    if (/^(CON|EN|DEL|DE LA|DE LOS|AL|A LA|VER)\b/i.test(titleKey) || titleKey.length > 90) {
      suspiciousTitles.push(titleKey);
    }

    if (!val.isValidTravel) continue;
    const blocks = segmentTouristicDocument(cleaned);
    const st = extractStructuredTripCatalog(blocks, s.title, cleaned);
    if (!st.durationDays || !st.durationNights) noDuration++;
    if (!st.itineraryDays.some((d) => d.dayNumber === 1)) noDay1++;
    if (!/PRECIO\s+ORIENTATIVO/i.test(cleaned)) noPrice++;
    if (!st.shortDescription || st.shortDescription.length < 20 || /^([A-ZÁÉÍÓÚÑ]+\s+20\d{2})/i.test(st.shortDescription)) badDesc++;
    if (!st.mainDestination || /EXTENSIONES A PLAYAS|SERVICIOS INCLUIDOS|SALIDAS|PRECIO ORIENTATIVO/i.test(st.mainDestination)) {
      invalidMainDestination++;
    }
    for (const h of st.hotels) {
      const hn = (h.hotelName ?? '').trim();
      if (!hn || /^(Hotel|Resort|Beach|Central|Boutique)$/i.test(hn) || /\bD[ÍI]A\b/i.test(hn)) suspiciousHotels++;
    }
  }

  const duplicatedTitles = Array.from(titleCount.entries()).filter(([, n]) => n > 1);
  const rejectionGrouped = Array.from(rejectedByReason.entries()).sort((a, b) => b[1] - a[1]);
  console.log(
    JSON.stringify(
      {
        totalSegments: segs.length,
        validTrips: valid,
        rejectedSegments: segs.length - valid,
        rejectionReasonsGrouped: rejectionGrouped,
        duplicatedTitles,
        suspiciousTitles: Array.from(new Set(suspiciousTitles)).slice(0, 40),
        tripsWithoutPrice: noPrice,
        tripsWithoutDuration: noDuration,
        tripsWithoutDay1: noDay1,
        tripsWithBadDescription: badDesc,
        tripsWithInvalidMainDestination: invalidMainDestination,
        suspiciousHotels,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error('FAIL debug-import-quality', e);
  process.exit(1);
});

