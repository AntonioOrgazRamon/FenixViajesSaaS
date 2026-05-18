/**
 * Resumen cuantitativo del modelo geo por empresa (PASO 3).
 * Uso: npx ts-node --transpile-only scripts/geo-report.ts --companyId=<uuid>
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { fetchGeoMetrics } from './geo-metrics';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

async function main() {
  const companyId = arg('--companyId')?.trim();
  if (!companyId) {
    console.error('Uso: --companyId=<uuid>');
    process.exit(1);
  }

  console.log(JSON.stringify(await fetchGeoMetrics(companyId), null, 2));
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
