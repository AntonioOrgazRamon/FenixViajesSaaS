/**
 * QA importación JSON (staging → BD): tests en memoria + smoke opcional con MySQL.
 *
 * Uso:
 *   npm run qa:travel-json-import
 *   npm run qa:travel-json-import -- --companyId=<uuid>
 *
 * El smoke crea viajes con slug prefijo `qa-json-import-` y borra staging + esos viajes al terminar.
 */
import 'dotenv/config';
import assert from 'assert';
import type { Request } from 'express';
import fs from 'fs';
import path from 'path';
import { assertPasteImportCompanyScope, resolveTenantCompanyId } from '../src/common/company-context';
import { ValidationError } from '../src/common/errors/AppError';
import prisma from '../src/infrastructure/db';
import { TravelJsonImportService } from '../src/modules/travel/travel-json-import.service';
import {
  assertPasteJsonContentWithinLimit,
  getTravelJsonImportMaxBytes,
  normalizeRootJsonToTripsArray,
  parseJsonTextToTripsArray,
} from '../src/services/travel/travel-json-import-parse';
import {
  travelJsonEnrichedFileZ,
} from '../src/services/travel/travel-json-import.schema';
import {
  classifyTravelJsonTrip,
  coerceTravelImportRootToEnriched,
  normalizeImportSlug,
  normalizeItineraryDay,
} from '../src/services/travel/travel-json-import-validation';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

function mockReq(partial: Record<string, unknown>): Request {
  return partial as unknown as Request;
}

function assertThrowsValidation(fn: () => unknown, label: string) {
  try {
    fn();
    assert.fail(`${label}: esperaba ValidationError`);
  } catch (e) {
    assert.ok(e instanceof ValidationError, `${label}: tipo de error`);
    assert.strictEqual((e as ValidationError).code, 'VALIDATION_ERROR', label);
  }
}

async function runPasteNormalizationTests() {
  assert.deepStrictEqual(normalizeRootJsonToTripsArray([{ a: 1 }]), [{ a: 1 }]);
  assert.strictEqual(normalizeRootJsonToTripsArray({ slug: 'solo' }).length, 1);
  assertThrowsValidation(() => normalizeRootJsonToTripsArray([]), 'empty-array');
  assertThrowsValidation(() => normalizeRootJsonToTripsArray(null), 'null-root');
  assertThrowsValidation(() => normalizeRootJsonToTripsArray('x'), 'string-root');

  const okEnrichedOne = parseJsonTextToTripsArray(
    '{"source":{"documentName":null,"pageStart":null,"pageEnd":null,"rawReference":null,"confidence":null},"trip":{"title":"t","slug":"s","mainDestination":"m","durationDays":3,"countries":[],"cities":[],"regions":[],"islands":[],"currency":"EUR","secondaryDestinations":[],"continents":[],"seasonality":[],"travelStyles":[],"idealFor":[],"shortDescription":"","longDescription":"","highlights":[],"includedServices":[],"excludedServices":[],"hotels":[],"transport":[],"mealPlan":[],"itinerary":[],"importantNotes":[],"availabilityNotes":[],"requirements":[],"rawSnippets":[]},"metadata":{"extractionConfidence":1,"needsManualReview":false,"missingImportantFields":[],"possibleProblems":[]}}',
  );
  assert.strictEqual(okEnrichedOne.length, 1);

  const okLegacyArr = parseJsonTextToTripsArray(
    '[{"title":"t","slug":"s","mainDestination":"m","durationDays":3}]',
  );
  assert.strictEqual(okLegacyArr.length, 1);

  assertThrowsValidation(() => parseJsonTextToTripsArray('{syntax'), 'bad-syntax');

  const max = getTravelJsonImportMaxBytes();
  assertThrowsValidation(
    () => assertPasteJsonContentWithinLimit(Buffer.alloc(max + 1, 97).toString('utf8')),
    'oversize-paste',
  );

  console.log('qa:travel-json-import — paste / normalización raíz OK');
}

function runPasteTenantGuardTests() {
  assertThrowsValidation(
    () =>
      resolveTenantCompanyId(
        mockReq({
          user: { id: 'u-super', role: 'SUPER_ADMIN', companyId: null },
          body: {},
          query: {},
        }),
      ),
    'super-admin-sin-companyId',
  );

  assertThrowsValidation(
    () =>
      assertPasteImportCompanyScope(
        mockReq({
          user: { id: 'u-ca', role: 'COMPANY_ADMIN', companyId: 'company-a' },
        }),
        'company-b',
      ),
    'company-admin-companyId-cruzado',
  );

  assertPasteImportCompanyScope(
    mockReq({ user: { id: 'u-ok', role: 'COMPANY_ADMIN', companyId: 'company-a' } }),
    undefined,
  );
  assertPasteImportCompanyScope(
    mockReq({ user: { id: 'u-ok2', role: 'COMPANY_ADMIN', companyId: 'company-a' } }),
    'company-a',
  );

  console.log('qa:travel-json-import — guards multi-tenant paste OK');
}

async function runPasteServicePreflightTests() {
  const svc = new TravelJsonImportService();
  await assert.rejects(
    () =>
      svc.pasteJsonContent({
        companyId: '00000000-0000-0000-0000-000000000001',
        uploadedByUserId: 'qa-user',
        fileName: 'empty-paste.json',
        jsonContent: '   ',
      }),
    ValidationError,
    'jsonContent sólo espacios',
  );

  await assert.rejects(
    () =>
      svc.pasteJsonContent({
        companyId: '00000000-0000-0000-0000-000000000001',
        uploadedByUserId: 'qa-user',
        fileName: 'bad.json',
        jsonContent: '[{"oops"',
      }),
    ValidationError,
    'JSON pegado mal formado',
  );

  console.log('qa:travel-json-import — servicio paste (preflight) OK');
}

function runFlexibleTravelJsonImportContractTests() {
  assert.strictEqual(normalizeItineraryDay({ day: 1, title: 'x', description: 'y', locations: [] })?.dayNumber, 1);
  assert.strictEqual(
    normalizeItineraryDay({ dayNumber: 2, title: 'x', description: 'y', locations: [] })?.dayNumber,
    2,
  );
  assert.strictEqual(normalizeItineraryDay({ title: 'sin día' }), null);

  const baseMeta = {
    extractionConfidence: 1,
    needsManualReview: false,
    missingImportantFields: [] as string[],
    possibleProblems: [] as string[],
  };
  const baseSource = {
    documentName: null as string | null,
    pageStart: null as number | null,
    pageEnd: null as number | null,
    rawReference: null as string | null,
    confidence: null as number | null,
  };

  function enrichedTrip(partial: Record<string, unknown>) {
    return {
      source: baseSource,
      metadata: baseMeta,
      trip: {
        title: 'Contrato flexible',
        slug: 'qa-flex-base',
        mainDestination: 'Argentina',
        durationDays: 3,
        countries: ['Argentina'],
        cities: ['Buenos Aires'],
        currency: 'EUR',
        secondaryDestinations: [],
        continents: [],
        regions: [],
        islands: [],
        seasonality: [],
        travelStyles: [] as string[],
        idealFor: [],
        shortDescription: '',
        longDescription: '',
        highlights: ['Un highlight'],
        includedServices: [],
        excludedServices: [],
        hotels: [],
        transport: [],
        mealPlan: [],
        itinerary: [] as Record<string, unknown>[],
        importantNotes: [],
        availabilityNotes: [],
        requirements: [],
        rawSnippets: [],
        priceFrom: 100,
        ...partial,
      },
    };
  }

  const cDay = classifyTravelJsonTrip(
    enrichedTrip({
      slug: 'qa-flex-itinerary-day',
      itinerary: [{ day: 1, title: 'Llegada', description: 'Hotel', locations: [] }],
    }),
  );
  assert.strictEqual(cDay.normalized.trip.itinerary[0]?.dayNumber, 1);
  assert.notStrictEqual(cDay.status, 'INVALID');

  const cDayNum = classifyTravelJsonTrip(
    enrichedTrip({
      slug: 'qa-flex-itinerary-daynumber',
      itinerary: [{ dayNumber: 2, title: 'City tour', description: 'Centro', locations: ['Microcentro'] }],
    }),
  );
  assert.strictEqual(cDayNum.normalized.trip.itinerary[0]?.dayNumber, 2);
  assert.notStrictEqual(cDayNum.status, 'INVALID');

  const cBadIt = classifyTravelJsonTrip(
    enrichedTrip({
      slug: 'qa-flex-itinerary-sin-dia',
      itinerary: [{ title: 'Fila sin índice', description: 'x', locations: [] }],
    }),
  );
  assert.strictEqual(cBadIt.status, 'INVALID');

  const cStylesEs = classifyTravelJsonTrip(
    enrichedTrip({
      slug: 'qa-flex-styles-es',
      travelStyles: ['Gastronomía', 'Tradiciones locales', 'Vino'],
      itinerary: [{ day: 1, title: 'a', description: 'b', locations: [] }],
    }),
  );
  assert.notStrictEqual(cStylesEs.status, 'INVALID');

  const cPace = classifyTravelJsonTrip(
    enrichedTrip({
      slug: 'qa-flex-pace-moderate',
      pace: 'moderate',
      itinerary: [{ day: 1, title: 'a', description: 'b', locations: [] }],
    }),
  );
  assert.strictEqual(cPace.normalized.trip.pace, 'BALANCED');

  const fixturePath = path.join(process.cwd(), 'fixtures/travel-import-sample.json');
  const allTrips = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Record<string, unknown>[];
  const argentinaChatgpt = allTrips.filter((row) => {
    const slug = (row as { trip?: { slug?: string } }).trip?.slug ?? '';
    return slug.includes('argentina-chatgpt');
  });
  assert.strictEqual(argentinaChatgpt.length, 2, 'fixture debe incluir 2 viajes Argentina ChatGPT');
  for (const row of argentinaChatgpt) {
    const c = classifyTravelJsonTrip(row);
    assert.notStrictEqual(c.status, 'INVALID');
    assert.strictEqual(c.status, 'WARNING');
  }

  const duoJson = JSON.stringify([allTrips[2], allTrips[3]]);
  const parsedDuo = parseJsonTextToTripsArray(duoJson);
  assert.strictEqual(parsedDuo.length, 2);

  console.log('qa:travel-json-import — contrato ChatGPT (itinerary day/pace/styles) OK');
}

async function runMemoryTests() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'fixtures/travel-import-sample.json'), 'utf8'),
  );
  const parsed = travelJsonEnrichedFileZ.safeParse(raw);
  assert.strictEqual(parsed.success, true, 'fixture debe cumplir schema enriquecido Zod');

  const first = parsed.data[0]!;
  const c1 = classifyTravelJsonTrip(first);
  assert.strictEqual(c1.status, 'VALID', 'primer viaje fixture debe ser VALID');

  const second = parsed.data[1]!;
  const c2 = classifyTravelJsonTrip(second);
  assert.strictEqual(c2.status, 'WARNING', 'segundo ítem fixture debe ser WARNING');

  const third = parsed.data[2]!;
  const c3 = classifyTravelJsonTrip(third);
  assert.strictEqual(c3.status, 'WARNING', 'Argentina ChatGPT A debe ser WARNING, no INVALID');

  const fourth = parsed.data[3]!;
  const c4 = classifyTravelJsonTrip(fourth);
  assert.strictEqual(c4.status, 'WARNING', 'Argentina ChatGPT B debe ser WARNING, no INVALID');

  const missingTrip = classifyTravelJsonTrip({ source: {}, metadata: {} });
  assert.strictEqual(missingTrip.status, 'INVALID');

  const enrichedMissTitle = classifyTravelJsonTrip({
    ...first,
    trip: { ...(first.trip as object), title: '' },
  });
  assert.strictEqual(enrichedMissTitle.status, 'INVALID');

  const manualReviewWarn = classifyTravelJsonTrip({
    source: first.source,
    trip: first.trip,
    metadata: { ...first.metadata, needsManualReview: true, extractionConfidence: 1 },
  });
  assert.strictEqual(manualReviewWarn.status, 'WARNING');

  const lowConfWarn = classifyTravelJsonTrip({
    source: first.source,
    trip: first.trip,
    metadata: { ...first.metadata, needsManualReview: false, extractionConfidence: 0.5 },
  });
  assert.strictEqual(lowConfWarn.status, 'WARNING');

  const lc = coerceTravelImportRootToEnriched({
    title: 'Legado',
    slug: 'leg-plane',
    mainDestination: 'Madrid',
    durationDays: 4,
    priceFrom: 899,
    countries: ['España'],
    cities: ['Madrid'],
    itinerary: [{ dayNumber: 1, title: 'Día 1', description: null }],
    highlights: ['Museos'],
    includedServices: [],
    excludedServices: [],
    currency: 'EUR',
  }) as Record<string, unknown>;
  assert.ok(lc && typeof lc === 'object' && lc.trip && typeof lc.trip === 'object');
  assert.strictEqual(classifyTravelJsonTrip(lc).status, 'VALID');

  const badFlat = classifyTravelJsonTrip({
    title: '',
    slug: 'x',
    mainDestination: '',
    durationDays: 0,
    countries: [],
    cities: [],
    itinerary: [],
    highlights: [],
    includedServices: [],
  });
  assert.strictEqual(badFlat.status, 'INVALID');

  assert.strictEqual(normalizeImportSlug('  Vietnam Premium!!! '), 'vietnam-premium');
  console.log('qa:travel-json-import — tests en memoria OK');
}

async function runSmoke(companyId: string) {
  const admin = await prisma.user.findFirst({
    where: { companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });
  if (!admin) {
    console.warn('qa:travel-json-import — sin COMPANY_ADMIN activo; smoke omitido.');
    return;
  }

  const suffix = `${Date.now()}`;
  const fixturePath = path.join(process.cwd(), 'fixtures/travel-import-sample.json');
  const trips = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Record<string, unknown>[];
  const slugValue = `qa-json-import-trip-${suffix}`;
  const tripOk: Record<string, unknown> = {
    ...trips[0],
    trip: { ...(trips[0]!.trip as Record<string, unknown>), slug: slugValue },
  };
  const buf = Buffer.from(JSON.stringify([tripOk]), 'utf8');

  const svc = new TravelJsonImportService();
  const batch = await svc.uploadBuffer({
    companyId,
    uploadedByUserId: admin.id,
    fileName: `qa-travel-json-import-${suffix}.json`,
    buffer: buf,
  });

  const pasteBatch = await svc.pasteJsonContent({
    companyId,
    uploadedByUserId: admin.id,
    fileName: `qa-travel-json-import-paste-${suffix}.json`,
    jsonContent: JSON.stringify(tripOk),
  });
  assert.strictEqual(pasteBatch.totalItems >= 1, true, 'paste objeto único enriquecido debe crear ítems');

  const summary = await svc.importBatch({
    batchId: batch.id,
    companyId,
    actorUserId: admin.id,
    actorRole: 'COMPANY_ADMIN',
  });

  assert.strictEqual(summary.imported >= 1, true, 'debe importar al menos un viaje válido desde formato enriquecido');

  const duoSuffix = `${suffix}-duo`;
  const tripArA = {
    ...trips[2],
    trip: { ...(trips[2]!.trip as Record<string, unknown>), slug: `qa-json-import-argentina-duo-a-${duoSuffix}` },
  };
  const tripArB = {
    ...trips[3],
    trip: { ...(trips[3]!.trip as Record<string, unknown>), slug: `qa-json-import-argentina-duo-b-${duoSuffix}` },
  };
  const duoBuf = Buffer.from(JSON.stringify([tripArA, tripArB]), 'utf8');
  const duoUpload = await svc.uploadBuffer({
    companyId,
    uploadedByUserId: admin.id,
    fileName: `qa-travel-json-import-duo-${suffix}.json`,
    buffer: duoBuf,
  });
  assert.strictEqual(duoUpload.totalItems, 2, 'upload con 2 viajes enriquecidos debe crear 2 ítems');
  assert.strictEqual(
    duoUpload.items.filter((i) => i.validationStatus === 'INVALID').length,
    0,
    'ningún ítem del duo Argentina debe ser INVALID',
  );

  const duoPaste = await svc.pasteJsonContent({
    companyId,
    uploadedByUserId: admin.id,
    fileName: `qa-travel-json-import-paste-duo-${suffix}.json`,
    jsonContent: JSON.stringify([tripArA, tripArB]),
  });
  assert.strictEqual(duoPaste.totalItems, 2, 'paste con 2 viajes enriquecidos debe crear 2 ítems');

  const slugNorm = normalizeImportSlug(slugValue);
  const trip = await prisma.travelTrip.findFirst({
    where: { companyId, importSlug: slugNorm },
    include: {
      tripDestinations: true,
      highlights: true,
      itineraryDays: true,
      tripGeoPlaces: { include: { geoPlace: true } },
    },
  });
  assert.ok(trip, 'TravelTrip con importSlug esperado');
  assert.ok((trip!.tripGeoPlaces?.length ?? 0) > 0, 'TripGeoPlace enlazados tras import');

  await prisma.travelTrip.deleteMany({
    where: { companyId, importSlug: { startsWith: 'qa-json-import-' } },
  });
  await prisma.travelJsonImportBatch.deleteMany({
    where: {
      companyId,
      OR: [
        { fileName: { startsWith: 'qa-travel-json-import-' } },
        { fileName: { startsWith: 'qa-travel-json-import-duo-' } },
        { fileName: { startsWith: 'qa-travel-json-import-paste-duo-' } },
      ],
    },
  });

  console.log('qa:travel-json-import — smoke DB OK');
}

async function main() {
  runFlexibleTravelJsonImportContractTests();
  await runMemoryTests();
  await runPasteNormalizationTests();
  runPasteTenantGuardTests();
  await runPasteServicePreflightTests();
  const companyId = arg('--companyId')?.trim();
  if (!companyId) {
    console.log('qa:travel-json-import — sin --companyId: smoke DB omitido.');
    return;
  }
  await runSmoke(companyId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
