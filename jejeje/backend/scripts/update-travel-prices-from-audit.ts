/**
 * Actualización controlada de indicative_price + currency desde auditoría PDF (tenant-safe).
 *
 * Por defecto: dry-run (no escribe). Con --apply persiste cambios.
 *
 *   npm run travel:update-prices-from-audit -- --companyId=<uuid>
 *   npm run travel:update-prices-from-audit -- --companyId=<uuid> --apply
 *
 * Solo toca: indicativePrice, currency, updatedAt (automático Prisma).
 * No existe en schema un campo de notas de auditoría: las notas van al reporte, no a BD.
 */
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import prisma from '../src/infrastructure/db';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function normalizeTitle(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

type AuditRow = {
  titleExact: string;
  indicativePrice: number;
  currency: 'EUR';
  sourcePdfPage: number;
  sourcePrintedPage: number;
  confidence: 'HIGH';
  notes: string;
};

/** Precios auditados (no inventados; fuente PDF indicada por el usuario). */
const AUDIT: AuditRow[] = [
  {
    titleExact: 'Aires de Tailandia',
    indicativePrice: 1820,
    currency: 'EUR',
    sourcePdfPage: 14,
    sourcePrintedPage: 27,
    confidence: 'HIGH',
    notes: 'salida martes; no hay tabla por temporadas.',
  },
  {
    titleExact: 'Tailandia Fascinante',
    indicativePrice: 1590,
    currency: 'EUR',
    sourcePdfPage: 13,
    sourcePrintedPage: 25,
    confidence: 'HIGH',
    notes: 'no confundir con Tailandia, Sensaciones Auténticas: 1975 €.',
  },
  {
    titleExact: 'Contrastes de Argentina y Chile',
    indicativePrice: 5125,
    currency: 'EUR',
    sourcePdfPage: 24,
    sourcePrintedPage: 47,
    confidence: 'HIGH',
    notes: 'posibles tasas/ecotasas no incluidas.',
  },
  {
    titleExact: 'Esencias de Argentina y Chile',
    indicativePrice: 3995,
    currency: 'EUR',
    sourcePdfPage: 19,
    sourcePrintedPage: 37,
    confidence: 'HIGH',
    notes: 'tasas de Puerto Pañuelo no incluidas.',
  },
  {
    titleExact: 'Exploradores de la Patagonia',
    indicativePrice: 5115,
    currency: 'EUR',
    sourcePdfPage: 21,
    sourcePrintedPage: 41,
    confidence: 'HIGH',
    notes: 'incluye Crucero Australis; revisar notas operativas.',
  },
  {
    titleExact: 'Lo Mejor de Argentina',
    indicativePrice: 4365,
    currency: 'EUR',
    sourcePdfPage: 23,
    sourcePrintedPage: 45,
    confidence: 'HIGH',
    notes: 'avistaje de ballenas solo en fechas concretas.',
  },
  {
    titleExact: 'Maravillas Naturales de Argentina y Chile',
    indicativePrice: 4235,
    currency: 'EUR',
    sourcePdfPage: 20,
    sourcePrintedPage: 39,
    confidence: 'HIGH',
    notes: 'servicios sujetos a temporada/operativa.',
  },
  {
    titleExact: 'Paisajes Argentinos',
    indicativePrice: 3995,
    currency: 'EUR',
    sourcePdfPage: 17,
    sourcePrintedPage: 33,
    confidence: 'HIGH',
    notes: 'sin múltiples temporadas de precio.',
  },
  {
    titleExact: 'Patagonia Inédita',
    indicativePrice: 3995,
    currency: 'EUR',
    sourcePdfPage: 18,
    sourcePrintedPage: 35,
    confidence: 'HIGH',
    notes: 'hay notas de operativa en temporada baja.',
  },
  {
    titleExact: 'Patagonia y Distrito de Lagos',
    indicativePrice: 4525,
    currency: 'EUR',
    sourcePdfPage: 22,
    sourcePrintedPage: 43,
    confidence: 'HIGH',
    notes: 'Cruce de Lagos con fechas sin operación.',
  },
];

async function resolveTripIds(
  companyId: string,
  row: AuditRow,
): Promise<
  | { kind: 'unique'; id: string; titleInDb: string; match: 'exact' | 'normalized' }
  | { kind: 'none' }
  | { kind: 'ambiguous'; ids: string[]; titles: string[] }
> {
  const exact = await prisma.travelTrip.findMany({
    where: { companyId, title: row.titleExact },
    select: { id: true, title: true },
  });
  if (exact.length > 1) {
    return {
      kind: 'ambiguous',
      ids: exact.map((x) => x.id),
      titles: exact.map((x) => x.title),
    };
  }
  if (exact.length === 1) {
    return { kind: 'unique', id: exact[0].id, titleInDb: exact[0].title, match: 'exact' };
  }

  const n = normalizeTitle(row.titleExact);
  const candidates = await prisma.travelTrip.findMany({
    where: { companyId },
    select: { id: true, title: true },
  });
  const normHits = candidates.filter((c) => normalizeTitle(c.title) === n);
  if (normHits.length > 1) {
    return {
      kind: 'ambiguous',
      ids: normHits.map((x) => x.id),
      titles: normHits.map((x) => x.title),
    };
  }
  if (normHits.length === 1) {
    return {
      kind: 'unique',
      id: normHits[0].id,
      titleInDb: normHits[0].title,
      match: 'normalized',
    };
  }

  return { kind: 'none' };
}

async function main() {
  const companyId = arg('--companyId');
  if (!companyId) {
    console.error('Uso: npm run travel:update-prices-from-audit -- --companyId=<uuid> [--apply]');
    process.exit(1);
  }
  const apply = hasFlag('--apply');

  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { name: true },
  });
  if (!company) {
    console.error(`Empresa no encontrada: ${companyId}`);
    process.exit(1);
  }

  console.log('\n=== travel:update-prices-from-audit ===');
  console.log({
    companyId,
    companyName: company.name,
    mode: apply ? 'APPLY (escrituras)' : 'DRY-RUN (sin escrituras)',
  });
  console.log(
    '\nCampos en BD: solo indicative_price + currency. Notas PDF solo en este informe (no hay columna de auditoría en TravelTrip).\n',
  );

  const results: Array<{
    auditTitle: string;
    matched: boolean;
    ambiguous: boolean;
    matchType?: 'exact' | 'normalized';
    tripId?: string;
    titleInDb?: string;
    currentPrice: string | null;
    currentCurrency: string | null;
    newPrice: number;
    newCurrency: string;
    willUpdate: boolean;
    auditMeta: Omit<AuditRow, 'titleExact' | 'indicativePrice' | 'currency'>;
  }> = [];

  let unmatched = 0;
  let ambiguousCount = 0;

  for (const row of AUDIT) {
    const resolved = await resolveTripIds(companyId, row);

    if (resolved.kind === 'ambiguous') {
      ambiguousCount++;
      results.push({
        auditTitle: row.titleExact,
        matched: false,
        ambiguous: true,
        currentPrice: null,
        currentCurrency: null,
        newPrice: row.indicativePrice,
        newCurrency: row.currency,
        willUpdate: false,
        auditMeta: {
          sourcePdfPage: row.sourcePdfPage,
          sourcePrintedPage: row.sourcePrintedPage,
          confidence: row.confidence,
          notes: row.notes,
        },
      });
      console.log(`\n[AMBIGUO] "${row.titleExact}" → ${resolved.ids.length} filas:`);
      resolved.ids.forEach((id, i) => console.log(`  - ${id}  "${resolved.titles[i]}"`));
      continue;
    }

    if (resolved.kind === 'none') {
      unmatched++;
      results.push({
        auditTitle: row.titleExact,
        matched: false,
        ambiguous: false,
        currentPrice: null,
        currentCurrency: null,
        newPrice: row.indicativePrice,
        newCurrency: row.currency,
        willUpdate: false,
        auditMeta: {
          sourcePdfPage: row.sourcePdfPage,
          sourcePrintedPage: row.sourcePrintedPage,
          confidence: row.confidence,
          notes: row.notes,
        },
      });
      console.log(`\n[SIN MATCH] "${row.titleExact}"`);
      continue;
    }

    const trip = await prisma.travelTrip.findFirst({
      where: { id: resolved.id, companyId },
      select: { indicativePrice: true, currency: true, title: true },
    });
    if (!trip) {
      unmatched++;
      console.log(`\n[ERROR] Viaje resuelto pero no encontrado bajo companyId: ${resolved.id}`);
      continue;
    }

    const curDec = trip.indicativePrice;
    const curStr = curDec != null ? curDec.toString() : null;
    const curCur = trip.currency?.trim() ?? null;
    const priceEqual = curDec != null && new Prisma.Decimal(row.indicativePrice).equals(curDec);
    const currEqual = (curCur ?? '').toUpperCase() === row.currency.toUpperCase();
    const willUpdate = !priceEqual || !currEqual;

    results.push({
      auditTitle: row.titleExact,
      matched: true,
      ambiguous: false,
      matchType: resolved.match,
      tripId: resolved.id,
      titleInDb: trip.title,
      currentPrice: curStr,
      currentCurrency: curCur,
      newPrice: row.indicativePrice,
      newCurrency: row.currency,
      willUpdate,
      auditMeta: {
        sourcePdfPage: row.sourcePdfPage,
        sourcePrintedPage: row.sourcePrintedPage,
        confidence: row.confidence,
        notes: row.notes,
      },
    });

    console.log(`\n[MATCH ${resolved.match}] ${resolved.id}`);
    console.log(`  título BD: "${trip.title}"`);
    console.log(`  precio actual: ${curStr ?? 'NULL'} ${curCur ?? ''}`);
    console.log(`  precio nuevo: ${row.indicativePrice} ${row.currency}`);
    console.log(`  willUpdate: ${willUpdate}`);
    console.log(
      `  auditoría: PDF p.${row.sourcePdfPage} / impresa ${row.sourcePrintedPage} | ${row.confidence}`,
    );
    console.log(`  notas (solo informe): ${row.notes}`);

    if (apply && willUpdate) {
      await prisma.travelTrip.update({
        where: { id: resolved.id },
        data: {
          indicativePrice: new Prisma.Decimal(row.indicativePrice),
          currency: row.currency,
        },
      });
      console.log('  → actualizado.');
    } else if (apply && !willUpdate) {
      console.log('  → sin cambios (ya coincidía).');
    } else if (!apply && willUpdate) {
      console.log('  → DRY-RUN: se aplicaría con --apply');
    } else {
      console.log('  → DRY-RUN: ya correcto');
    }
  }

  const matchedCount = results.filter((r) => r.matched).length;
  const toUpdate = results.filter((r) => r.matched && r.willUpdate).length;

  console.log('\n--- Resumen ---');
  console.log({
    auditRows: AUDIT.length,
    matched: matchedCount,
    unmatched,
    ambiguous: ambiguousCount,
    willUpdateOrUpdated: toUpdate,
    apply,
  });

  console.log('\n--- Tabla resumen (matched trips) ---');
  console.table(
    results
      .filter((r) => r.matched)
      .map((r) => ({
        tripId: r.tripId,
        titleInDb: r.titleInDb,
        match: r.matchType,
        currentPrice: r.currentPrice,
        newPrice: r.newPrice,
        willUpdate: r.willUpdate,
      })),
  );
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
