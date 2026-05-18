import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import {
  Lead,
  LeadDetail,
  LeadActorType,
  LeadActivityType,
  Prisma,
  ProposalStatus,
} from '@prisma/client';
import prisma from '../../infrastructure/db';
import { NotFoundError, ValidationError } from '../../common/errors/AppError';
import { logger } from '../../common/logger';
import { ProposalGenerationService } from '../../services/proposals/proposal-generation.service';
import { TravelSearchService } from '../../services/travel/travel-search.service';
import { buildTravelSearchIntentFromSnapshots } from '../../services/travel/proposal-intent.mapper';
import type { TravelSearchResultItem } from '../../services/travel/travel-search.schema';

const proposalGenerationHost = new ProposalGenerationService();

/** Payload guardado en `ProposalVersion.intentSnapshot` + expuesto al cliente. */
export type SmartProposalAnalysisDto = {
  intention: {
    summary: string;
    confidence: number;
    signals: string[];
  };
  missingData: string[];
  overallScore: number;
  matches: string[];
  misses: string[];
  talkTrack: string;
  recommendedTrips: Array<{
    id: string;
    tier: 'recommended' | 'economic' | 'premium';
    title: string;
    mainDestination: string | null;
    durationDays: number | null;
    indicativePrice: number | null;
    currency: string | null;
    matchScore: number;
    highlights: string[];
  }>;
};

export type SmartProposalStateDto = {
  phase: 'none' | 'ready' | 'error';
  proposalId: string | null;
  proposalStatus: ProposalStatus | null;
  versionNumber: number | null;
  updatedAt: string | null;
  vendorNotified: boolean;
  vendorNotifiedAt: string | null;
  lastError: string | null;
  analysis: SmartProposalAnalysisDto;
  htmlAvailable: boolean;
  pdfAvailable: boolean;
};

type TripPick = {
  id: string;
  title: string;
  mainDestination: string | null;
  durationDays: number | null;
  indicativePrice: Prisma.Decimal | null;
  currency: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readSmartMeta(extraData: unknown): {
  vendorNotified: boolean;
  vendorNotifiedAt: string | null;
  lastError: string | null;
} {
  if (!extraData || typeof extraData !== 'object' || Array.isArray(extraData)) {
    return { vendorNotified: false, vendorNotifiedAt: null, lastError: null };
  }
  const root = extraData as Record<string, unknown>;
  const sp = root.smartProposal;
  if (!sp || typeof sp !== 'object' || Array.isArray(sp)) {
    return { vendorNotified: false, vendorNotifiedAt: null, lastError: null };
  }
  const m = sp as Record<string, unknown>;
  return {
    vendorNotified: !!m.vendorNotified,
    vendorNotifiedAt: typeof m.vendorNotifiedAt === 'string' ? m.vendorNotifiedAt : null,
    lastError: typeof m.lastError === 'string' ? m.lastError : null,
  };
}

function getDestinationFromLead(lead: Lead & { details: LeadDetail | null }): string | null {
  const np = lead.normalizedPayload as { travel?: { destination?: string } } | null;
  const tc = lead.details?.travelContext as { destination?: string } | null | undefined;
  const ctx = lead.details?.currentContext as { destination?: string } | null | undefined;
  const d =
    np?.travel?.destination ??
    tc?.destination ??
    ctx?.destination ??
    (typeof lead.message === 'string' && lead.message.length < 200 ? null : null);
  if (d && typeof d === 'string' && d.trim()) return d.trim();
  if (lead.message && lead.message.length <= 160) {
    const m = lead.message.trim();
    if (m.length > 3) return m.slice(0, 120);
  }
  return tc?.destination?.trim() ?? ctx?.destination?.trim() ?? null;
}

function getTravelDateHint(lead: Lead & { details: LeadDetail | null }): string | null {
  const np = lead.normalizedPayload as { travel?: { travelDate?: string } } | null;
  const tc = lead.details?.travelContext as { travelDate?: string } | null | undefined;
  const ctx = lead.details?.currentContext as { travelDate?: string } | null | undefined;
  const t = np?.travel?.travelDate ?? tc?.travelDate ?? ctx?.travelDate;
  return typeof t === 'string' && t ? t : null;
}

function getSeatsHint(lead: Lead & { details: LeadDetail | null }): number | null {
  const np = lead.normalizedPayload as { travel?: { seats?: number } } | null;
  const tc = lead.details?.travelContext as { seats?: number } | null | undefined;
  const ctx = lead.details?.currentContext as { seats?: number } | null | undefined;
  const s = np?.travel?.seats ?? tc?.seats ?? ctx?.seats;
  return typeof s === 'number' && s > 0 ? s : null;
}

/**
 * Smart proposal: enriquece metadatos de viajes (títulos/precio) para el DTO.
 * El ranking y los slots provienen del motor `runTravelRecommendation` (mismo que búsqueda por intención).
 */
async function enrichTripMeta(
  companyId: string,
  ids: string[],
  fallback: TripPick[],
): Promise<Map<string, TripPick>> {
  const m = new Map<string, TripPick>();
  for (const t of fallback) m.set(t.id, t);
  const missing = ids.filter((id) => id && !m.has(id));
  if (!missing.length) return m;
  const rows = await prisma.travelTrip.findMany({
    where: { id: { in: missing }, companyId },
    select: {
      id: true,
      title: true,
      mainDestination: true,
      durationDays: true,
      indicativePrice: true,
      currency: true,
    },
  });
  for (const t of rows) m.set(t.id, t);
  return m;
}

async function buildAnalysis(
  companyId: string,
  lead: Lead & { details: LeadDetail | null },
  trips: TripPick[],
): Promise<SmartProposalAnalysisDto> {
  const dest = getDestinationFromLead(lead);
  const travelDate = getTravelDateHint(lead);
  const seats = getSeatsHint(lead);

  const missingData: string[] = [];
  if (!lead.email) missingData.push('Email de contacto');
  if (!lead.phone) missingData.push('Teléfono');
  if (!travelDate) missingData.push('Fecha o mes del viaje');
  if (!seats) missingData.push('Número de viajeros');
  if (!dest) missingData.push('Destino concreto');

  const signals: string[] = [];
  if (dest) signals.push(`Destino detectado: ${dest}`);
  if (travelDate) signals.push('Fecha o referencia temporal en el lead');
  if (lead.message?.trim()) signals.push('Mensaje libre disponible para matizar');
  if (seats) signals.push(`${seats} plaza(s) indicadas`);

  const intentionSummary = dest
    ? `Interés activo en viaje a ${dest}`
    : 'Consulta de viaje / destino a concretar';

  const confidence = Math.min(
    0.92,
    0.35 + (dest ? 0.25 : 0) + (travelDate ? 0.18 : 0) + (seats ? 0.12 : 0) + (lead.message ? 0.1 : 0),
  );

  const snapshots: unknown[] = [];
  if (
    lead.normalizedPayload &&
    typeof lead.normalizedPayload === 'object' &&
    !Array.isArray(lead.normalizedPayload)
  ) {
    snapshots.push(lead.normalizedPayload);
  }
  if (lead.details?.travelContext && typeof lead.details.travelContext === 'object') {
    snapshots.push(lead.details.travelContext);
  }
  if (lead.details?.currentContext && typeof lead.details.currentContext === 'object') {
    snapshots.push(lead.details.currentContext);
  }
  if (lead.message?.trim()) {
    snapshots.push({ message: lead.message });
  }

  const intent = buildTravelSearchIntentFromSnapshots(snapshots);
  const response = await new TravelSearchService().searchByIntent(companyId, intent);

  const recItem: TravelSearchResultItem | null =
    response.picks.recommended ?? response.ranked[0] ?? null;
  const econItem = response.picks.budget;
  const premItem = response.picks.luxury;

  const needIds = [recItem?.tripId, econItem?.tripId, premItem?.tripId].filter(
    (x): x is string => Boolean(x),
  );
  const metaById = await enrichTripMeta(companyId, needIds, trips);

  function dtoFromSlot(
    tier: 'recommended' | 'economic' | 'premium',
    item: TravelSearchResultItem | null | undefined,
  ): SmartProposalAnalysisDto['recommendedTrips'][0] | null {
    if (!item) return null;
    const row = metaById.get(item.tripId);
    if (!row) return null;
    const highlights = [...item.matches, ...item.reasons].slice(0, 8);
    return {
      id: item.tripId,
      tier,
      title: row.title,
      mainDestination: row.mainDestination,
      durationDays: row.durationDays,
      indicativePrice: row.indicativePrice != null ? Number(row.indicativePrice) : null,
      currency: row.currency,
      matchScore: item.score,
      highlights,
    };
  }

  const recommended = dtoFromSlot('recommended', recItem);
  const economic = dtoFromSlot('economic', econItem);
  const premium = dtoFromSlot('premium', premItem);

  const byId = new Map<string, SmartProposalAnalysisDto['recommendedTrips'][0]>();
  const pushTier = (
    tier: 'recommended' | 'economic' | 'premium',
    row: SmartProposalAnalysisDto['recommendedTrips'][0] | null,
  ) => {
    if (!row) return;
    const prev = byId.get(row.id);
    if (!prev || tier === 'recommended') {
      byId.set(row.id, row);
    }
  };
  pushTier('recommended', recommended);
  pushTier('economic', economic);
  pushTier('premium', premium);

  const recommendedTrips: SmartProposalAnalysisDto['recommendedTrips'] = [];
  if (recommended) recommendedTrips.push(byId.get(recommended.id)!);
  if (economic && economic.id !== recommended?.id) recommendedTrips.push({ ...byId.get(economic.id)!, tier: 'economic' });
  if (premium && premium.id !== recommended?.id && premium.id !== economic?.id) {
    recommendedTrips.push({ ...byId.get(premium.id)!, tier: 'premium' });
  }
  // Garantizar etiquetas economic/premium aunque colapsen en pocas filas
  const ensured = recommendedTrips.slice();
  if (economic && !ensured.some((x) => x.tier === 'economic')) {
    ensured.push({ ...economic, tier: 'economic' });
  }
  if (premium && !ensured.some((x) => x.tier === 'premium')) {
    ensured.push({ ...premium, tier: 'premium' });
  }

  const catCount = response.totalCandidates;
  const matches: string[] = [];
  const misses: string[] = [];
  if (dest) matches.push('Hay una petición de destino o temática localizable');
  else misses.push('Sin destino explícito: necesitas anclar la conversación');
  if (travelDate) matches.push('Referencia de fechas presente');
  else misses.push('Confirmar fechas y flexibilidad');
  if (catCount >= 3) matches.push('Catálogo con volumen suficiente para 3 hipótesis');
  else misses.push('Pocas opciones en catálogo: matizar expectativa al cliente');
  if (lead.email && lead.phone) matches.push('Canales de contacto cubiertos');
  if (missingData.length) misses.push(`${missingData.length} dato(s) comercial(s) pendientes de cerrar`);

  const name =
    lead.fullName?.trim() ||
    [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() ||
    'cliente';

  const destPhrase = dest ?? 'su próximo viaje';
  const econ = economic?.title ?? recommended?.title ?? 'la opción más económica';
  const rec = recommended?.title ?? 'la propuesta central';
  const prem = premium?.title ?? recommended?.title ?? 'la alternativa premium';

  const talkTrack =
    `Hola ${name}, te llamo por ${destPhrase}. ` +
    `Te dejo tres lecturas rápidas: una opción muy ajustada (${econ}), ` +
    `la que mejor encaja con lo que pediste (${rec}), y una propuesta premium (${prem}). ` +
    `¿Te encajan 2 minutos para cerrar fechas, flexibilidad y presupuesto orientativo?`;

  const overallScore = recommended ? Math.round(recommended.matchScore - missingData.length * 6) : 0;

  return {
    intention: {
      summary: intentionSummary,
      confidence: Math.round(confidence * 100) / 100,
      signals,
    },
    missingData,
    overallScore: Math.max(0, Math.min(100, overallScore)),
    matches,
    misses,
    talkTrack,
    recommendedTrips: ensured.length ? ensured : recommendedTrips,
  };
}

function buildHtmlProposal(lead: Lead, analysis: SmartProposalAnalysisDto): string {
  const tripsRows = analysis.recommendedTrips
    .map(
      (t) =>
        `<tr><td>${escapeHtml(t.tier)}</td><td>${escapeHtml(t.title)}</td><td>${escapeHtml(
          t.mainDestination ?? '—',
        )}</td><td>${t.durationDays ?? '—'}</td><td>${t.indicativePrice != null ? escapeHtml(String(t.indicativePrice)) + ' ' + escapeHtml(t.currency ?? '') : '—'}</td><td>${t.matchScore}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Propuesta</title>
<style>
body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0c0c0f;color:#e4e4e7;padding:24px;}
h1{font-size:20px;color:#fbbf24;}
.box{border:1px solid #27272a;border-radius:12px;padding:16px;margin:16px 0;background:#18181b;}
table{width:100%;border-collapse:collapse;font-size:14px;}
th,td{border-bottom:1px solid #27272a;padding:8px;text-align:left;}
.small{color:#a1a1aa;font-size:13px;}
</style></head><body>
<h1>Propuesta comercial</h1>
<p class="small">Lead: ${escapeHtml(lead.fullName ?? lead.email ?? lead.id)}</p>
<div class="box"><strong>Intención detectada</strong><p>${escapeHtml(analysis.intention.summary)}</p></div>
<div class="box"><strong>Qué decir en la llamada</strong><p>${escapeHtml(analysis.talkTrack)}</p></div>
<div class="box"><strong>Viajes sugeridos</strong>
<table><thead><tr><th>Perfil</th><th>Viaje</th><th>Destino</th><th>Días</th><th>Precio</th><th>Score</th></tr></thead><tbody>${tripsRows}</tbody></table>
</div>
<p class="small">Documento generado automáticamente · revisar antes de enviar al cliente final.</p>
</body></html>`;
}

async function writePdfFile(absPath: string, lead: Lead, analysis: SmartProposalAnalysisDto): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = createWriteStream(absPath);
    doc.pipe(stream);
    doc.fontSize(18).fillColor('#b45309').text('Propuesta comercial', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).fillColor('#52525b').text(`Lead: ${lead.fullName ?? lead.email ?? lead.id}`, {
      align: 'center',
    });
    doc.moveDown(1.5);
    doc.fillColor('#18181b').fontSize(12).text('Intención detectada', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#27272a').text(analysis.intention.summary, { align: 'left' });
    doc.moveDown();
    doc.fillColor('#18181b').fontSize(12).text('Guion sugerido (llamada)', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#27272a').text(analysis.talkTrack, { align: 'left' });
    doc.moveDown();
    doc.fillColor('#18181b').fontSize(12).text('Opciones propuestas', { underline: true });
    doc.moveDown(0.5);
    analysis.recommendedTrips.forEach((t, i) => {
      doc
        .fontSize(10)
        .fillColor('#27272a')
        .text(
          `${i + 1}. [${t.tier}] ${t.title} — ${t.mainDestination ?? '—'} · ${t.durationDays ?? '—'} d · score ${t.matchScore}` +
            (t.indicativePrice != null ? ` · desde ${t.indicativePrice} ${t.currency ?? ''}` : ''),
        );
    });
    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}

async function loadApprovedTrips(companyId: string, role: string): Promise<TripPick[]> {
  const where: Prisma.TravelTripWhereInput = {
    companyId,
    status: 'APPROVED',
  };
  return prisma.travelTrip.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: role === 'COMPANY_ADMIN' ? 80 : 80,
    select: {
      id: true,
      title: true,
      mainDestination: true,
      durationDays: true,
      indicativePrice: true,
      currency: true,
    },
  });
}

async function ensureLeadWithDetails(
  companyId: string,
  leadId: string,
): Promise<Lead & { details: LeadDetail | null }> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId, deletedAt: null },
    include: { details: true },
  });
  if (!lead) throw new NotFoundError('Lead no encontrado');
  return lead;
}

async function mergeSmartProposalMeta(
  companyId: string,
  leadId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, companyId, deletedAt: null },
    include: { details: true },
  });
  if (!lead) throw new NotFoundError('Lead no encontrado');

  const prevExtra =
    lead.details?.extraData &&
    typeof lead.details.extraData === 'object' &&
    !Array.isArray(lead.details.extraData)
      ? { ...(lead.details.extraData as Record<string, unknown>) }
      : {};
  const prevSp =
    prevExtra.smartProposal &&
    typeof prevExtra.smartProposal === 'object' &&
    !Array.isArray(prevExtra.smartProposal)
      ? { ...(prevExtra.smartProposal as Record<string, unknown>) }
      : {};
  const nextExtra = {
    ...prevExtra,
    smartProposal: { ...prevSp, ...patch },
  } as Prisma.InputJsonValue;

  if (lead.details) {
    await prisma.leadDetail.update({
      where: { leadId },
      data: { extraData: nextExtra },
    });
  } else {
    await prisma.leadDetail.create({
      data: {
        id: uuidv4(),
        leadId,
        companyId,
        extraData: nextExtra,
      },
    });
  }
}

export class SmartProposalService {
  private pdfAbsolutePath(companyId: string, versionId: string): string {
    return path.join(process.cwd(), 'uploads', 'proposals', companyId, `${versionId}.pdf`);
  }

  private pdfRelativeStoragePath(companyId: string, versionId: string): string {
    return path.posix.join('uploads', 'proposals', companyId, `${versionId}.pdf`);
  }

  async getState(companyId: string, leadId: string, role: string): Promise<SmartProposalStateDto> {
    const lead = await ensureLeadWithDetails(companyId, leadId);
    const trips = await loadApprovedTrips(companyId, role);
    const meta = readSmartMeta(lead.details?.extraData);

    const proposal = await prisma.proposal.findFirst({
      where: { companyId, leadId },
      orderBy: { createdAt: 'desc' },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    const latest = proposal?.versions[0];
    const analysisFromSnapshot =
      latest?.intentSnapshot &&
      typeof latest.intentSnapshot === 'object' &&
      !Array.isArray(latest.intentSnapshot)
        ? (latest.intentSnapshot as unknown as SmartProposalAnalysisDto)
        : null;

    const hasVersion = !!latest?.generatedHtml;
    const phase: SmartProposalStateDto['phase'] = hasVersion
      ? 'ready'
      : meta.lastError
        ? 'error'
        : 'none';

    // Evita ejecutar `runTravelRecommendation` en cada lectura de estado cuando ya hay
    // versión persistida: el análisis mostrado sigue siendo el mismo que `intentSnapshot`.
    const analysis =
      hasVersion && analysisFromSnapshot
        ? analysisFromSnapshot
        : await buildAnalysis(companyId, lead, trips);

    let pdfAvailable = false;
    if (latest?.pdfStoragePath) {
      const abs = path.isAbsolute(latest.pdfStoragePath)
        ? latest.pdfStoragePath
        : path.join(process.cwd(), latest.pdfStoragePath);
      try {
        await fs.access(abs);
        pdfAvailable = true;
      } catch {
        pdfAvailable = false;
      }
    }

    return {
      phase,
      proposalId: proposal?.id ?? null,
      proposalStatus: proposal?.status ?? null,
      versionNumber: latest?.versionNumber ?? null,
      updatedAt: latest?.createdAt?.toISOString() ?? proposal?.updatedAt?.toISOString() ?? null,
      vendorNotified: meta.vendorNotified,
      vendorNotifiedAt: meta.vendorNotifiedAt,
      lastError: meta.lastError,
      analysis,
      htmlAvailable: !!latest?.generatedHtml,
      pdfAvailable,
    };
  }

  async getHtml(companyId: string, leadId: string): Promise<string> {
    await ensureLeadWithDetails(companyId, leadId);
    const proposal = await prisma.proposal.findFirst({
      where: { companyId, leadId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    const html = proposal?.versions[0]?.generatedHtml;
    if (!html) throw new NotFoundError('Aún no hay propuesta generada');
    return html;
  }

  async resolvePdfAbsolutePath(companyId: string, leadId: string): Promise<string | null> {
    await ensureLeadWithDetails(companyId, leadId);
    const proposal = await prisma.proposal.findFirst({
      where: { companyId, leadId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    const rel = proposal?.versions[0]?.pdfStoragePath;
    if (!rel) return null;
    const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    try {
      await fs.access(abs);
      return abs;
    } catch {
      return null;
    }
  }

  async generate(companyId: string, leadId: string, userId: string, role: string): Promise<SmartProposalStateDto> {
    const lead = await ensureLeadWithDetails(companyId, leadId);
    const trips = await loadApprovedTrips(companyId, role);
    if (!trips.length) {
      await mergeSmartProposalMeta(companyId, leadId, {
        lastError: 'No hay viajes aprobados en catálogo. Alta o revisión en Travel.',
      });
      throw new ValidationError('No hay viajes aprobados en catálogo');
    }

    const existing = await prisma.proposal.findFirst({
      where: { companyId, leadId },
      include: { versions: { select: { id: true }, take: 1 } },
    });
    if (existing && existing.versions.length > 0) {
      throw new ValidationError('Ya existe una propuesta. Usa «Regenerar» para una nueva versión.');
    }

    const analysis = await buildAnalysis(companyId, lead, trips);
    const html = buildHtmlProposal(lead, analysis);
    const versionId = uuidv4();
    const pdfRel = this.pdfRelativeStoragePath(companyId, versionId);
    const pdfAbs = this.pdfAbsolutePath(companyId, versionId);

    await writePdfFile(pdfAbs, lead, analysis);

    await prisma.$transaction(async (tx) => {
      let proposalId: string;
      if (!existing) {
        const created = await tx.proposal.create({
          data: {
            id: uuidv4(),
            companyId,
            leadId,
            createdByUserId: userId,
            status: 'GENERATED',
          },
        });
        proposalId = created.id;
      } else {
        proposalId = existing.id;
        await tx.proposal.update({
          where: { id: existing.id },
          data: { status: 'GENERATED' },
        });
      }

      await tx.proposalVersion.create({
        data: {
          id: versionId,
          companyId,
          proposalId,
          versionNumber: 1,
          intentSnapshot: analysis as unknown as Prisma.InputJsonValue,
          generatedHtml: html,
          pdfStoragePath: pdfRel,
          createdByUserId: userId,
        },
      });

      const tripIds = [...new Set(analysis.recommendedTrips.map((t) => t.id))];
      let orderIndex = 0;
      for (const tid of tripIds) {
        const row = analysis.recommendedTrips.find((r) => r.id === tid);
        await tx.proposalTrip.create({
          data: {
            id: uuidv4(),
            companyId,
            proposalVersionId: versionId,
            travelTripId: tid,
            orderIndex: orderIndex++,
            score: row?.matchScore ?? null,
            reasons: (row?.highlights ?? []) as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });

    await mergeSmartProposalMeta(companyId, leadId, { lastError: null });

    await prisma.leadActivity.create({
      data: {
        companyId,
        leadId,
        actorType: LeadActorType.USER,
        actorUserId: userId,
        activityType: LeadActivityType.EXTERNAL_EVENT,
        title: 'Propuesta inteligente generada',
        description: 'Versión 1',
        metadata: { event: 'smart_proposal_generated', version: 1 } as Prisma.InputJsonValue,
      },
    });

    const pRow = await prisma.proposal.findFirst({
      where: { companyId, leadId },
      select: { id: true },
    });
    if (pRow) {
      try {
        await proposalGenerationHost.finalizeAndNotifySellers({
          companyId,
          leadId,
          proposalId: pRow.id,
          proposalVersionId: versionId,
          actorUserId: userId,
        });
      } catch (e) {
        logger.error({ err: e, companyId, leadId, versionId }, 'Finalizar/notificar tras smart-proposal generate');
      }
    }

    return this.getState(companyId, leadId, role);
  }

  async regenerate(companyId: string, leadId: string, userId: string, role: string): Promise<SmartProposalStateDto> {
    const lead = await ensureLeadWithDetails(companyId, leadId);
    const trips = await loadApprovedTrips(companyId, role);
    if (!trips.length) {
      await mergeSmartProposalMeta(companyId, leadId, {
        lastError: 'No hay viajes aprobados en catálogo. Alta o revisión en Travel.',
      });
      throw new ValidationError('No hay viajes aprobados en catálogo');
    }

    const proposal = await prisma.proposal.findFirst({
      where: { companyId, leadId },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });
    if (!proposal?.versions[0]) {
      throw new ValidationError('Genera una propuesta antes de regenerar.');
    }

    const nextNum = proposal.versions[0].versionNumber + 1;
    const analysis = await buildAnalysis(companyId, lead, trips);
    const html = buildHtmlProposal(lead, analysis);
    const versionId = uuidv4();
    const pdfRel = this.pdfRelativeStoragePath(companyId, versionId);
    const pdfAbs = this.pdfAbsolutePath(companyId, versionId);

    await writePdfFile(pdfAbs, lead, analysis);

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposal.id },
        data: { status: 'GENERATED' },
      });

      await tx.proposalVersion.create({
        data: {
          id: versionId,
          companyId,
          proposalId: proposal.id,
          versionNumber: nextNum,
          intentSnapshot: analysis as unknown as Prisma.InputJsonValue,
          generatedHtml: html,
          pdfStoragePath: pdfRel,
          createdByUserId: userId,
        },
      });

      const tripIds = [...new Set(analysis.recommendedTrips.map((t) => t.id))];
      let orderIndex = 0;
      for (const tid of tripIds) {
        const row = analysis.recommendedTrips.find((r) => r.id === tid);
        await tx.proposalTrip.create({
          data: {
            id: uuidv4(),
            companyId,
            proposalVersionId: versionId,
            travelTripId: tid,
            orderIndex: orderIndex++,
            score: row?.matchScore ?? null,
            reasons: (row?.highlights ?? []) as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });

    await mergeSmartProposalMeta(companyId, leadId, { lastError: null });

    await prisma.leadActivity.create({
      data: {
        companyId,
        leadId,
        actorType: LeadActorType.USER,
        actorUserId: userId,
        activityType: LeadActivityType.EXTERNAL_EVENT,
        title: 'Propuesta inteligente regenerada',
        description: `Versión ${nextNum}`,
        metadata: { event: 'smart_proposal_regenerated', version: nextNum } as Prisma.InputJsonValue,
      },
    });

    try {
      await proposalGenerationHost.finalizeAndNotifySellers({
        companyId,
        leadId,
        proposalId: proposal.id,
        proposalVersionId: versionId,
        actorUserId: userId,
      });
    } catch (e) {
      logger.error({ err: e, companyId, leadId, versionId }, 'Finalizar/notificar tras smart-proposal regenerate');
    }

    return this.getState(companyId, leadId, role);
  }

  async markVendorNotified(
    companyId: string,
    leadId: string,
    userId: string,
    role: string,
  ): Promise<SmartProposalStateDto> {
    await ensureLeadWithDetails(companyId, leadId);
    const now = new Date().toISOString();
    await mergeSmartProposalMeta(companyId, leadId, {
      vendorNotified: true,
      vendorNotifiedAt: now,
    });

    await prisma.leadActivity.create({
      data: {
        companyId,
        leadId,
        actorType: LeadActorType.USER,
        actorUserId: userId,
        activityType: LeadActivityType.EXTERNAL_EVENT,
        title: 'Vendedor avisado (propuesta inteligente)',
        description: null,
        metadata: { event: 'smart_proposal_vendor_notified' } as Prisma.InputJsonValue,
      },
    });

    return this.getState(companyId, leadId, role);
  }
}