/**
 * QA: lectura solo-BD de heroes para smart-proposal y HTML de propuesta.
 * No llama a Unsplash/Pexels (verifica el camino de getPrimaryHeroImageByTripIds).
 *
 * Requiere: DATABASE_URL, QA_COMPANY_ID
 * Opcional: QA_LEAD_ID — ejecuta SmartProposalService.getState y muestra hero por opción.
 *
 * npm run qa:travel-media-proposals
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';
import { getPrimaryHeroImageByTripIds } from '../src/services/travel/media/travel-media-resolve';
import { SmartProposalService } from '../src/modules/leads/smart-proposal.service';

async function main() {
  const companyId = process.env.QA_COMPANY_ID?.trim();
  const leadId = process.env.QA_LEAD_ID?.trim();

  if (!companyId) {
    console.error('Define QA_COMPANY_ID.');
    process.exit(1);
  }

  console.log('--- QA travel media + proposals (BD only) ---');

  const tripsWithPrimary = await prisma.travelMediaAsset.findMany({
    where: { companyId, isPrimary: true },
    select: { tripId: true, imageUrl: true, sourceProvider: true },
    take: 200,
  });
  console.log('trips_with_primary_asset:', tripsWithPrimary.length);

  const jobs = await prisma.travelMediaJob.groupBy({
    by: ['status'],
    where: { companyId },
    _count: true,
  });
  console.log('jobs_by_status:', jobs);

  if (leadId) {
    const t0 = Date.now();
    const state = await new SmartProposalService().getState(companyId, leadId, 'COMPANY_ADMIN');
    const ms = Date.now() - t0;
    const trips = state.analysis?.recommendedTrips ?? [];
    const ids = [...new Set(trips.map((x) => x.id))];
    const tMap = Date.now();
    const heroes = await getPrimaryHeroImageByTripIds(companyId, ids);
    const mapMs = Date.now() - tMap;

    console.log('getState_ms:', ms, 'getPrimaryHeroImageByTripIds_ms:', mapMs);
    console.log(
      'recommended_trips:',
      trips.map((t) => ({
        id: t.id,
        title: t.title,
        heroInState: t.heroImageUrl ?? null,
        heroMapOnly: heroes.get(t.id) ?? null,
      })),
    );

    const proposal = await prisma.proposal.findFirst({
      where: { companyId, leadId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (proposal) {
      const ver = await prisma.proposalVersion.findFirst({
        where: { proposalId: proposal.id, companyId },
        orderBy: { versionNumber: 'desc' },
        select: { generatedHtml: true, versionNumber: true },
      });
      const html = ver?.generatedHtml ?? '';
      const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
      console.log('latest_version:', ver?.versionNumber ?? null, 'img_tags:', imgs.length);
      const hasDocHero = html.includes('doc-hero');
      const hasCardHero = html.includes('card-hero');
      console.log('html_classes:', { docHero: hasDocHero, cardHero: hasCardHero });
    } else {
      console.log('Sin Proposal para este lead aún.');
    }
  } else {
    console.log('Opcional: QA_LEAD_ID para validar SmartProposal + HTML.');
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
