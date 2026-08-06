/**
 * Elimina un TravelDocument por originalName, sus viajes, jobs y archivos.
 * Uso: $env:DELETE_DOC_NAME="Vietnam-2026-27.pdf"; npx ts-node --transpile-only scripts/delete-travel-document.ts
 */
import 'dotenv/config';
import { unlink } from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const name = process.env.DELETE_DOC_NAME;
const prisma = new PrismaClient();

async function tryUnlink(rel: string | null | undefined) {
  if (!rel) return;
  const p = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  try {
    await unlink(p);
    console.log('Archivo eliminado:', p);
  } catch (e) {
    console.warn('No se pudo eliminar (puede no existir):', p, e);
  }
}

async function main() {
  if (!name) {
    console.error('Define DELETE_DOC_NAME, ej. Vietnam-2026-27.pdf');
    process.exit(1);
  }
  const doc =
    (await prisma.travelDocument.findFirst({ where: { originalName: name } })) ||
    (await prisma.travelDocument.findFirst({ where: { originalName: { contains: name } } }));
  if (!doc) {
    console.error('No hay documento con originalName que contenga:', name);
    process.exit(1);
  }
  console.log('Encontrado:', doc.id, doc.originalName, 'status:', doc.status, 'págs:', doc.totalPages);

  await prisma.$transaction(async (tx) => {
    const trips = await tx.travelTrip.findMany({ where: { documentId: doc.id }, select: { id: true } });
    console.log('Viajes a borrar:', trips.length);
    if (trips.length) {
      await tx.travelTrip.deleteMany({ where: { documentId: doc.id } });
    }
    await tx.travelImportJob.deleteMany({ where: { documentId: doc.id } });
    await tx.travelDocument.delete({ where: { id: doc.id } });
  });

  await tryUnlink(doc.storagePath);
  await tryUnlink(doc.extractedTextPath);
  /* carpeta extraída: uploads/travel-pdfs/companyId/extracted/docId.json ya cubierta */

  console.log('Listo. Documento y datos relacionados eliminados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
