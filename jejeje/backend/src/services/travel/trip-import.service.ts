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
import { NotFoundError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';

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
      const extract = await pdfExtraction.extractTextFromDocument(documentId, companyId);
      const extractedPath = path.join(process.cwd(), extract.extractedTextPath);
      const raw = await readFile(extractedPath, 'utf-8');
      const data = JSON.parse(raw) as ExtractedFile;
      if (!data.pages?.length) {
        throw new Error('Extracción sin páginas de texto');
      }
      await prisma.travelImportJob.update({
        where: { id: jobId },
        data: { progress: 25, currentStep: 'segment' },
      });

      await prisma.travelTrip.deleteMany({
        where: { documentId, companyId, status: { in: ['PENDING_REVIEW', 'DRAFT'] } },
      });

      const segs = segmentation.segmentFromPages(data.pages).filter((s) => s.kind === 'trip');
      const total = Math.max(1, segs.length);
      let done = 0;
      for (const seg of segs) {
        try {
          const det = deterministic.extractFromBlock(seg.rawTextForAI, seg.title);
          const { data: ai, usedModel } = await aiExtraction.extractFromBlock({
            titleHint: seg.title,
            pageStart: seg.pageStart,
            pageEnd: seg.pageEnd,
            text: seg.rawTextForAI,
          });
          const merged = mergeDeterministicWithAi(det, ai, seg.title);
          const deduped = normalizer.dedupeDestinations(merged.destinations);
          const aiNorm = normalizer.normalizeTripStrings({ ...merged, destinations: deduped });
          const confidence =
            usedModel && aiNorm.confidence != null ? aiNorm.confidence : usedModel ? 0.5 : 0.25;
          const trip = await this.persistTrip(companyId, documentId, {
            sourcePageStart: seg.pageStart,
            sourcePageEnd: seg.pageEnd,
            rawText: seg.rawTextForAI,
            data: { ...aiNorm, confidence: aiNorm.confidence ?? confidence },
            confidence,
          });
          logger.info({ tripId: trip.id, documentId, title: seg.title }, 'viaje importado (pending_review)');
          done += 1;
        } catch (e) {
          logger.error(
            { err: e, documentId, segment: seg.title, pageStart: seg.pageStart, pageEnd: seg.pageEnd },
            'import: fallo en segmento (resto de viajes continúa)',
          );
        }
        const progress = 25 + Math.floor((70 * done) / total);
        await prisma.travelImportJob.update({
          where: { id: jobId },
          data: { progress, currentStep: `save:${done}/${total}` },
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
    },
  ) {
    const { data } = input;
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
          confidenceScore: input.confidence,
          sourcePageStart: input.sourcePageStart,
          sourcePageEnd: input.sourcePageEnd,
          rawExtractedText: input.rawText.slice(0, 1_000_000),
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

      for (const h of data.hotels) {
        await tx.tripHotel.create({
          data: {
            tripId: trip.id,
            category: h.category ? h.category.slice(0, 50) : null,
            city: h.city ? h.city.slice(0, 150) : null,
            hotelName: h.hotelName ? h.hotelName.slice(0, 255) : null,
            orderIndex: h.order ?? 0,
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
