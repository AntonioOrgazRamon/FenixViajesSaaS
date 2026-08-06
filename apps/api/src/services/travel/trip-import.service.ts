import { readFile } from 'fs/promises';
import path from 'path';
import type { Prisma, TripPace, TravelStyleAxis, TripServiceKind, DestinationKind } from '@prisma/client';
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
import { cleanRepeatedCatalogHeaders, buildRawTextForAI } from './trip-text-cleaning.service';
import { deepCleanTouristicText } from './trip-touristic-deep-clean.service';
import { segmentTouristicDocument } from './trip-document-blocks.service';
import { extractStructuredTripCatalog, mergeStructuredIntoTripExtract } from './trip-structured-catalog-extract.service';
import { filterHotelsForPersistence, normKey, normalizeHotelName } from './trip-hotels-extract.service';
import { calculateTripQualityScore, validateTravelSegment, looksNarrativeOrBrokenTitle } from './travel-segment-validator.service';
import { buildIndexCoverageSegments } from './travel-index-coverage.service';
import { extractTripTitle } from './trip-segmentation-icarion';
import { analyzeMixedSegment, splitSegmentByTripBoundaries } from './travel-mixed-segment.service';
import { validateFinalTripTitle } from './catalog-trip-title.service';
import { validateAndRepairTripTitle } from './trip-title-repair.service';
import {
  CANDIDATE_SCORE_REVIEW_MIN,
  dedupeAndMergeCandidates,
  evaluateTripCandidate,
  formatCandidateRejectReason,
  inferCommercialTitleNearStructure,
  isGarbageFragmentTitle,
  logCandidateQuality,
  logRejectedCandidate,
  type PersistReadyCandidate,
} from './trip-candidate-quality.service';

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

      const docRow = await prisma.travelDocument.findFirst({
        where: { id: documentId, companyId },
        select: { filename: true, originalName: true, totalPages: true },
      });
      const totalPages = data.totalPages ?? data.pages.length;
      logger.info(
        {
          event: 'travel:import-job-start',
          documentId,
          filename: docRow?.originalName ?? docRow?.filename,
          totalPages,
        },
        'travel: import job — extracción lista',
      );

      await prisma.travelTrip.deleteMany({
        where: { documentId, companyId, status: { in: ['PENDING_REVIEW', 'DRAFT'] } },
      });

      const heuristicSegs = segmentation
        .segmentFromPages(data.pages)
        .filter((s): s is ImportPipelineSegment => s.kind === 'trip');
      const idxCoverage = buildIndexCoverageSegments(data.pages);
      const mergedSegs = mergeCoverageSegments(heuristicSegs, idxCoverage.segments);
      const segs = expandSegmentsMixed(mergedSegs);
      let suspiciousSegments = 0;
      for (const s of segs) {
        const mx = analyzeMixedSegment(s.rawTextForAI);
        if (mx.likelyMixed && mx.reasons.length) suspiciousSegments++;
      }

      logger.info(
        {
          event: 'travel:segmentation-summary',
          documentId,
          expectedTripsFromIndex: idxCoverage.expected.length,
          indexSampleTitles: idxCoverage.expected.slice(0, 10).map((e) => ({
            title: e.expectedTitle,
            page: e.pageNumber,
          })),
          segmentsCreated: segs.length,
          segmentsAfterCoverageMerge: mergedSegs.length,
          suspiciousSegments,
        },
        'travel: índice + segmentos',
      );
      const total = Math.max(1, segs.length);
      const pendingCandidates: PersistReadyCandidate[] = [];
      const importedTitles = new Set<string>();
      let rejectedSegments = 0;
      let falseTitleCandidates = 0;
      await prisma.travelImportJob.update({
        where: { id: jobId },
        data: { progress: 25, currentStep: `trips:${total}|idx:${idxCoverage.expected.length}` },
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
          const segmentValidation = validateTravelSegment({ titleHint: seg.title, segmentText: cleaned });
          if (!segmentValidation.isValidTravel) {
            rejectedSegments++;
            if (segmentValidation.detectedType === 'NARRATIVE_FRAGMENT') {
              falseTitleCandidates++;
            }
            logger.info(
              {
                title: seg.title,
                pageStart: seg.pageStart,
                pageEnd: seg.pageEnd,
                reasons: segmentValidation.reasons,
                score: segmentValidation.confidence,
                detectedType: segmentValidation.detectedType,
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
            companyId,
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
          let aiNorm = normalizer.normalizeTripStrings({
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
          const mixInfo = analyzeMixedSegment(cleaned);
          const inferredEarly = inferCommercialTitleNearStructure(cleaned, aiNorm.title);
          const titleForGate =
            inferredEarly && (isGarbageFragmentTitle(aiNorm.title) || looksNarrativeOrBrokenTitle(aiNorm.title))
              ? inferredEarly
              : (aiNorm.title ?? seg.title);
          const titleGate = validateFinalTripTitle(titleForGate, cleaned, {
            indexEntries: idxCoverage.expected,
            pageStart: seg.pageStart,
            pageEnd: seg.pageEnd,
          });
          if (!titleGate.ok) {
            rejectedSegments++;
            logger.info(
              {
                event: 'travel:segment-rejected',
                reason: titleGate.reason,
                candidateTitle: aiNorm.title ?? seg.title,
                pageStart: seg.pageStart,
                pageEnd: seg.pageEnd,
                mixedSegmentDetected: mixInfo.likelyMixed,
                mixReasons: mixInfo.reasons,
                rejectedTitleCandidates: titleGate.rejectedCandidates,
              },
              'import: segmento rechazado (INVALID_TITLE)',
            );
            continue;
          }
          aiNorm = { ...aiNorm, title: titleGate.title! };
          const qualityEval = evaluateTripCandidate({
            segmentText: cleaned,
            trip: aiNorm,
            pageStart: seg.pageStart,
            pageEnd: seg.pageEnd,
            indexEntries: idxCoverage.expected,
            originalSegmentTitle: seg.title,
          });
          logCandidateQuality(documentId, {
            originalTitle: seg.title,
            finalTitle: aiNorm.title,
            pageStart: seg.pageStart,
            pageEnd: seg.pageEnd,
            q: qualityEval,
            phase: 'prePersist',
          });
          if (qualityEval.decision === 'REJECT' || qualityEval.score < CANDIDATE_SCORE_REVIEW_MIN) {
            rejectedSegments++;
            logRejectedCandidate(documentId, {
              title: aiNorm.title ?? seg.title,
              score: qualityEval.score,
              missingStrongSignals: qualityEval.missingStrongSignals,
              reason: formatCandidateRejectReason(qualityEval),
              rejectCode: qualityEval.rejectCode,
              pageStart: seg.pageStart,
              pageEnd: seg.pageEnd,
            });
            logger.info(
              {
                event: 'travel:candidate-rejected',
                documentId,
                rejectCode: qualityEval.rejectCode,
                score: qualityEval.score,
                title: aiNorm.title,
                pageStart: seg.pageStart,
                pageEnd: seg.pageEnd,
                negativeSignals: qualityEval.negativeSignals,
              },
              `import: candidato rechazado ${qualityEval.rejectCode ?? 'REJECT'}`,
            );
            continue;
          }
          const quality = calculateTripQualityScore(aiNorm, segmentValidation);
          const completenessGaps = assessCompletenessGaps(aiNorm);
          if (completenessGaps.length > 0) {
            const obs = [...(aiNorm.observations ?? [])];
            obs.push({
              text: `[QUALITY_GATE] Faltan señales: ${completenessGaps.join(', ')}`,
              order: obs.length,
            });
            aiNorm = { ...aiNorm, observations: obs };
          }
          if (qualityEval.decision === 'REVIEW' || qualityEval.score < 70) {
            const obs = [...(aiNorm.observations ?? [])];
            obs.push({
              text: `[CANDIDATE_QUALITY] score=${qualityEval.score} decision=${qualityEval.decision} — revisar antes de publicar`,
              order: obs.length,
            });
            aiNorm = { ...aiNorm, observations: obs };
          }
          logger.info(
            {
              event: 'travel:segment-accepted',
              documentId,
              candidateTitle: seg.title,
              selectedTitle: aiNorm.title,
              indexSupportScore: titleGate.indexSupportScore,
              candidateQualityScore: qualityEval.score,
              candidateQualityDecision: qualityEval.decision,
              hasDuration: aiNorm.durationDays != null && aiNorm.durationNights != null,
              hasServices: aiNorm.services.length > 0,
              hasHotelsSection: /HOTELES\s*\(/i.test(cleaned),
              hasPrice: aiNorm.indicativePrice != null || /PRECIO\s+ORIENTATIVO/i.test(cleaned),
              mixedSegmentDetected: mixInfo.likelyMixed,
              splitApplied: (seg as { splitFromMixed?: boolean }).splitFromMixed === true,
              qualityScore: quality.qualityScore,
            },
            'import: candidato aceptado para cola de deduplicación',
          );
          const structuredHotelWhitelistNormKeys = new Set<string>();
          for (const sh of structured.hotels) {
            const hn = sh.hotelName?.trim();
            if (hn) {
              structuredHotelWhitelistNormKeys.add(normKey(normalizeHotelName(hn)));
            }
          }
          pendingCandidates.push({
            seg,
            cleaned,
            aiNorm,
            confidence,
            structuredHotelWhitelistNormKeys,
            quality: qualityEval,
            segmentValidation,
          });
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

      const mergedCandidates = dedupeAndMergeCandidates(pendingCandidates, (dropped, kept) => {
        rejectedSegments++;
        logger.info(
          {
            event: 'travel:candidate-dedupe',
            documentId,
            rejectCode: 'REJECTED_DUPLICATE',
            droppedTitle: dropped.aiNorm.title,
            droppedScore: dropped.quality.score,
            keptTitle: kept.aiNorm.title,
            keptScore: kept.quality.score,
            droppedPages: [dropped.seg.pageStart, dropped.seg.pageEnd],
          },
          'import: duplicado descartado (fusionado con mejor candidato)',
        );
      });

      for (const pack of mergedCandidates) {
        if (pack.quality.decision === 'REJECT' || pack.quality.score < CANDIDATE_SCORE_REVIEW_MIN) {
          continue;
        }
        logCandidateQuality(documentId, {
          originalTitle: pack.seg.title,
          finalTitle: pack.aiNorm.title,
          pageStart: pack.seg.pageStart,
          pageEnd: pack.seg.pageEnd,
          q: pack.quality,
          phase: 'postDedupe',
        });
        const tripQuality = calculateTripQualityScore(pack.aiNorm, pack.segmentValidation);
        let conf = Math.max(
          0,
          Math.min(0.99, pack.confidence * (0.65 + tripQuality.qualityScore * 0.35)),
        );
        if (pack.quality.decision === 'REVIEW' || pack.quality.score < 70) {
          conf = Math.min(conf, 0.72);
        }
        const titleRepair = validateAndRepairTripTitle(pack.aiNorm.title, pack.cleaned, {
          indexEntries: idxCoverage.expected,
          pageStart: pack.seg.pageStart,
          pageEnd: pack.seg.pageEnd,
        });
        logger.info(
          {
            event: 'travel:title-repair',
            documentId,
            titleBefore: titleRepair.titleBefore.slice(0, 200),
            titleAfter: titleRepair.titleAfter?.slice(0, 200) ?? null,
            titleConfidence: titleRepair.titleConfidence,
            titleRepairReason: titleRepair.titleRepairReason,
            skipPersist: titleRepair.skipPersist,
            needsReviewTitle: titleRepair.needsReviewTitle,
            pageStart: pack.seg.pageStart,
            pageEnd: pack.seg.pageEnd,
          },
          `import: validateAndRepairTripTitle ${titleRepair.ok ? 'ok' : 'fail'} — ${titleRepair.titleRepairReason}`,
        );
        if (!titleRepair.ok || !titleRepair.title) {
          rejectedSegments++;
          logger.info(
            {
              event: 'travel:title-repair-rejected',
              documentId,
              titleBefore: titleRepair.titleBefore,
              titleRepairReason: titleRepair.titleRepairReason,
              pageStart: pack.seg.pageStart,
              pageEnd: pack.seg.pageEnd,
            },
            'import: no persistir — título no reparable (capa final)',
          );
          continue;
        }
        let persistAiNorm = { ...pack.aiNorm, title: titleRepair.title };
        if (titleRepair.needsReviewTitle) {
          const obs = [...(persistAiNorm.observations ?? [])];
          obs.push({
            text: `[NEEDS_REVIEW_TITLE] ${titleRepair.titleRepairReason} conf=${titleRepair.titleConfidence.toFixed(2)}`,
            order: obs.length,
          });
          persistAiNorm = { ...persistAiNorm, observations: obs };
          conf = Math.min(conf, 0.62);
        }
        try {
          const trip = await this.persistTrip(companyId, documentId, {
            sourcePageStart: pack.seg.pageStart,
            sourcePageEnd: pack.seg.pageEnd,
            rawText: pack.cleaned,
            data: { ...persistAiNorm, confidence: persistAiNorm.confidence ?? pack.confidence },
            confidence: conf,
            structuredHotelWhitelistNormKeys: pack.structuredHotelWhitelistNormKeys,
          });
          importedTitles.add(normTitleKey(persistAiNorm.title));
          logger.info(
            {
              event: 'travel: trip-persisted',
              tripId: trip.id,
              documentId,
              title: persistAiNorm.title,
              titleRepairReason: titleRepair.titleRepairReason,
              titleConfidence: titleRepair.titleConfidence,
              candidateQualityScore: pack.quality.score,
              hotelsCount: persistAiNorm.hotels.length,
              itineraryDaysCount: persistAiNorm.itineraryDays.length,
              warnings: tripQuality.warnings,
            },
            'viaje importado (pending_review)',
          );
        } catch (e) {
          logger.error(
            {
              err: e,
              documentId,
              segment: pack.seg.title,
              pageStart: pack.seg.pageStart,
              pageEnd: pack.seg.pageEnd,
            },
            'import: fallo al persistir candidato deduplicado',
          );
        }
      }

      const missingExpected = idxCoverage.expected.filter((e) => !importedTitles.has(normTitleKey(e.expectedTitle)));
      for (const miss of missingExpected) {
        const nearPage = data.pages.find((p) => p.page === miss.pageNumber);
        const reviewText = nearPage?.text ?? '';
        await this.persistTrip(companyId, documentId, {
          sourcePageStart: miss.pageNumber,
          sourcePageEnd: miss.pageNumber,
          rawText: reviewText,
          data: {
            title: miss.expectedTitle,
            provider: null,
            season: null,
            mainDestination: miss.section,
            description: `[REVIEW_TRIP] Segmentación no encontrada para título de índice: ${miss.expectedTitle}`,
            durationDays: null,
            durationNights: null,
            indicativePrice: null,
            currency: null,
            confidence: 0.24,
            destinations: [],
            itineraryDays: [],
            services: [],
            departures: [],
            hotels: [],
            highlights: [],
            observations: [{ text: 'Pendiente revisión técnica por cobertura de índice', order: 0 }],
          },
          confidence: 0.24,
          structuredHotelWhitelistNormKeys: new Set<string>(),
        });
      }
      logger.info(
        {
          totalExpectedFromIndex: idxCoverage.expected.length,
          importedTrips: importedTitles.size,
          missingTrips: missingExpected.length,
          rejectedSegments,
          falseTitleCandidates,
          suspiciousSegments,
        },
        'travel:index-coverage-report',
      );

      const expectedTripsFromIndex = idxCoverage.expected.length;
      const persistedTrips = importedTitles.size;
      const coverageRatio = expectedTripsFromIndex > 0 ? persistedTrips / expectedTripsFromIndex : 1;
      const lowCoverageWarning = expectedTripsFromIndex > 50 && coverageRatio < 0.7;
      if (lowCoverageWarning) {
        logger.warn(
          {
            expectedTripsFromIndex,
            persistedTrips,
            coverageRatio: Number(coverageRatio.toFixed(3)),
          },
          'travel:import WARNING — cobertura muy baja vs índice',
        );
      }

      await prisma.travelDocument.update({
        where: { id: documentId },
        data: { status: 'PROCESSED' },
      });
      await prisma.travelImportJob.update({
        where: { id: jobId },
        data: {
          status: 'SUCCESS',
          progress: 100,
          currentStep: lowCoverageWarning
            ? `done|[WARNING] ${persistedTrips}/${expectedTripsFromIndex} vs índice`
            : 'done',
          errorMessage: lowCoverageWarning
            ? `[WARNING] Cobertura baja: ${persistedTrips} viajes persistidos vs ${expectedTripsFromIndex} entradas de índice. Revisar logs travel:segmentation-summary y travel:index-coverage-report.`
            : null,
          finishedAt: new Date(),
        },
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
      /** Ritmo del viaje (JSON import u otros flujos que ya traen enum). */
      pace?: TripPace | null;
      /** Ejes de estilo ya resueltos (p. ej. import JSON enriquecido). */
      styleAxes?: TravelStyleAxis[] | null;
      /** Hoteles ya validados en capa tabla/títulos del mismo segmento (normKey). */
      structuredHotelWhitelistNormKeys?: Set<string>;
      /** Dedupe por tenant en importaciones JSON revisadas (no usa PDF). */
      importSlug?: string | null;
    },
    externalTx?: Prisma.TransactionClient,
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
    const quality = assessTripQuality({
      title: data.title,
      mainDestination: data.mainDestination,
      description: data.description,
      itineraryDays: data.itineraryDays,
      hotelsCandidateCount: data.hotels.length,
      hotelsKeptCount: hotelRows.length,
    });
    const finalConfidence = Math.max(0, Math.min(0.99, persistConfidence - quality.penalty));
    if (quality.warnings.length > 0 && (config.NODE_ENV === 'development' || config.TRAVEL_HOTEL_PIPELINE_LOG)) {
      logger.info({ warnings: quality.warnings, penalty: quality.penalty }, 'travel:quality validators');
    }
    const price = normalizer.buildPrice(data);
    const runner = async (tx: Prisma.TransactionClient) => {
      const paceValue: TripPace = input.pace ?? 'UNKNOWN';

      const trip = await tx.travelTrip.create({
        data: {
          companyId,
          documentId,
          importSlug:
            input.importSlug != null && String(input.importSlug).trim().length > 0
              ? String(input.importSlug).trim().slice(0, 200)
              : null,
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
          confidenceScore: finalConfidence,
          sourcePageStart: input.sourcePageStart,
          sourcePageEnd: input.sourcePageEnd,
          rawExtractedText: cleanRepeatedCatalogHeaders(input.rawText).slice(0, 1_000_000),
          pace: paceValue,
        },
      });

      const axes = [...new Set(input.styleAxes ?? [])];
      if (axes.length > 0) {
        await tx.travelTripStyleTag.createMany({
          data: axes.map((style) => ({ tripId: trip.id, style })),
          skipDuplicates: true,
        });
      }

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
    };

    if (externalTx) {
      return runner(externalTx);
    }
    return prisma.$transaction(runner);
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

function assessTripQuality(input: {
  title: string | null | undefined;
  mainDestination: string | null | undefined;
  description: string | null | undefined;
  itineraryDays: TripAiExtract['itineraryDays'];
  hotelsCandidateCount: number;
  hotelsKeptCount?: number;
  structuredHotelCount?: number;
}): { warnings: string[]; penalty: number } {
  const warnings: string[] = [];
  let penalty = 0;
  const t = (input.title ?? '').trim();
  const d = (input.mainDestination ?? '').trim();
  const desc = (input.description ?? '').replace(/\s+/g, ' ').trim();
  const blockLike = /SERVICIOS INCLUIDOS|HOTELES\s*\(|PRECIO ORIENTATIVO|SALIDAS/i;

  if (!t || /\b(PASEAR|EMBARQUE|DESCUBRIR|CONOCER)\b/i.test(t) || /^(CON|EN|DEL|DE LA|DE LOS|AL|A LA)\b/i.test(t)) {
    warnings.push('title_weak');
    penalty += 0.1;
  }
  if (!d || /EXTENSIONES A PLAYAS|SERVICIOS INCLUIDOS|PRECIO ORIENTATIVO|SALIDAS/i.test(d)) {
    warnings.push('destination_invalid');
    penalty += 0.12;
  }
  if (!desc || desc.length < 24 || /^([A-ZÁÉÍÓÚÑ]+\s+20\d{2}\s*\/\s*20?\d{2,4})+$/i.test(desc) || blockLike.test(desc.slice(0, 220))) {
    warnings.push('description_low_signal');
    penalty += 0.1;
  }
  if (!input.itineraryDays.some((x) => x.dayNumber === 1)) {
    warnings.push('itinerary_missing_day1');
    penalty += 0.1;
  }
  const pollutedDay = input.itineraryDays.some((x) => {
    const s = (x.description ?? '').replace(/\s+/g, ' ').trim();
    return blockLike.test(s) || (!!t && s.toUpperCase().includes(t.toUpperCase()));
  });
  if (pollutedDay) {
    warnings.push('itinerary_polluted_tail');
    penalty += 0.1;
  }
  if (input.hotelsCandidateCount > 0 && (input.hotelsKeptCount ?? input.hotelsCandidateCount) === 0) {
    warnings.push('hotels_all_dropped');
    penalty += 0.18;
  }
  if (input.structuredHotelCount != null && input.structuredHotelCount > 0 && (input.hotelsKeptCount ?? 0) > 0) {
    const ratio = (input.hotelsKeptCount ?? 0) / input.structuredHotelCount;
    if (ratio < 0.6) {
      warnings.push('hotels_low_coverage_vs_block');
      penalty += 0.1;
    }
  }
  return { warnings, penalty: Math.min(0.45, penalty) };
}

function normTitleKey(s: string): string {
  return s
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function assessCompletenessGaps(trip: TripAiExtract): string[] {
  const g: string[] = [];
  if (trip.durationDays == null || trip.durationNights == null) g.push('duration');
  if (!trip.itineraryDays?.length) g.push('itinerary');
  if (!trip.services?.length && trip.indicativePrice == null && !trip.departures?.length) {
    g.push('services_price_or_salidas');
  }
  if (!trip.title?.trim()) g.push('title');
  return g;
}

type ImportPipelineSegment = {
  pageStart: number;
  pageEnd: number;
  title: string;
  text: string;
  rawTextForAI: string;
  kind: 'trip';
  splitFromMixed?: boolean;
};

function expandSegmentsMixed(segs: ImportPipelineSegment[]): ImportPipelineSegment[] {
  const out: ImportPipelineSegment[] = [];
  for (const s of segs) {
    const mix = analyzeMixedSegment(s.rawTextForAI);
    if (!mix.likelyMixed) {
      out.push({ ...s, splitFromMixed: false });
      continue;
    }
    const parts = splitSegmentByTripBoundaries(s.rawTextForAI);
    if (parts.length <= 1) {
      out.push({ ...s, splitFromMixed: false });
      continue;
    }
    for (const p of parts) {
      const nt = extractTripTitle(p) ?? s.title;
      out.push({
        ...s,
        title: nt,
        text: p,
        rawTextForAI: buildRawTextForAI(p),
        splitFromMixed: true,
      });
    }
  }
  return out;
}

function mergeCoverageSegments(
  heuristicSegs: Array<{
    pageStart: number;
    pageEnd: number;
    title: string;
    text: string;
    rawTextForAI: string;
    kind: 'trip';
  }>,
  indexSegs: Array<{
    pageStart: number;
    pageEnd: number;
    title: string;
    text: string;
    rawTextForAI: string;
    kind: 'trip';
    fromIndex: true;
  }>,
): Array<{
  pageStart: number;
  pageEnd: number;
  title: string;
  text: string;
  rawTextForAI: string;
  kind: 'trip';
}> {
  const byKey = new Map<string, {
    pageStart: number;
    pageEnd: number;
    title: string;
    text: string;
    rawTextForAI: string;
    kind: 'trip';
  }>();
  const all = [...heuristicSegs, ...indexSegs].sort((a, b) => a.pageStart - b.pageStart);
  for (const s of all) {
    const key = `${normTitleKey(s.title)}|${s.pageStart}|${s.pageEnd}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        pageStart: s.pageStart,
        pageEnd: s.pageEnd,
        title: s.title,
        text: s.text,
        rawTextForAI: s.rawTextForAI,
        kind: 'trip',
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.pageStart - b.pageStart);
}
