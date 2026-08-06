import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  LeadActorType,
  LeadActivityType,
  Prisma,
  ProposalArtifactKind,
  ProposalStatus,
} from '@prisma/client';
import prisma from '../../infrastructure/db';
import { NotFoundError } from '../../common/errors/AppError';
import { config } from '../../common/config';
import { logger } from '../../common/logger';
import { buildLeadIntentSnapshots } from '../../services/travel/lead-intent-snapshots';
import { ProposalGenerationService } from '../../services/proposals/proposal-generation.service';
import { finalizeProposalVersionGeneration } from '../../services/proposals/proposal-version-finalize.service';
import { serializeLeadTravelProfile } from '../leads/lead.service';
import type { GenerateProposalBody } from './proposal.schema';
import type { TravelSearchResponse } from '../../services/travel/travel-search.schema';

const generationSvc = new ProposalGenerationService();

function uploadsAbs(...segments: string[]) {
  return path.join(process.cwd(), 'uploads', ...segments);
}

function buildIntentSnapshotRecord(params: {
  bodySnapshot: unknown | undefined;
  detailsTravel: unknown;
  detailsCurrent: unknown;
  normalizedTravel: unknown;
  leadTravelProfile: unknown;
  resolvedIntent: unknown;
  search: TravelSearchResponse;
}): Prisma.InputJsonValue {
  const rankedLite = params.search.ranked.slice(0, 20).map((r) => ({
    tripId: r.tripId,
    score: r.score,
    matchState: r.matchState,
    confidence: r.confidence,
    matches: r.matches,
    misses: r.misses,
    commercialAngle: r.commercialAngle,
    contributions: r.contributions?.slice(0, 12),
  }));

  return {
    sources: {
      bodyIntentSnapshot: params.bodySnapshot ?? null,
      leadTravelContext: params.detailsTravel ?? null,
      leadCurrentContext: params.detailsCurrent ?? null,
      leadNormalizedTravel: params.normalizedTravel ?? null,
      leadTravelProfile: params.leadTravelProfile ?? null,
    },
    resolvedIntent: params.resolvedIntent,
    search: {
      schemaVersion: params.search.schemaVersion,
      matchState: params.search.matchState,
      scoringModelVersion: params.search.scoringModelVersion,
      recommendationRunId: params.search.recommendationRunId ?? null,
      totalCandidates: params.search.totalCandidates,
      picks: {
        recommendedTripId: params.search.picks.recommended?.tripId ?? null,
        budgetTripId: params.search.picks.budget?.tripId ?? null,
        luxuryTripId: params.search.picks.luxury?.tripId ?? null,
        alternativeTripId: params.search.picks.alternative?.tripId ?? null,
      },
      rankedPreview: rankedLite,
    },
    generatorVersion: 'proposal-gen-v2',
  } as Prisma.InputJsonValue;
}

export class ProposalService {
  async getById(companyId: string, proposalId: string) {
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, companyId },
      include: {
        lead: { select: { id: true, fullName: true, email: true, status: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            trips: {
              orderBy: { orderIndex: 'asc' },
              include: {
                travelTrip: {
                  select: {
                    id: true,
                    title: true,
                    mainDestination: true,
                    durationDays: true,
                    indicativePrice: true,
                    currency: true,
                    status: true,
                  },
                },
              },
            },
            artifacts: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });
    if (!proposal) throw new NotFoundError('Propuesta no encontrada');
    return proposal;
  }

  async resolvePdfStoragePath(companyId: string, proposalId: string): Promise<string | null> {
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, companyId },
      select: { id: true },
    });
    if (!proposal) throw new NotFoundError('Propuesta no encontrada');

    const v = await prisma.proposalVersion.findFirst({
      where: { proposalId: proposal.id, companyId },
      orderBy: { versionNumber: 'desc' },
      select: { pdfStoragePath: true },
    });
    return v?.pdfStoragePath ?? null;
  }

  async generateForLead(
    companyId: string,
    leadId: string,
    userId: string,
    body: GenerateProposalBody,
  ) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, companyId, deletedAt: null },
      include: { details: true, travelProfile: true },
    });
    if (!lead) throw new NotFoundError('Lead no encontrado');

    const company = await prisma.company.findFirst({
      where: { id: companyId },
      select: { id: true, name: true, slug: true },
    });
    if (!company) throw new NotFoundError('Empresa no encontrada');

    const normalizedRoot =
      lead.normalizedPayload && typeof lead.normalizedPayload === 'object' && !Array.isArray(lead.normalizedPayload)
        ? (lead.normalizedPayload as Record<string, unknown>)
        : null;
    const normalizedTravel = normalizedRoot?.travel ?? null;

    const intentSnapshots = buildLeadIntentSnapshots(lead, body.intentSnapshot ?? undefined);

    const useAiCopy = Boolean(body.useAiCopy !== false && config.OPENAI_API_KEY?.trim());

    const gen = await generationSvc.generate({
      lead,
      company: { name: company.name, slug: company.slug },
      intentSnapshots,
      explicitTrips: body.trips,
      useAiCopy,
      recommendationPersistUserId: userId,
    });

    const intentRecord = buildIntentSnapshotRecord({
      bodySnapshot: body.intentSnapshot,
      detailsTravel: lead.details?.travelContext ?? null,
      detailsCurrent: lead.details?.currentContext ?? null,
      normalizedTravel,
      leadTravelProfile: lead.travelProfile ? serializeLeadTravelProfile(lead.travelProfile) : null,
      resolvedIntent: gen.intent,
      search: gen.search,
    });

    let proposal = await prisma.proposal.findFirst({
      where: { companyId, leadId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!proposal) {
      proposal = await prisma.proposal.create({
        data: {
          companyId,
          leadId,
          createdByUserId: userId,
          assignedUserId: lead.assignedUserId ?? undefined,
          status: ProposalStatus.DRAFT,
        },
      });
    }

    const nextVersion =
      (await prisma.proposalVersion
        .aggregate({
          where: { proposalId: proposal.id },
          _max: { versionNumber: true },
        })
        .then((a) => a._max.versionNumber ?? 0)) + 1;

    const rec = gen.search.picks.recommended!;
    const budget = gen.search.picks.budget ?? rec;
    const luxury = gen.search.picks.luxury ?? rec;
    const alternative = gen.search.picks.alternative ?? budget;

    const slotRows: { tripId: string; item: (typeof gen.search.ranked)[number] }[] = [
      { tripId: rec.tripId, item: rec },
      { tripId: budget.tripId, item: budget },
      { tripId: luxury.tripId, item: luxury },
      { tripId: alternative.tripId, item: alternative },
    ];

    const seenTrip = new Set<string>();
    const tripsForDb: Omit<Prisma.ProposalTripCreateManyInput, 'proposalVersionId'>[] = [];
    let orderIndex = 0;
    for (const row of slotRows) {
      if (seenTrip.has(row.tripId)) continue;
      seenTrip.add(row.tripId);
      tripsForDb.push({
        companyId,
        travelTripId: row.tripId,
        orderIndex,
        score: row.item.score,
        reasons: {
          matches: row.item.matches,
          misses: row.item.misses,
          reasons: row.item.reasons,
          commercialAngle: row.item.commercialAngle,
          matchState: row.item.matchState,
          confidence: row.item.confidence,
          contributions: row.item.contributions,
        } as Prisma.InputJsonValue,
      });
      orderIndex += 1;
    }

    const pdfKey = uuidv4();
    const relativePdfPath =
      gen.pdfBuffer != null ? path.join('proposals', companyId, `${pdfKey}.pdf`) : null;

    const { versionId } = await prisma.$transaction(async (tx) => {
      const normalizedRelPath = relativePdfPath ? relativePdfPath.replace(/\\/g, '/') : null;

      const version = await tx.proposalVersion.create({
        data: {
          companyId,
          proposalId: proposal!.id,
          versionNumber: nextVersion,
          intentSnapshot: intentRecord,
          generatedHtml: gen.html,
          pdfStoragePath: normalizedRelPath,
          pdfPublicUrl:
            normalizedRelPath != null
              ? `${config.PUBLIC_URL.replace(/\/$/, '')}/uploads/${normalizedRelPath}`
              : null,
          createdByUserId: userId,
        },
      });

      await tx.proposalTrip.createMany({
        data: tripsForDb.map((t) => ({
          ...t,
          proposalVersionId: version.id,
        })),
      });

      if (normalizedRelPath && gen.pdfBuffer) {
        const absPdf = uploadsAbs(normalizedRelPath);
        await fs.mkdir(path.dirname(absPdf), { recursive: true });
        await fs.writeFile(absPdf, gen.pdfBuffer);

        await tx.proposalArtifact.create({
          data: {
            companyId,
            proposalVersionId: version.id,
            kind: ProposalArtifactKind.PDF,
            storagePath: normalizedRelPath,
            publicUrl: `${config.PUBLIC_URL.replace(/\/$/, '')}/uploads/${normalizedRelPath}`,
            mimeType: 'application/pdf',
            fileSize: gen.pdfBuffer.length,
            metadata: { filename: path.basename(normalizedRelPath) } as Prisma.InputJsonValue,
          },
        });
      }

      await tx.proposal.update({
        where: { id: proposal!.id },
        data: { status: ProposalStatus.GENERATED },
      });

      await tx.leadActivity.create({
        data: {
          companyId,
          leadId,
          actorUserId: userId,
          actorType: LeadActorType.USER,
          activityType: LeadActivityType.EXTERNAL_EVENT,
          title: 'Propuesta comercial generada',
          description: `Versión ${nextVersion} · PDF ${normalizedRelPath ? 'generado' : 'no disponible (revisar entorno PDF)'}`,
          metadata: {
            kind: 'travel_proposal_generated',
            proposalId: proposal!.id,
            proposalVersionId: version.id,
            versionNumber: nextVersion,
            tripIds: [...seenTrip],
          } as Prisma.InputJsonValue,
        },
      });

      return { versionId: version.id };
    });

    void finalizeProposalVersionGeneration({
      companyId,
      leadId,
      proposalId: proposal!.id,
      proposalVersionId: versionId,
      actorUserId: userId,
    }).catch((err) =>
      logger.error(
        { err, companyId, leadId, proposalId: proposal!.id, versionId },
        'Finalización/notificación tras generar propuesta',
      ),
    );

    return this.getById(companyId, proposal!.id);
  }
}
