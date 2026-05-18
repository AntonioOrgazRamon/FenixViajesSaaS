/**
 * Ejecuta TravelSearchService contra la base de datos real (misma capa que el endpoint).
 *
 * Uso:
 *   npx ts-node --transpile-only scripts/travel-search-real-data.ts <companyUuid> [ruta/intent.json]
 *
 * O en .env: TRAVEL_SEARCH_COMPANY_ID=<uuid> y sin primer argumento.
 *
 * Si no se pasa JSON, usa una intención mínima por defecto (ajusta o pasa archivo).
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/infrastructure/db';
import { TravelSearchService } from '../src/services/travel/travel-search.service';
import { travelSearchIntentZ } from '../src/services/travel/travel-search.schema';

const defaultIntent = {
  destination: 'España',
  durationDays: 7,
  budgetPerPerson: 1500,
  month: 6,
  travelers: 2,
  travelType: 'cultural',
  preferences: ['familia'],
};

async function main() {
  const companyId = (process.argv[2] || process.env.TRAVEL_SEARCH_COMPANY_ID || '').trim();
  if (!companyId) {
    console.error('Indica companyId:');
    console.error(
      '  npx ts-node --transpile-only scripts/travel-search-real-data.ts <companyUuid> [intent.json]',
    );
    console.error('O variable TRAVEL_SEARCH_COMPANY_ID en .env');
    process.exit(1);
  }

  let raw: unknown = defaultIntent;
  const file = process.argv[3];
  if (file) {
    const abs = path.resolve(file);
    raw = JSON.parse(fs.readFileSync(abs, 'utf8')) as unknown;
  }

  const parsed = travelSearchIntentZ.safeParse(raw);
  if (!parsed.success) {
    console.error('Intent inválido:', parsed.error.issues.map((i) => i.message).join('; '));
    process.exit(1);
  }

  const approved = await prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } });
  console.error(`Viajes APPROVED para companyId=${companyId}: ${approved}\n`);

  const svc = new TravelSearchService();
  const out = await svc.searchByIntent(companyId, parsed.data);
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
