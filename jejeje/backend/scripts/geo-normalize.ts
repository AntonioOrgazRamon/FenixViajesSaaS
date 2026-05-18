/**
 * Normalización segura: propone (dry-run) o aplica jerarquía semilla sin borrar ni fusionar.
 *
 * Uso:
 *   npm run geo:normalize -- --companyId=<uuid>
 *   npm run geo:normalize -- --companyId=<uuid> --apply
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { fetchGeoMetrics } from './geo-metrics';
import { applySeedHierarchy, planSeedHierarchy } from './geo-seed-hierarchy';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

async function main() {
  const companyId = arg('--companyId')?.trim();
  const apply = process.argv.includes('--apply');
  if (!companyId) {
    console.error('Uso: --companyId=<uuid> [--apply]');
    process.exit(1);
  }

  const metrics = await fetchGeoMetrics(companyId);
  const plan = await planSeedHierarchy(companyId);

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          metrics,
          hierarchyPlan: plan,
          hint: 'Con --apply se ejecutan upserts de continentes/macro y enlaces parentId listados (sin merges ni deletes).',
        },
        null,
        2,
      ),
    );
    return;
  }

  const applied = await applySeedHierarchy(companyId);
  const metricsAfter = await fetchGeoMetrics(companyId);
  console.log(JSON.stringify({ mode: 'applied', plan: applied, metricsBefore: metrics, metricsAfter }, null, 2));
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
