import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { extractText } from 'unpdf';
import prisma from '../../infrastructure/db';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';
import { config } from '../../common/config';

export type PageText = { page: number; text: string };

/**
 * FASE 3 — Extrae texto por página con unpdf (PDF.js), limpia y persiste JSON.
 */
export class PdfExtractionService {
  async extractTextFromDocument(documentId: string, companyId: string): Promise<{
    documentId: string;
    totalPages: number;
    extractedTextPath: string;
  }> {
    const doc = await prisma.travelDocument.findFirst({
      where: { id: documentId, companyId },
    });
    if (!doc) {
      throw new NotFoundError('Documento no encontrado');
    }
    if (doc.mimeType !== 'application/pdf') {
      throw new ValidationError('El documento no es un PDF');
    }

    const fullPath = path.isAbsolute(doc.storagePath)
      ? doc.storagePath
      : path.join(process.cwd(), doc.storagePath);

    const buffer = await readFile(fullPath);
    const { totalPages, text: pages } = await extractText(new Uint8Array(buffer), { mergePages: false });

    const pageTexts: PageText[] = pages.map((t, i) => ({
      page: i + 1,
      text: cleanPageText(t),
    }));

    const outDir = path.join(process.cwd(), config.TRAVEL_PDF_BASE_DIR, companyId, 'extracted');
    await mkdir(outDir, { recursive: true });
    const extractedTextPath = path.join(outDir, `${documentId}.json`);
    await writeFile(
      extractedTextPath,
      JSON.stringify(
        { documentId, totalPages, pages: pageTexts, extractedAt: new Date().toISOString() },
        null,
        2
      ),
      'utf-8',
    );

    const rel = path.relative(process.cwd(), extractedTextPath);

    await prisma.travelDocument.update({
      where: { id: documentId },
      data: {
        totalPages,
        extractedTextPath: rel.split(path.sep).join('/'),
        errorMessage: null,
        // `status` lo fija el pipeline (TripImportService): PROCESSED solo al terminar importación.
      },
    });

    return {
      documentId,
      totalPages,
      extractedTextPath: rel.split(path.sep).join('/'),
    };
  }

  /**
   * Lee un PDF desde disco (ruta relativa a cwd o absoluta) y devuelve páginas.
   */
  async extractPages(filePath: string): Promise<{ totalPages: number; pages: PageText[] }> {
    const full = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const buffer = await readFile(full);
    const { totalPages, text: pageStrings } = await extractText(new Uint8Array(buffer), { mergePages: false });
    const pages: PageText[] = pageStrings.map((t, i) => ({
      page: i + 1,
      text: cleanPageText(t),
    }));
    return { totalPages, pages };
  }
}

function cleanPageText(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/[\t\f]/g, ' ')
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
