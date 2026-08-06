/**
 * Genera / actualiza embeddings de viajes APPROVED por empresa.
 *
 * Uso:
 *   npm run travel:embed -- --companyId=<uuid>
 *   npm run travel:embed -- --companyId=<uuid> --limit=50
 *   npm run travel:embed -- --companyId=<uuid> --dry-run
 *   npm run travel:embed -- --companyId=<uuid> --tripId=<uuid>
 */
import 'dotenv/config';
import {
  rebuildCompanyTripEmbeddings,
  syncTripEmbeddingForTrip,
} from '../src/services/recommendation/trip-embedding-sync.service';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1);
}

async function main() {
  const companyId = arg('--companyId')?.trim();
  if (!companyId) {
    console.error(
      'Uso: npm run travel:embed -- --companyId=<uuid> [--limit=N] [--dry-run] [--force] [--tripId=<uuid>]',
    );
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const limitRaw = arg('--limit');
  const limit = limitRaw ? parseInt(limitRaw, 10) : undefined;
  const tripId = arg('--tripId')?.trim();

  if (tripId) {
    const r = await syncTripEmbeddingForTrip(companyId, tripId, { dryRun, force });
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  const summary = await rebuildCompanyTripEmbeddings(companyId, { dryRun, limit, force });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
