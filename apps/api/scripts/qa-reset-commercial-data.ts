/**
 * QA: borrar solo datos comerciales del tenant (leads, propuestas, runs de recomendación, PDFs).
 * No toca: TravelTrip, Destination, GeoPlace, TripGeoPlace, empresas, usuarios, imports JSON.
 *
 *   npm run qa:reset-commercial-data -- --companyId=<uuid>
 *   npm run qa:reset-commercial-data -- --companyId=<uuid> --apply
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/infrastructure/db';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit?.slice(name.length + 1)?.trim();
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function uploadsAbs(rel: string): string {
  const r = rel.replace(/\\/g, '/');
  if (path.isAbsolute(r)) return r;
  return path.join(process.cwd(), r);
}

async function main() {
  const companyId = arg('--companyId');
  if (!companyId) {
    console.error('Uso: npm run qa:reset-commercial-data -- --companyId=<uuid> [--apply]');
    process.exit(1);
  }
  const apply = hasFlag('--apply');

  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) {
    console.error(`Empresa no encontrada: ${companyId}`);
    process.exit(1);
  }

  const leadCount = await prisma.lead.count({ where: { companyId } });
  const proposalCount = await prisma.proposal.count({ where: { companyId } });
  const versionCount = await prisma.proposalVersion.count({ where: { companyId } });
  const activityCount = await prisma.leadActivity.count({ where: { companyId } });
  const runCount = await prisma.recommendationRun.count({ where: { companyId } });
  const noteCount = await prisma.leadNote.count({ where: { companyId } });
  const agentRunCount = await prisma.leadAgentRun.count({ where: { companyId } });

  const versions = await prisma.proposalVersion.findMany({
    where: { companyId },
    select: { id: true, pdfStoragePath: true, proposalId: true },
  });
  const pdfPaths = [
    ...new Set(
      versions.map((v) => v.pdfStoragePath).filter((p): p is string => Boolean(p?.trim())),
    ),
  ];

  const artifactCount = await prisma.proposalArtifact.count({ where: { companyId } });

  console.log('\n=== qa:reset-commercial-data ===');
  console.log(JSON.stringify({ companyId, companyName: company.name, apply }, null, 2));
  console.log('\n--- Conteos a borrar ---');
  console.log({
    leads: leadCount,
    proposals: proposalCount,
    proposalVersions: versionCount,
    leadActivities: activityCount,
    leadNotes: noteCount,
    leadAgentRuns: agentRunCount,
    recommendationRuns: runCount,
    proposalArtifacts: artifactCount,
    proposalVersionRowsWithPdfPath: pdfPaths.length,
  });

  console.log('\n--- PDFs en disco (rutas desde proposal_versions.pdf_storage_path) ---');
  for (const p of pdfPaths) {
    const abs = uploadsAbs(p);
    const exists = fs.existsSync(abs);
    console.log(`${exists ? 'OK' : 'MISSING'} ${p}`);
  }

  console.log('\n--- Validación de no-catálogo (referencia) ---');
  const trips = await prisma.travelTrip.count({ where: { companyId } });
  const dest = await prisma.destination.count({ where: { companyId } });
  const geo = await prisma.geoPlace.count({ where: { companyId } });
  const tgp = await prisma.tripGeoPlace.count({ where: { trip: { companyId } } });
  const users = await prisma.user.count({ where: { companyId } });
  const jsonImports = await prisma.travelJsonImportBatch.count({ where: { companyId } });
  console.log({
    TravelTrip_sin_borrar: trips,
    Destination_sin_borrar: dest,
    GeoPlace_sin_borrar: geo,
    TripGeoPlace_sin_borrar: tgp,
    User_sin_borrar: users,
    TravelJsonImportBatch_sin_borrar: jsonImports,
  });

  if (!apply) {
    console.log('\nDRY-RUN: no se ha borrado nada. Usa --apply para ejecutar.');
    return;
  }

  // 1) Runs de recomendación (items/feedback cascaden)
  const delRuns = await prisma.recommendationRun.deleteMany({ where: { companyId } });
  console.log(`\nrecommendationRun.deleteMany → ${delRuns.count}`);

  // 2) Leads → cascade: LeadDetail, activities, notes, agentRuns, Proposal → ProposalVersion → ProposalTrip, ProposalArtifact
  const delLeads = await prisma.lead.deleteMany({ where: { companyId } });
  console.log(`lead.deleteMany → ${delLeads.count}`);

  // 3) Borrar PDFs huérfanos del disco
  let unlinked = 0;
  for (const p of pdfPaths) {
    try {
      const abs = uploadsAbs(p);
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
        unlinked++;
      }
    } catch (e) {
      console.warn('No se pudo borrar PDF:', p, e);
    }
  }
  console.log(`PDFs eliminados del disco: ${unlinked} / ${pdfPaths.length}`);

  console.log('\n--- Post-apply ---');
  console.log({
    leadsRest: await prisma.lead.count({ where: { companyId } }),
    proposalsRest: await prisma.proposal.count({ where: { companyId } }),
    runsRest: await prisma.recommendationRun.count({ where: { companyId } }),
    tripsUnchanged: await prisma.travelTrip.count({ where: { companyId } }),
  });
}

void main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
