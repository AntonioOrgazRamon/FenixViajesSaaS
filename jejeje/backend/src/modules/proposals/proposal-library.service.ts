import type { Prisma, ProposalStatus } from '@prisma/client';
import prisma from '../../infrastructure/db';
import { NotFoundError } from '../../common/errors/AppError';
import { sellerNotificationService } from '../../infrastructure/notifications/seller-notification.service';
import type { PatchProposalHeaderInput } from './proposal.schema';

export type ProposalLibraryMetrics = {
  total: number;
  draft: number;
  generated: number;
  sentToSeller: number;
  sentToClient: number;
  archived: number;
  /** Proxy comercial vía estado del lead */
  leadConverted: number;
  leadLost: number;
  withPdf: number;
  withHtml: number;
  withImagesHint: number;
  estimatedValueSum: number | null;
};

export type ProposalLibraryItem = {
  id: string;
  leadId: string;
  leadName: string | null;
  leadEmail: string | null;
  leadPhone: string | null;
  leadStatus: string;
  title: string;
  status: ProposalStatus;
  version: number;
  estimatedValue: number | null;
  matchState: string | null;
  confidence: number | null;
  destination: string | null;
  tripCount: number;
  hasPdf: boolean;
  hasHtml: boolean;
  hasMedia: boolean;
  createdAt: string;
  generatedAt: string | null;
  sentAt: string | null;
};

export type ProposalLibraryListResponse = {
  metrics: ProposalLibraryMetrics;
  items: ProposalLibraryItem[];
  page: number;
  pageSize: number;
  total: number;
};

function metaFromIntentSnapshot(snapshot: unknown): {
  matchState: string | null;
  confidence: number | null;
  destination: string | null;
} {
  if (!snapshot || typeof snapshot !== 'object') {
    return { matchState: null, confidence: null, destination: null };
  }
  const s = snapshot as {
    search?: { matchState?: string; globalConfidence?: number | null };
    resolvedIntent?: { destination?: string };
  };
  return {
    matchState: s.search?.matchState ?? null,
    confidence:
      s.search?.globalConfidence != null ? Number(s.search.globalConfidence) : null,
    destination: s.resolvedIntent?.destination?.trim() || null,
  };
}

function estimatedFromLeadDetail(d: {
  commercialSnapshot: Prisma.JsonValue | null;
  requirements: Prisma.JsonValue | null;
  travelContext: Prisma.JsonValue | null;
} | null): number | null {
  if (!d) return null;
  const blobs = [d.commercialSnapshot, d.requirements, d.travelContext];
  for (const b of blobs) {
    if (!b || typeof b !== 'object') continue;
    const o = b as Record<string, unknown>;
    const keys = ['estimatedBudget', 'estimatedValue', 'budgetMax', 'budget'];
    for (const k of keys) {
      const v = o[k];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = parseFloat(v.replace(/[^\d.,]/g, '').replace(',', '.'));
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return null;
}

export type ProposalLibraryQuery = {
  page?: number;
  pageSize?: number;
  status?: ProposalStatus;
  preset?: string;
  leadId?: string;
  destination?: string;
  hasPdf?: boolean;
  hasHtml?: boolean;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
};

export class ProposalLibraryService {
  async patchHeader(
    companyId: string,
    proposalId: string,
    input: PatchProposalHeaderInput,
  ): Promise<{ id: string; status: ProposalStatus; assignedUserId: string | null } | null> {
    const existing = await prisma.proposal.findFirst({
      where: { id: proposalId, companyId },
      select: { id: true },
    });
    if (!existing) return null;

    const data: Prisma.ProposalUpdateInput = {};
    if (input.status != null) data.status = input.status;
    if (input.assignedUserId !== undefined) {
      if (input.assignedUserId === null) {
        data.assignedUser = { disconnect: true };
      } else {
        data.assignedUser = { connect: { id: input.assignedUserId } };
      }
    }

    if (Object.keys(data).length === 0) {
      const cur = await prisma.proposal.findFirst({
        where: { id: proposalId, companyId },
        select: { id: true, status: true, assignedUserId: true },
      });
      return cur;
    }

    await prisma.proposal.update({
      where: { id: proposalId, companyId },
      data,
    });
    return prisma.proposal.findFirst({
      where: { id: proposalId, companyId },
      select: { id: true, status: true, assignedUserId: true },
    });
  }

  /**
   * Reenvía el aviso de propuesta lista usando la última versión (audita en LeadActivity).
   */
  async notifySellersAgain(companyId: string, proposalId: string): Promise<{
    recipientKind: string;
    recipientEmails: string[];
  }> {
    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, companyId },
      select: { leadId: true },
    });
    if (!p) throw new NotFoundError('Propuesta no encontrada');

    const latest = await prisma.proposalVersion.findFirst({
      where: { proposalId, companyId },
      orderBy: { versionNumber: 'desc' },
      select: { id: true },
    });
    if (!latest) throw new NotFoundError('La propuesta no tiene versiones');

    const r = await sellerNotificationService.notifyProposalReady({
      companyId,
      leadId: p.leadId,
      proposalId,
      proposalVersionId: latest.id,
    });

    await sellerNotificationService.recordSellerNotifiedActivity({
      companyId,
      leadId: p.leadId,
      proposalVersionId: latest.id,
      recipientKind: r.recipientKind,
      recipientEmails: r.recipientEmails,
      channelResults: r.channelResults,
    });

    return { recipientKind: r.recipientKind, recipientEmails: r.recipientEmails };
  }

  async metrics(companyId: string): Promise<ProposalLibraryMetrics> {
    const [
      total,
      draft,
      generated,
      sentToSeller,
      sentToClient,
      archived,
      leadConverted,
      leadLost,
      withPdf,
      withHtml,
    ] = await Promise.all([
      prisma.proposal.count({ where: { companyId } }),
      prisma.proposal.count({ where: { companyId, status: 'DRAFT' } }),
      prisma.proposal.count({ where: { companyId, status: 'GENERATED' } }),
      prisma.proposal.count({ where: { companyId, status: 'SENT_TO_SELLER' } }),
      prisma.proposal.count({ where: { companyId, status: 'SENT_TO_CLIENT' } }),
      prisma.proposal.count({ where: { companyId, status: 'ARCHIVED' } }),
      prisma.proposal.count({
        where: { companyId, lead: { status: 'CONVERTED' } },
      }),
      prisma.proposal.count({ where: { companyId, lead: { status: 'LOST' } } }),
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT p.id) AS c
        FROM proposals p
        INNER JOIN proposal_versions v ON v.proposal_id = p.id AND v.company_id = p.company_id
        WHERE p.company_id = ${companyId}
          AND v.pdf_storage_path IS NOT NULL
      `,
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT p.id) AS c
        FROM proposals p
        INNER JOIN proposal_versions v ON v.proposal_id = p.id AND v.company_id = p.company_id
        WHERE p.company_id = ${companyId}
          AND v.generated_html IS NOT NULL
          AND LENGTH(v.generated_html) > 40
      `,
    ]);

    const withImagesHintRows = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(DISTINCT p.id) AS c
      FROM proposals p
      INNER JOIN proposal_versions v ON v.proposal_id = p.id AND v.company_id = p.company_id
      WHERE p.company_id = ${companyId}
        AND v.generated_html LIKE '%<img%'
    `;

    return {
      total,
      draft,
      generated,
      sentToSeller,
      sentToClient,
      archived,
      leadConverted,
      leadLost,
      withPdf: Number(withPdf[0]?.c ?? 0n),
      withHtml: Number(withHtml[0]?.c ?? 0n),
      withImagesHint: Number(withImagesHintRows[0]?.c ?? 0n),
      estimatedValueSum: null,
    };
  }

  async list(companyId: string, query: ProposalLibraryQuery): Promise<ProposalLibraryListResponse> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(48, Math.max(1, query.pageSize ?? 24));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProposalWhereInput = { companyId };

    const preset = query.preset?.toLowerCase();
    if (preset === 'draft') where.status = 'DRAFT';
    else if (preset === 'generated') where.status = 'GENERATED';
    else if (preset === 'sent') {
      where.status = { in: ['SENT_TO_SELLER', 'SENT_TO_CLIENT'] };
    } else if (preset === 'accepted') {
      where.lead = { status: 'CONVERTED' };
    } else if (preset === 'rejected') {
      where.lead = { status: 'LOST' };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.leadId?.trim()) {
      where.leadId = query.leadId.trim();
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { lead: { fullName: { contains: q } } },
        { lead: { email: { contains: q } } },
        { lead: { phone: { contains: q } } },
        { id: { equals: q } },
      ];
    }

    const wantsPdf = query.hasPdf === true || preset === 'with_pdf';
    const noPdf = query.hasPdf === false || preset === 'without_pdf';
    const wantsHtml = query.hasHtml === true || preset === 'with_html';
    const noHtml = query.hasHtml === false || preset === 'without_html';

    const andBlocks: Prisma.ProposalWhereInput[] = [];

    if (wantsPdf || wantsHtml) {
      const vAnd: Prisma.ProposalVersionWhereInput[] = [{ companyId }];
      if (wantsPdf) vAnd.push({ pdfStoragePath: { not: null } });
      if (wantsHtml) {
        vAnd.push({ generatedHtml: { not: null }, NOT: { generatedHtml: '' } });
      }
      andBlocks.push({ versions: { some: { AND: vAnd } } });
    }

    if (noPdf) {
      andBlocks.push({
        NOT: { versions: { some: { companyId, pdfStoragePath: { not: null } } } },
      });
    }

    if (noHtml) {
      andBlocks.push({
        NOT: {
          versions: {
            some: {
              companyId,
              generatedHtml: { not: null },
              NOT: { generatedHtml: '' },
            },
          },
        },
      });
    }

    if (query.destination?.trim()) {
      const d = query.destination.trim();
      andBlocks.push({
        versions: {
          some: {
            companyId,
            trips: {
              some: {
                travelTrip: {
                  OR: [{ mainDestination: { contains: d } }, { title: { contains: d } }],
                },
              },
            },
          },
        },
      });
    }

    if (andBlocks.length) {
      const prev = where.AND;
      const prevArr = Array.isArray(prev) ? prev : prev ? [prev] : [];
      where.AND = [...prevArr, ...andBlocks];
    }

    const [rows, total, metrics] = await Promise.all([
      prisma.proposal.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          lead: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              status: true,
              details: {
                select: { commercialSnapshot: true, requirements: true, travelContext: true },
              },
            },
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              trips: {
                include: {
                  travelTrip: {
                    select: { title: true, mainDestination: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.proposal.count({ where }),
      this.metrics(companyId),
    ]);

    const items: ProposalLibraryItem[] = rows.map((p) => {
      const lv = p.versions[0];
      const meta = metaFromIntentSnapshot(lv?.intentSnapshot);
      const tripCount = lv?.trips.length ?? 0;
      const firstTripDest =
        lv?.trips[0]?.travelTrip.mainDestination ?? lv?.trips[0]?.travelTrip.title ?? null;
      const dest = meta.destination ?? firstTripDest;
      const html = lv?.generatedHtml ?? '';
      const hasPdf = Boolean(lv?.pdfStoragePath?.trim());
      const hasHtml = html.length > 40;
      const hasMedia = hasHtml && html.toLowerCase().includes('<img');

      let sentAt: string | null = null;
      if (p.status === 'SENT_TO_SELLER' || p.status === 'SENT_TO_CLIENT') {
        sentAt = lv?.createdAt.toISOString() ?? p.updatedAt.toISOString();
      }

      const title =
        (p.lead.fullName ? `${p.lead.fullName} · Propuesta` : `Propuesta ${p.id.slice(0, 8)}`) +
        (lv ? ` · v${lv.versionNumber}` : '');

      return {
        id: p.id,
        leadId: p.leadId,
        leadName: p.lead.fullName,
        leadEmail: p.lead.email,
        leadPhone: p.lead.phone,
        leadStatus: p.lead.status,
        title,
        status: p.status,
        version: lv?.versionNumber ?? 0,
        estimatedValue: estimatedFromLeadDetail(p.lead.details),
        matchState: meta.matchState,
        confidence: meta.confidence,
        destination: dest,
        tripCount,
        hasPdf,
        hasHtml,
        hasMedia,
        createdAt: p.createdAt.toISOString(),
        generatedAt: lv?.createdAt.toISOString() ?? null,
        sentAt,
      };
    });

    return { metrics, items, page, pageSize, total };
  }

  async detail(companyId: string, proposalId: string) {
    const p = await prisma.proposal.findFirst({
      where: { id: proposalId, companyId },
      include: {
        lead: {
          include: {
            details: true,
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
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
    if (!p) return null;

    const activities = await prisma.leadActivity.findMany({
      where: {
        companyId,
        leadId: p.leadId,
        activityType: {
          in: ['PROPOSAL_GENERATED', 'SELLER_NOTIFIED', 'STATUS_CHANGED', 'UPDATED'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        activityType: true,
        title: true,
        description: true,
        metadata: true,
        createdAt: true,
        actorUserId: true,
      },
    });

    const latest = p.versions[0];
    const meta = metaFromIntentSnapshot(latest?.intentSnapshot);

    return {
      proposal: {
        id: p.id,
        companyId: p.companyId,
        leadId: p.leadId,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      },
      lead: {
        id: p.lead.id,
        fullName: p.lead.fullName,
        email: p.lead.email,
        phone: p.lead.phone,
        status: p.lead.status,
        country: p.lead.country,
        details: p.lead.details,
      },
      latestVersion: latest
        ? {
            id: latest.id,
            versionNumber: latest.versionNumber,
            createdAt: latest.createdAt.toISOString(),
            pdfStoragePath: latest.pdfStoragePath,
            pdfPublicUrl: latest.pdfPublicUrl,
            generatedHtml: latest.generatedHtml,
            intentSnapshot: latest.intentSnapshot,
            matchState: meta.matchState,
            confidence: meta.confidence,
            destination: meta.destination,
            trips: latest.trips.map((t) => ({
              id: t.travelTrip.id,
              title: t.travelTrip.title,
              mainDestination: t.travelTrip.mainDestination,
              durationDays: t.travelTrip.durationDays,
              indicativePrice:
                t.travelTrip.indicativePrice != null
                  ? t.travelTrip.indicativePrice.toString()
                  : null,
              currency: t.travelTrip.currency,
              score: t.score,
              reasons: t.reasons,
            })),
            artifacts: latest.artifacts,
          }
        : null,
      versionHistory: p.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        createdAt: v.createdAt.toISOString(),
        hasPdf: Boolean(v.pdfStoragePath),
        hasHtml: Boolean(v.generatedHtml && v.generatedHtml.length > 40),
      })),
      activities,
    };
  }
}
