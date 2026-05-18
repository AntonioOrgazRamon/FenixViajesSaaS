import {
  TravelStyleAxis,
  type Prisma,
  type TravelJsonImportBatchStatus,
  type TripPace,
} from '@prisma/client';
import prisma from '../../infrastructure/db';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';
import { TripImportService } from '../../services/travel/trip-import.service';
import { TripNormalizationService } from '../../services/travel/trip-normalization.service';
import { sanitizeJsonTextNodes } from '../../services/travel/travel-json-import-sanitize';
import {
  classifyTravelJsonTrip,
  mergeEnrichedNormalizedPatch,
  normalizeImportSlug,
  travelJsonToTripAiExtract,
  type TravelJsonItemClassification,
} from '../../services/travel/travel-json-import-validation';
import type { TravelJsonEnrichedRecord } from '../../services/travel/travel-json-import.schema';
import {
  assertPasteJsonContentWithinLimit,
  parseJsonTextToTripsArray,
} from '../../services/travel/travel-json-import-parse';
import { normalizePaceCanonical } from '../../services/travel/travel-json-import-flex-normalize';
import { syncTripGeoPlacesFromDestinations } from '../../services/geo/sync-trip-geo-from-destinations';

const tripImporter = new TripImportService();
const normalizer = new TripNormalizationService();

function parseTravelStyleAxes(raw: unknown): TravelStyleAxis[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(
    Object.values(TravelStyleAxis).filter((v): v is TravelStyleAxis => typeof v === 'string'),
  );
  const out: TravelStyleAxis[] = [];
  for (const x of raw) {
    if (typeof x === 'string' && allowed.has(x as TravelStyleAxis)) out.push(x as TravelStyleAxis);
  }
  return [...new Set(out)];
}

function tripPaceForDb(paceField: unknown): TripPace {
  if (typeof paceField !== 'string') return 'UNKNOWN';
  return normalizePaceCanonical(paceField) ?? 'UNKNOWN';
}

async function refreshBatchAggregate(batchId: string): Promise<void> {
  const items = await prisma.travelJsonImportItem.findMany({
    where: { batchId },
    select: { validationStatus: true },
  });
  const totalItems = items.length;
  const invalidItems = items.filter((i) => i.validationStatus === 'INVALID').length;
  const validItems = totalItems - invalidItems;
  let status: TravelJsonImportBatchStatus = 'VALIDATED';
  if (totalItems === 0) status = 'FAILED';
  else if (invalidItems > 0) status = 'PARTIAL_ERRORS';

  await prisma.travelJsonImportBatch.update({
    where: { id: batchId },
    data: { totalItems, validItems, invalidItems, status },
  });
}

export class TravelJsonImportService {
  /** Upload fichero: mismo pipeline que paste (parse → staging). */
  async uploadBuffer(params: {
    companyId: string;
    uploadedByUserId: string;
    fileName: string;
    buffer: Buffer;
  }) {
    let trips: unknown[];
    try {
      trips = parseJsonTextToTripsArray(params.buffer.toString('utf8'));
    } catch (e) {
      logger.warn(
        { companyId: params.companyId, fileName: params.fileName, err: e },
        'travel-json-import: JSON inválido (upload)',
      );
      throw e instanceof ValidationError ? e : new ValidationError('JSON corrupto o ilegible');
    }
    return this.persistStagingBatch({
      companyId: params.companyId,
      uploadedByUserId: params.uploadedByUserId,
      fileName: params.fileName,
      trips,
      source: 'upload',
    });
  }

  /** Pegar JSON en texto: tamaño UTF-8 validado; objeto único → un ítem. */
  async pasteJsonContent(params: {
    companyId: string;
    uploadedByUserId: string;
    fileName: string;
    jsonContent: string;
  }) {
    const trimmed = params.jsonContent.trim();
    if (!trimmed.length) {
      throw new ValidationError('jsonContent no puede estar vacío');
    }
    assertPasteJsonContentWithinLimit(trimmed);

    let trips: unknown[];
    try {
      trips = parseJsonTextToTripsArray(trimmed);
    } catch (e) {
      logger.warn(
        { companyId: params.companyId, fileName: params.fileName, err: e },
        'travel-json-import: JSON inválido (paste)',
      );
      throw e instanceof ValidationError ? e : new ValidationError('JSON inválido');
    }

    logger.info(
      {
        event: 'travel-json-import:paste-accepted',
        companyId: params.companyId,
        fileName: params.fileName,
        tripCount: trips.length,
      },
      'travel-json-import: paste validado, creando staging',
    );

    return this.persistStagingBatch({
      companyId: params.companyId,
      uploadedByUserId: params.uploadedByUserId,
      fileName: params.fileName,
      trips,
      source: 'paste',
    });
  }

  private async persistStagingBatch(params: {
    companyId: string;
    uploadedByUserId: string;
    fileName: string;
    trips: unknown[];
    source: 'upload' | 'paste';
  }) {
    const sanitized = sanitizeJsonTextNodes(params.trips) as unknown[];

    const batchId = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const batch = await tx.travelJsonImportBatch.create({
        data: {
          companyId: params.companyId,
          uploadedByUserId: params.uploadedByUserId,
          fileName: params.fileName.slice(0, 500),
          status: 'UPLOADED',
          totalItems: 0,
          validItems: 0,
          invalidItems: 0,
        },
      });

      for (const element of sanitized) {
        const cls = classifyTravelJsonTrip(element);
        await tx.travelJsonImportItem.create({
          data: {
            batchId: batch.id,
            companyId: params.companyId,
            sourceJson:
              element !== null && typeof element === 'object'
                ? (element as object)
                : { value: element as string | number | boolean | null },
            normalizedJson: cls.normalized as object,
            validationStatus: cls.status,
            validationErrors: cls.errors,
            validationWarnings: cls.warnings,
          },
        });
      }

      await refreshBatchAggregateInTx(tx, batch.id);
      return batch.id;
    });

    const batch = await prisma.travelJsonImportBatch.findFirst({
      where: { id: batchId, companyId: params.companyId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!batch) throw new NotFoundError('Lote no encontrado');

    logger.info(
      {
        event: 'travel-json-import:staging-created',
        batchId: batch.id,
        companyId: params.companyId,
        totalItems: batch.totalItems,
        validItems: batch.validItems,
        invalidItems: batch.invalidItems,
        source: params.source,
      },
      'travel-json-import: lote staging listo',
    );

    return batch;
  }

  async listBatches(companyId: string, page: number, pageSize: number) {
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;
    const [items, total] = await Promise.all([
      prisma.travelJsonImportBatch.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          fileName: true,
          status: true,
          totalItems: true,
          validItems: true,
          invalidItems: true,
          createdAt: true,
          updatedAt: true,
          uploadedByUserId: true,
        },
      }),
      prisma.travelJsonImportBatch.count({ where: { companyId } }),
    ]);
    return { items, total, page, pageSize: take };
  }

  async getBatchDetail(batchId: string, companyId: string) {
    const batch = await prisma.travelJsonImportBatch.findFirst({
      where: { id: batchId, companyId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!batch) throw new NotFoundError('Lote no encontrado');
    return batch;
  }

  async patchItem(params: {
    itemId: string;
    companyId: string;
    normalizedPatch: Record<string, unknown>;
  }) {
    const item = await prisma.travelJsonImportItem.findFirst({
      where: { id: params.itemId, companyId: params.companyId },
    });
    if (!item) throw new NotFoundError('Ítem no encontrado');
    if (item.importedTripId) {
      throw new ValidationError('No se puede editar un ítem ya importado');
    }

    const prev = item.normalizedJson as TravelJsonEnrichedRecord;
    const merged = mergeEnrichedNormalizedPatch(prev, params.normalizedPatch);
    const cls: TravelJsonItemClassification = classifyTravelJsonTrip(merged);

    const updated = await prisma.travelJsonImportItem.update({
      where: { id: item.id },
      data: {
        normalizedJson: cls.normalized as object,
        validationStatus: cls.status,
        validationErrors: cls.errors,
        validationWarnings: cls.warnings,
      },
    });

    await refreshBatchAggregate(item.batchId);
    return updated;
  }

  async importBatch(params: {
    batchId: string;
    companyId: string;
    actorUserId: string;
    actorRole: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    const batch = await prisma.travelJsonImportBatch.findFirst({
      where: { id: params.batchId, companyId: params.companyId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    if (!batch) throw new NotFoundError('Lote no encontrado');
    if (batch.status === 'IMPORTED') {
      throw new ValidationError('Este lote ya fue importado');
    }

    await prisma.travelJsonImportBatch.update({
      where: { id: batch.id },
      data: { status: 'APPROVED' },
    });

    let imported = 0;
    let skippedInvalid = 0;
    let skippedDuplicate = 0;
    let failed = 0;

    for (const item of batch.items) {
      if (item.importedTripId) continue;
      if (item.validationStatus === 'INVALID') {
        skippedInvalid++;
        continue;
      }

      const norm = item.normalizedJson as TravelJsonEnrichedRecord;
      const slugKey = normalizeImportSlug(norm.trip.slug);
      if (!slugKey) {
        skippedInvalid++;
        continue;
      }

      const exists = await prisma.travelTrip.findFirst({
        where: { companyId: params.companyId, importSlug: slugKey },
        select: { id: true },
      });
      if (exists) {
        skippedDuplicate++;
        logger.info(
          {
            event: 'travel-json-import:skip-duplicate-slug',
            companyId: params.companyId,
            batchId: batch.id,
            itemId: item.id,
            slug: slugKey,
          },
          'Import JSON: slug duplicado en tenant',
        );
        continue;
      }

      try {
        let ai = travelJsonToTripAiExtract(norm);
        ai = normalizer.normalizeTripStrings(ai);
        ai = { ...ai, destinations: normalizer.dedupeDestinations(ai.destinations) };
        const conf = Math.min(0.95, Math.max(0.35, ai.confidence ?? 0.82));

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          const trip = await tripImporter.persistTrip(
            params.companyId,
            null,
            {
              sourcePageStart: 0,
              sourcePageEnd: 0,
              rawText: '[JSON_IMPORT]\n' + JSON.stringify(norm).slice(0, 950_000),
              data: ai,
              confidence: conf,
              importSlug: slugKey,
              pace: tripPaceForDb(norm.trip.pace),
              styleAxes: parseTravelStyleAxes((norm.trip as { travelStyleAxes?: unknown }).travelStyleAxes),
            },
            tx,
          );
          await syncTripGeoPlacesFromDestinations(tx, params.companyId, trip.id);
          await tx.travelJsonImportItem.update({
            where: { id: item.id },
            data: { importedTripId: trip.id },
          });
        });
        imported++;
        logger.info(
          {
            event: 'travel-json-import:item-imported',
            companyId: params.companyId,
            batchId: batch.id,
            itemId: item.id,
          },
          'Import JSON: viaje persistido + geo enlazado',
        );
      } catch (e) {
        failed++;
        logger.error(
          {
            err: e,
            companyId: params.companyId,
            batchId: batch.id,
            itemId: item.id,
          },
          'Import JSON: fallo al persistir ítem',
        );
      }
    }

    const nextStatus: TravelJsonImportBatchStatus =
      imported > 0 ? 'IMPORTED' : failed > 0 ? 'FAILED' : 'PARTIAL_ERRORS';

    await prisma.travelJsonImportBatch.update({
      where: { id: batch.id },
      data: { status: nextStatus },
    });

    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        action: 'TRAVEL_JSON_IMPORT_BATCH_COMMIT',
        targetType: 'TravelJsonImportBatch',
        targetId: batch.id,
        targetCompanyId: params.companyId,
        result: imported > 0 ? 'SUCCESS' : 'PARTIAL',
        ipAddress: params.ipAddress ?? undefined,
        userAgent: params.userAgent ?? undefined,
        metadata: {
          imported,
          skippedInvalid,
          skippedDuplicate,
          failed,
        },
      },
    });

    return { imported, skippedInvalid, skippedDuplicate, failed };
  }

  async deleteBatch(batchId: string, companyId: string) {
    const batch = await prisma.travelJsonImportBatch.findFirst({
      where: { id: batchId, companyId },
    });
    if (!batch) throw new NotFoundError('Lote no encontrado');
    if (batch.status === 'IMPORTED') {
      throw new ValidationError('No se puede eliminar un lote ya importado');
    }
    await prisma.travelJsonImportBatch.delete({ where: { id: batch.id } });
  }
}

async function refreshBatchAggregateInTx(tx: Prisma.TransactionClient, batchId: string): Promise<void> {
  const items = await tx.travelJsonImportItem.findMany({
    where: { batchId },
    select: { validationStatus: true },
  });
  const totalItems = items.length;
  const invalidItems = items.filter((i) => i.validationStatus === 'INVALID').length;
  const validItems = totalItems - invalidItems;
  let status: TravelJsonImportBatchStatus = 'VALIDATED';
  if (totalItems === 0) status = 'FAILED';
  else if (invalidItems > 0) status = 'PARTIAL_ERRORS';

  await tx.travelJsonImportBatch.update({
    where: { id: batchId },
    data: { totalItems, validItems, invalidItems, status },
  });
}
