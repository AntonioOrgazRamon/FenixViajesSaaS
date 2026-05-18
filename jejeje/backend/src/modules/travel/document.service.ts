import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../infrastructure/db';
import { config } from '../../common/config';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';
import { TripImportService } from '../../services/travel/trip-import.service';

const importService = new TripImportService();

const allowedMime = 'application/pdf';
const TRAVEL_MIN_UPLOAD_MB = 130;

function assertPdfMagicBuffer(buf: Buffer) {
  if (buf.length < 5) {
    throw new ValidationError('PDF no válido');
  }
  const sig = buf.subarray(0, 5).toString('latin1');
  if (!sig.startsWith('%PDF-')) {
    throw new ValidationError('El archivo no es un PDF válido (contenido no coincide con firma PDF)');
  }
}

export class TravelDocumentService {
  maxMb(): number {
    const configured = parseFloat(config.TRAVEL_PDF_MAX_MB || '150');
    if (!Number.isFinite(configured)) {
      return TRAVEL_MIN_UPLOAD_MB;
    }
    return Math.max(TRAVEL_MIN_UPLOAD_MB, configured);
  }

  maxBytes(): number {
    return Math.floor(this.maxMb() * 1024 * 1024);
  }

  async createFromUpload(input: {
    companyId: string;
    originalName: string;
    buffer: Buffer;
    mimeType: string;
    size: number;
  }): Promise<{ documentId: string; filename: string; status: string }> {
    if (input.mimeType !== allowedMime) {
      throw new ValidationError('Solo se permiten archivos PDF');
    }
    if (input.size < 1) {
      throw new ValidationError('Archivo vacío');
    }
    if (input.size > this.maxBytes()) {
      throw new ValidationError(
        `El PDF supera el tamaño máximo (${this.maxMb()} MB)`,
      );
    }

    assertPdfMagicBuffer(input.buffer);

    const id = uuidv4();
    const ext = path.extname(input.originalName) || '.pdf';
    const filename = `${id}${ext}`;
    const relDir = path.join(config.TRAVEL_PDF_BASE_DIR, input.companyId);
    const absDir = path.join(process.cwd(), relDir);
    await mkdir(absDir, { recursive: true });
    const relPath = path.join(relDir, filename).split(path.sep).join('/');
    await writeFile(path.join(process.cwd(), relPath), input.buffer);

    const doc = await prisma.travelDocument.create({
      data: {
        companyId: input.companyId,
        filename,
        originalName: input.originalName.slice(0, 500),
        mimeType: input.mimeType,
        size: input.size,
        storagePath: relPath,
        status: 'UPLOADED',
      },
    });

    return { documentId: doc.id, filename, status: doc.status };
  }

  async list(companyId: string, page = 1, pageSize = 20) {
    const take = Math.min(100, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;
    const [rows, total] = await Promise.all([
      prisma.travelDocument.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          filename: true,
          originalName: true,
          size: true,
          status: true,
          totalPages: true,
          errorMessage: true,
          createdAt: true,
          updatedAt: true,
          importJobs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              progress: true,
              currentStep: true,
            },
          },
        },
      }),
      prisma.travelDocument.count({ where: { companyId } }),
    ]);
    const items = rows.map(({ importJobs, ...rest }) => ({
      ...rest,
      importJob: importJobs[0] ?? null,
    }));
    return { items, total, page, pageSize: take };
  }

  async getById(id: string, companyId: string) {
    const d = await prisma.travelDocument.findFirst({
      where: { id, companyId },
      include: {
        importJobs: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!d) {
      throw new NotFoundError('Documento no encontrado');
    }
    return d;
  }

  async getJob(jobId: string, companyId: string) {
    const j = await prisma.travelImportJob.findFirst({
      where: { id: jobId, companyId },
    });
    if (!j) {
      throw new NotFoundError('Job no encontrado');
    }
    return j;
  }

  startProcess(documentId: string, companyId: string) {
    return importService.startProcessingJob(documentId, companyId);
  }

  private async safeUnlinkRel(rel: string | null | undefined): Promise<void> {
    if (!rel) return;
    const full = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    try {
      await unlink(full);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw e;
    }
  }

  /**
   * Borra un PDF, el JSON de extracción, los viajes y jobs asociados a ese documento.
   */
  async removeById(documentId: string, companyId: string): Promise<void> {
    const d = await prisma.travelDocument.findFirst({
      where: { id: documentId, companyId },
    });
    if (!d) {
      throw new NotFoundError('Documento no encontrado');
    }
    await prisma.$transaction([
      prisma.travelTrip.deleteMany({ where: { companyId, documentId } }),
      prisma.travelImportJob.deleteMany({ where: { companyId, documentId } }),
      prisma.travelDocument.delete({ where: { id: documentId, companyId } }),
    ]);
    await this.safeUnlinkRel(d.storagePath);
    await this.safeUnlinkRel(d.extractedTextPath);
  }

  /**
   * Elimina todos los PDFs subidos, viajes importados del PDF (documentId no nulo) y jobs de importación
   * de la empresa. No borra viajes creados manualmente sin `documentId`.
   */
  async clearCompanyCatalog(companyId: string): Promise<{ documentsRemoved: number }> {
    const docs = await prisma.travelDocument.findMany({
      where: { companyId },
      select: { id: true, storagePath: true, extractedTextPath: true },
    });
    if (docs.length === 0) {
      return { documentsRemoved: 0 };
    }
    await prisma.$transaction([
      prisma.travelTrip.deleteMany({ where: { companyId, documentId: { not: null } } }),
      prisma.travelImportJob.deleteMany({ where: { companyId } }),
      prisma.travelDocument.deleteMany({ where: { companyId } }),
    ]);
    for (const d of docs) {
      await this.safeUnlinkRel(d.storagePath);
      await this.safeUnlinkRel(d.extractedTextPath);
    }
    return { documentsRemoved: docs.length };
  }
}
