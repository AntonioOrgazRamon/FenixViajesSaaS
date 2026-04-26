/**
 * Elimina todos los PDFs de catálogo: travel_documents, viajes asociados, jobs y archivos.
 * Uso: npx ts-node --transpile-only scripts/purge-all-travel-documents.ts
 */
import 'dotenv/config';
import { rm, unlink } from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function tryUnlink(rel: string) {
  const p = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  try {
    await unlink(p);
  } catch {
    /* ignore */
  }
}

async function tryRmDir(companyId: string) {
  const dir = path.join(process.cwd(), 'uploads', 'travel-pdfs', companyId);
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

async function main() {
  const docs = await prisma.travelDocument.findMany({ select: { id: true, companyId: true, storagePath: true, extractedTextPath: true } });
  if (docs.length === 0) {
    console.log('No hay documentos de viaje (travel_documents) en la BD.');
    return;
  }

  const byCompany = new Set(docs.map((d) => d.companyId));

  const tripCount = await prisma.travelTrip.count({ where: { documentId: { not: null } } });
  const jobCount = await prisma.travelImportJob.count({ where: { documentId: { not: null } } });

  await prisma.$transaction(async (tx) => {
    const delTrips = await tx.travelTrip.deleteMany({ where: { documentId: { not: null } } });
    const delJobs = await tx.travelImportJob.deleteMany({ where: { documentId: { not: null } } });
    const delDocs = await tx.travelDocument.deleteMany();
    console.log('Eliminado:', { trips: delTrips.count, importJobs: delJobs.count, documents: delDocs.count, prevCounts: { tripCount, jobCount, docCount: docs.length } });
  });

  for (const d of docs) {
    await tryUnlink(d.storagePath);
    await tryUnlink(d.extractedTextPath);
  }
  for (const cid of byCompany) {
    await tryRmDir(cid);
  }
  console.log('Archivos y carpetas uploads/travel-pdfs/<empresa> limpiados (si existían).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
