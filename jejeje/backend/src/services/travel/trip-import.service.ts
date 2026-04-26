import { readFile } from 'fs/promises';
import path from 'path';
import { type DestinationKind, type TripServiceKind } from '@prisma/client';
import prisma from '../../infrastructure/db';
import { PdfExtractionService, type PageText } from './pdf-extraction.service';
import { TripSegmentationService } from './trip-segmentation.service';
import { TripAIExtractionService } from './trip-ai-extraction.service';
import { TripNormalizationService } from './trip-normalization.service';
import { TripDeterministicExtractionService, mergeDeterministicWithAi } from './trip-deterministic-extraction.service';
import type { TripAiExtract } from './trip-ai.schemas';
import { config } from '../../common/config';
import { NotFoundError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';
import { cleanRepeatedCatalogHeaders } from './trip-text-cleaning.service';
import { deepCleanTouristicText } from './trip-touristic-deep-clean.service';
import { segmentTouristicDocument } from './trip-document-blocks.service';
import { extractStructuredTripCatalog, mergeStructuredIntoTripExtract } from './trip-structured-catalog-extract.service';
import { filterHotelsForPersistence, normKey, normalizeHotelName } from './trip-hotels-extract.service';
import { countTripSignals, isBlockedFirstLineOrTitle } from './trip-segmentation-icarion';

const pdfExtraction = new PdfExtractionService();
const segmentation = new TripSegmentationService();
const aiExtraction = new TripAIExtractionService();
const normalizer = new TripNormalizationService();
const deterministic = new TripDeterministicExtractionService();

type ExtractedFile = { pages: PageText[]; totalPages: number };

/**
 * FASE 7 — Orquesta extracción → segmentación → IA → persistencia.
 */
export class TripImportService {
  async startProcessingJob(documentId: string, companyId: string): Promise<{ jobId: string }> {
    const doc = await prisma.travelDocument.findFirst({
      where: { id: documentId, companyId },
    });
    if (!doc) {
      throw new NotFoundError('Documento no encontrado');
    }

    const job = await prisma.travelImportJob.create({
      data: {
        companyId,
        documentId,
        status: 'PENDING',
        progress: 0,
        currentStep: 'queued',
      },
    });

    setImmediate(() => {
      this.runPipeline(job.id, documentId, companyId).catch((e) => {
        logger.error(e, 'runPipeline failed');
      });
    });

    return { jobId: job.id };
  }

  private async runPipeline(jobId: string, documentId: string, companyId: string): Promise<void> {
    await prisma.travelDocument.update({
      where: { id: documentId },
      data: { status: 'PROCESSING', errorMessage: null },
    });
    await prisma.travelImportJob.update({
      where: { id: jobId },
      data: { status: 'RUNNING', startedAt: new Date(), currentStep: 'extract', progress: 5 },
    });

    try {
      let simExtractProgress = 5;
      const extractTick = setInterval(() => {
        simExtractProgress = Math.min(simExtractProgress + 1, 22);
        void prisma.travelImportJob
          .update({
            where: { id: jobId },
            data: { progress: simExtractProgress, currentStep: 'extract' },
          })
          .catch(() => undefined);
      }, 850);

      let extract: Awaited<ReturnType<PdfExtractionService['extractTextFromDocument']>>;
      try {
        extract = await pdfExtraction.extractTextFromDocument(documentId, companyId);
      } finally {
        clearInterval(extractTick);
      }

      const extractedPath = path.join(process.cwd(), extract.extractedTextPath);
      const raw = await readFile(extractedPath, 'utf-8');
      const data = JSON.parse(raw) as ExtractedFile;
      if (!data.pages?.length) {
        throw new Error('Extracción sin páginas de texto');
      }
      await prisma.travelImportJob.update({
        where: { id: jobId },
        data: { progress: 24, currentStep: 'segment' },
      });

      await prisma.travelTrip.deleteMany({
        where: { documentId, companyId, status: { in: ['PENDING_REVIEW', 'DRAFT'] } },
      });

      const segs = segmentation.segmentFromPages(data.pages).filter((s) => s.kind === 'trip');
      const total = Math.max(1, segs.length);
      await prisma.travelImportJob.update({
        where: { id: jobId },
        data: { progress: 25, currentStep: `trips:${total}` },
      });

      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i]!;
        const { base, end } = tripSegmentProgressRange(i, total);
        const span = Math.max(1, end - base);
        await prisma.travelImportJob.update({
          where: { id: jobId },
          data: { progress: base, currentStep: `prep:${i + 1}/${total}` },
        });
        try {
          const cleaned = deepCleanTouristicText(seg.rawTextForAI);
          const segmentValidation = validateTripSegment(seg.title, cleaned);
          if (!segmentValidation.ok) {
            logger.info(
              {
                title: seg.title,
                pageStart: seg.pageStart,
                pageEnd: seg.pageEnd,
                reasons: segmentValidation.reasons,
                score: segmentValidation.score,
              },
              'import: segmento descartado por validador (no ficha sólida)',
            );
            continue;
          }
          const blocks = segmentTouristicDocument(cleaned);
          const structured = extractStructuredTripCatalog(blocks, seg.title, cleaned);
          const det = deterministic.extractFromBlock(cleaned, seg.title);
          await prisma.travelImportJob.update({
            where: { id: jobId },
            data: {
              progress: base + Math.max(1, Math.floor(span * 0.36)),
              currentStep: `ai:${i + 1}/${total}`,
            },
          });
          const { data: ai, usedModel } = await aiExtraction.extractFromBlock({
            titleHint: seg.title,
            pageStart: seg.pageStart,
            pageEnd: seg.pageEnd,
            text: cleaned,
          });
          await prisma.travelImportJob.update({
            where: { id: jobId },
            data: {
              progress: base + Math.max(1, Math.floor(span * 0.7)),
              currentStep: `persist:${i + 1}/${total}`,
            },
          });
          const merged = mergeDeterministicWithAi(det, ai, seg.title);
          const withStructured = mergeStructuredIntoTripExtract(structured, merged);
          if (config.TRAVEL_HOTEL_PIPELINE_LOG) {
            logger.info(
              {
                segmentTitle: seg.title,
                pageStart: seg.pageStart,
                pageEnd: seg.pageEnd,
                hotelsCount: withStructured.hotels.length,
                structuredHotels: structured.hotels.length,
                mergedHotelsBeforeStruct: merged.hotels.length,
              },
              'travel:merge estructurado+IA (hoteles finales en withStructured)',
            );
          }
          const deduped = normalizer.dedupeDestinations(withStructured.destinations);
          const cleanedItinerary = validateItineraryDays(withStructured.itineraryDays, withStructured.title ?? seg.title);
          const aiNorm = normalizer.normalizeTripStrings({
            ...withStructured,
            itineraryDays: cleanedItinerary,
            destinations: deduped,
          });
          const confidence = Math.max(
            structured.confidenceScore,
            usedModel && (aiNorm.confidence ?? 0) > 0.2
              ? (aiNorm.confidence as number)
              : usedModel
                ? 0.45
                : 0.25,
          );
          const structuredHotelWhitelistNormKeys = new Set<string>();
          for (const sh of structured.hotels) {
            const hn = sh.hotelName?.trim();
            if (hn) {
              structuredHotelWhitelistNormKeys.add(normKey(normalizeHotelName(hn)));
            }
          }
          const trip = await this.persistTrip(companyId, documentId, {
            sourcePageStart: seg.pageStart,
            sourcePageEnd: seg.pageEnd,
            rawText: cleaned,
            data: { ...aiNorm, confidence: aiNorm.confidence ?? confidence },
            confidence,
            structuredHotelWhitelistNormKeys,
          });
          logger.info({ tripId: trip.id, documentId, title: seg.title }, 'viaje importado (pending_review)');
        } catch (e) {
          logger.error(
            { err: e, documentId, segment: seg.title, pageStart: seg.pageStart, pageEnd: seg.pageEnd },
            'import: fallo en segmento (resto de viajes continúa)',
          );
        }
        await prisma.travelImportJob.update({
          where: { id: jobId },
          data: { progress: end, currentStep: `save:${i + 1}/${total}` },
        });
      }

      await prisma.travelDocument.update({
        where: { id: documentId },
        data: { status: 'PROCESSED' },
      });
      await prisma.travelImportJob.update({
        where: { id: jobId },
        data: { status: 'SUCCESS', progress: 100, currentStep: 'done', finishedAt: new Date() },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.travelDocument.update({
        where: { id: documentId },
        data: { status: 'FAILED', errorMessage: msg },
      });
      await prisma.travelImportJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', errorMessage: msg, finishedAt: new Date(), currentStep: 'error' },
      });
    }
  }

  /** Expuesto para viajes creados manualmente (documentId nulo) o tests. */
  async persistTrip(
    companyId: string,
    documentId: string | null,
    input: {
      sourcePageStart: number;
      sourcePageEnd: number;
      rawText: string;
      data: TripAiExtract & { confidence?: number | null };
      confidence: number;
      /** Hoteles ya validados en capa tabla/títulos del mismo segmento (normKey). */
      structuredHotelWhitelistNormKeys?: Set<string>;
    },
  ) {
    const { data } = input;
    const { kept: hotelRows, dropped: droppedHotels } = filterHotelsForPersistence(data.hotels, {
      visualWhitelistNormKeys: input.structuredHotelWhitelistNormKeys,
    });
    if ((config.NODE_ENV === 'development' || config.TRAVEL_HOTEL_PIPELINE_LOG) && droppedHotels.length > 0) {
      logger.info(
        { nDropped: droppedHotels.length, sample: droppedHotels.slice(0, 16) },
        'travel:persist — hoteles descartados (validador final)',
      );
    }
    const persistConfidence =
      hotelRows.length === 0
        ? Math.min(input.confidence, 0.36)
        : data.hotels.length > 0 && hotelRows.length < data.hotels.length
          ? Math.min(input.confidence, 0.48)
          : input.confidence;
    const price = normalizer.buildPrice(data);
    return prisma.$transaction(async (tx) => {
      const trip = await tx.travelTrip.create({
        data: {
          companyId,
          documentId,
          title: data.title.slice(0, 500),
          provider: normalizer.normalizeText(data.provider),
          season: normalizer.normalizeText(data.season),
          mainDestination: normalizer.normalizeText(data.mainDestination),
          description: normalizer.normalizeText(data.description),
          durationDays: data.durationDays ?? null,
          durationNights: data.durationNights ?? null,
          indicativePrice: price,
          currency: data.currency,
          status: 'PENDING_REVIEW',
          confidenceScore: persistConfidence,
          sourcePageStart: input.sourcePageStart,
          sourcePageEnd: input.sourcePageEnd,
          rawExtractedText: cleanRepeatedCatalogHeaders(input.rawText).slice(0, 1_000_000),
        },
      });

      let dOrder = 0;
      for (const d of data.destinations) {
        const nkey = normalizer.normalizeNameKey(d.name);
        const kind = d.type as DestinationKind;
        const dest = await tx.destination.upsert({
          where: {
            companyId_normalizedName_type: {
              companyId,
              normalizedName: nkey,
              type: kind,
            },
          },
          create: {
            companyId,
            name: d.name,
            type: kind,
            normalizedName: nkey,
          },
          update: { name: d.name },
        });
        await tx.travelTripDestination.create({
          data: { tripId: trip.id, destinationId: dest.id, orderIndex: dOrder++ },
        });
      }

      for (const it of data.itineraryDays) {
        await tx.tripItineraryDay.create({
          data: {
            tripId: trip.id,
            dayNumber: it.dayNumber,
            title: normalizer.normalizeText(it.title),
            description: normalizer.normalizeText(it.description),
            meals: normalizer.normalizeText(it.meals),
            accommodation: normalizer.normalizeText(it.accommodation),
            orderIndex: it.order ?? 0,
          },
        });
      }

      for (const s of data.services) {
        await tx.tripCatalogService.create({
          data: {
            tripId: trip.id,
            type: s.type as TripServiceKind,
            text: s.text,
            orderIndex: s.order ?? 0,
          },
        });
      }

      for (const dep of data.departures) {
        await tx.tripDeparture.create({
          data: {
            tripId: trip.id,
            departureText: dep.departureText,
            startDate: parseSqlDate(dep.startDate),
            endDate: parseSqlDate(dep.endDate),
            weekdays: dep.weekdays ? dep.weekdays.slice(0, 100) : null,
            orderIndex: dep.order ?? 0,
          },
        });
      }

      let hIndex = 0;
      for (const h of hotelRows) {
        await tx.tripHotel.create({
          data: {
            tripId: trip.id,
            category: h.category ? h.category.slice(0, 50) : null,
            city: h.city ? h.city.slice(0, 150) : null,
            hotelName: h.hotelName ? h.hotelName.slice(0, 255) : null,
            orderIndex: hIndex++,
          },
        });
      }

      for (const hi of data.highlights) {
        await tx.tripHighlight.create({
          data: { tripId: trip.id, text: hi.text, orderIndex: hi.order ?? 0 },
        });
      }

      for (const o of data.observations) {
        await tx.tripObservation.create({
          data: { tripId: trip.id, text: o.text, orderIndex: o.order ?? 0 },
        });
      }

      return trip;
    });
  }
}

function parseSqlDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Rango de % del job (25–95) asignado al viaje `i` de `total` (0-based). */
function tripSegmentProgressRange(i: number, total: number): { base: number; end: number } {
  const t = Math.max(1, total);
  const base = 25 + Math.floor((70 * i) / t);
  const end = 25 + Math.floor((70 * (i + 1)) / t);
  return { base, end: Math.max(base + 1, end) };
}

function validateTripSegment(title: string, text: string): { ok: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  const t = title.replace(/\s+/g, ' ').trim();
  const signals = countTripSignals(text);
  let titleScore = 0;
  if (t.length >= 4 && t.length <= 90 && !isBlockedFirstLineOrTitle(t) && !/\b(PASEAR|CONOCER|DESCUBRIR|EMBARQUE|VISITAR|DISFRUTAR|VUELO|TRASLADO)\b/i.test(t)) {
    titleScore = 0.34;
    reasons.push('title-ok');
  } else {
    reasons.push('title-weak');
  }
  const structureScore = Math.min(
    0.46,
    (signals.flags.includes('duration') ? 0.14 : 0) +
      (signals.flags.includes('servicios') ? 0.1 : 0) +
      (signals.flags.includes('salidas') ? 0.1 : 0) +
      (signals.flags.includes('precio') ? 0.06 : 0) +
      (signals.flags.includes('a_tener') ? 0.06 : 0),
  );
  const itineraryScore = signals.flags.includes('itinerary') ? 0.2 : 0;
  const score = Math.max(0, Math.min(1, titleScore + structureScore + itineraryScore));
  if (structureScore < 0.2) reasons.push('structure-weak');
  if (!signals.flags.includes('itinerary')) reasons.push('no-itinerary');
  return { ok: score >= 0.7, score, reasons };
}

function validateItineraryDays(
  days: TripAiExtract['itineraryDays'],
  tripTitle: string | null | undefined,
): TripAiExtract['itineraryDays'] {
  const t = (tripTitle ?? '').replace(/\s+/g, ' ').trim();
  const out: TripAiExtract['itineraryDays'] = [];
  for (const d of days) {
    const src = (d.description ?? '').replace(/\s+/g, ' ').trim();
    if (!src) {
      out.push(d);
      continue;
    }
    let cut = src;
    const blockers = [
      /\bSERVICIOS\s+INCLUIDOS\b/i,
      /\bHOTELES(?:\s*\(|\s+EN)?\b/i,
      /\bPRECIO\s+ORIENTATIVO\b/i,
      /\bSALIDAS\b/i,
      /\bEXPERIENCIAS\s+(?:DESTACADAS|OPCIONALES)\b/i,
    ];
    for (const re of blockers) {
      const i = cut.search(re);
      if (i >= 0) cut = cut.slice(0, i).trim();
    }
    if (t) {
      const i = cut.toUpperCase().indexOf(t.toUpperCase());
      if (i >= 0) {
        cut = cut.slice(0, i).trim();
      }
    }
    out.push({ ...d, description: cut || null });
  }
  return out;
}
