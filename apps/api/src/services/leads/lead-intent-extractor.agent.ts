import { createHash } from 'crypto';
import {
  LeadActivityType,
  LeadActorType,
  LeadAgentRunStatus,
  LeadAgentTriggerType,
  OpenAIOperationType,
  Prisma,
  type Lead,
  type LeadDetail,
} from '@prisma/client';
import prisma from '../../infrastructure/db';
import { config } from '../../common/config';
import { logger } from '../../common/logger';
import {
  LEAD_INTENT_EXTRACTOR_AGENT_KEY,
  type LeadIntentExtraction,
  normalizedIntentZ,
} from './lead-intent-extractor.schema';
import { guardedChatCompletion } from '../openai/openai-guarded.executor';

const INTENT_SYSTEM_PROMPT = `Eres un extractor de intención de viaje para CRM B2B. Tu tarea es leer los datos del lead (mensaje, formulario normalizado y contexto) y devolver UN SOLO objeto JSON con las claves exactas indicadas por el usuario.
Reglas estrictas:
- NO inventes destinos, fechas, presupuestos ni número de viajeros que no estén explícitos o claramente implícitos en el texto.
- Si un dato no aparece o es ambiguo, usa null (para escalares/objetos) o [] (para travelType, preferences, restrictions, missingInfo cuando no aplique).
- Copia nombres de lugares tal como aparecen en el idioma del cliente (sin traducir arbitrariamente).
- dateRange.start y dateRange.end deben ser strings de fecha en formato ISO 8601 (solo fecha: YYYY-MM-DD) si puedes inferirlos con seguridad; si no, null. Si solo hay un mes/año, dateRange puede ser null y rellena month si procede (ej. "2026-07" o texto breve como el cliente lo dijo).
- budgetTotal y budgetPerPerson: números en la moneda que mencione el cliente; si no hay importe claro, null.
- travelers: total de personas; adults/children solo si se distinguen explícitamente.
- travelType: array de strings, cada uno una etiqueta corta explícita en el texto (ej. "crucero", "luna de miel", "negocios"). Si no hay ningún tipo claro, devuelve [] (nunca inventes tipos).
- preferences: requisitos o deseos explícitos (hotel céntrico, vuelo directo…).
- restrictions: limitaciones explícitas (movilidad reducida, alergias mencion…).
- confidence: número entre 0 y 1 según tu certeza global en la extracción.
- missingInfo: lista de strings en español describiendo qué falta para cerrar la propuesta (ej. "fecha exacta de salida", "presupuesto total"), según lo que sea null en tu extracción.`;

export type LeadIntentExtractorExecuteParams = {
  companyId: string;
  leadId: string;
  triggerType: LeadAgentTriggerType;
  /** Si la ejecución es manual desde la app, para trazabilidad en actividades. */
  actorUserId?: string | null;
};

type LeadForIntent = Lead & { details: LeadDetail | null };

export class LeadIntentExtractorAgent {
  async execute(params: LeadIntentExtractorExecuteParams): Promise<{
    runId: string;
    status: LeadAgentRunStatus;
  }> {
    const startedAt = new Date();
    const run = await prisma.leadAgentRun.create({
      data: {
        companyId: params.companyId,
        leadId: params.leadId,
        agentKey: LEAD_INTENT_EXTRACTOR_AGENT_KEY,
        triggerType: params.triggerType,
        status: LeadAgentRunStatus.RUNNING,
        startedAt,
        inputPayload: {
          triggerType: params.triggerType,
          leadId: params.leadId,
        } as Prisma.InputJsonValue,
      },
    });

    try {
      const lead = await prisma.lead.findFirst({
        where: { id: params.leadId, companyId: params.companyId, deletedAt: null },
        include: { details: true },
      });

      if (!lead) {
        const msg = 'Lead no encontrado o sin acceso';
        await prisma.leadAgentRun.update({
          where: { id: run.id },
          data: {
            status: LeadAgentRunStatus.FAILED,
            finishedAt: new Date(),
            errorMessage: msg.slice(0, 8000),
          },
        });
        return { runId: run.id, status: LeadAgentRunStatus.FAILED };
      }

      await prisma.leadAgentRun.update({
        where: { id: run.id },
        data: {
          inputPayload: this.buildSafeInputSummary(lead, params.triggerType) as Prisma.InputJsonValue,
        },
      });

      const { intent, usedOpenAI, model } = await this.extractIntent(lead, {
        userId: params.actorUserId,
      });

      const stored = {
        schemaVersion: 1 as const,
        updatedAt: new Date().toISOString(),
        triggerType: params.triggerType,
        usedOpenAI,
        model: model ?? null,
        intent,
      };

      await this.persistIntent(lead, stored);

      await prisma.leadAgentRun.update({
        where: { id: run.id },
        data: {
          status: LeadAgentRunStatus.SUCCESS,
          finishedAt: new Date(),
          outputPayload: {
            intent,
            usedOpenAI,
            model: model ?? null,
          } as Prisma.InputJsonValue,
          errorMessage: null,
        },
      });

      await prisma.lead.update({
        where: { id: params.leadId },
        data: { lastAgentRunAt: new Date() },
      });

      const isManual = params.triggerType === LeadAgentTriggerType.MANUAL;
      await prisma.leadActivity.create({
        data: {
          companyId: params.companyId,
          leadId: params.leadId,
          actorUserId: isManual ? params.actorUserId ?? undefined : undefined,
          actorType: LeadActorType.AGENT,
          activityType: LeadActivityType.AGENT_RUN,
          title: 'Intención de viaje extraída',
          description: usedOpenAI
            ? `Agente ${LEAD_INTENT_EXTRACTOR_AGENT_KEY} (modelo) confianza ${intent.confidence.toFixed(2)}.`
            : `Agente ${LEAD_INTENT_EXTRACTOR_AGENT_KEY} (sin modelo / fallback) confianza ${intent.confidence.toFixed(2)}.`,
          metadata: {
            agentKey: LEAD_INTENT_EXTRACTOR_AGENT_KEY,
            runId: run.id,
            confidence: intent.confidence,
            usedOpenAI,
            model: model ?? null,
            missingInfoCount: intent.missingInfo.length,
            triggeredByUserId: isManual ? params.actorUserId ?? null : null,
          } as Prisma.InputJsonValue,
        },
      });

      return { runId: run.id, status: LeadAgentRunStatus.SUCCESS };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error(e, 'LeadIntentExtractorAgent: error no controlado');
      await this.finishFailure(run.id, message, params);
      return { runId: run.id, status: LeadAgentRunStatus.FAILED };
    }
  }

  private async finishFailure(runId: string, message: string, params: LeadIntentExtractorExecuteParams) {
    await prisma.leadAgentRun.update({
      where: { id: runId },
      data: {
        status: LeadAgentRunStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message.slice(0, 8000),
      },
    });

    await prisma.lead.updateMany({
      where: { id: params.leadId, companyId: params.companyId },
      data: { lastAgentRunAt: new Date() },
    });

    await prisma.leadActivity.create({
      data: {
        companyId: params.companyId,
        leadId: params.leadId,
        actorUserId: params.triggerType === LeadAgentTriggerType.MANUAL ? params.actorUserId ?? undefined : undefined,
        actorType: LeadActorType.AGENT,
        activityType: LeadActivityType.AGENT_RUN,
        title: 'Fallo al extraer intención de viaje',
        description: message.slice(0, 2000),
        metadata: {
          agentKey: LEAD_INTENT_EXTRACTOR_AGENT_KEY,
          runId,
          error: true,
          triggeredByUserId:
            params.triggerType === LeadAgentTriggerType.MANUAL ? params.actorUserId ?? null : null,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private buildSafeInputSummary(lead: LeadForIntent, triggerType: LeadAgentTriggerType): Prisma.InputJsonValue {
    return {
      triggerType,
      source: lead.source,
      sourceDetail: lead.sourceDetail,
      hasMessage: !!(lead.message && lead.message.trim().length > 0),
      messageChars: lead.message?.length ?? 0,
      hasNormalizedPayload: lead.normalizedPayload != null,
      hasRawPayload: lead.rawPayload != null,
      hasDetailCurrentContext: lead.details?.currentContext != null,
    } as Prisma.InputJsonValue;
  }

  private async persistIntent(lead: LeadForIntent, stored: Record<string, unknown>) {
    const companyId = lead.companyId;
    const leadId = lead.id;
    const prevTravel =
      lead.details && lead.details.travelContext != null && typeof lead.details.travelContext === 'object'
        ? { ...(lead.details.travelContext as Record<string, unknown>) }
        : {};

    const travelContext = {
      ...prevTravel,
      extractedIntent: stored,
    } as Prisma.InputJsonValue;

    if (lead.details) {
      await prisma.leadDetail.update({
        where: { leadId },
        data: { travelContext },
      });
      return;
    }

    await prisma.leadDetail.create({
      data: {
        leadId,
        companyId,
        currentContext: {} as Prisma.InputJsonValue,
        travelContext,
      },
    });
  }

  private async extractIntent(
    lead: LeadForIntent,
    opts?: { userId?: string | null },
  ): Promise<{
    intent: LeadIntentExtraction;
    usedOpenAI: boolean;
    model: string | null;
  }> {
    const heuristic = this.heuristicFromStructuredFields(lead);
    if (!config.OPENAI_API_KEY?.trim()) {
      return {
        intent: this.enrichMissingInfo(heuristic, 'Sin OPENAI_API_KEY: solo datos explícitos del payload.'),
        usedOpenAI: false,
        model: null,
      };
    }

    const userContent = this.buildUserPrompt(lead);
    const model = config.TRAVEL_OPENAI_MODEL;

    const idempotencyKey = createHash('sha256')
      .update(`${lead.id}:${lead.updatedAt.toISOString()}:${userContent.slice(0, 4000)}`)
      .digest('hex')
      .slice(0, 40);

    try {
      const res = await guardedChatCompletion({
        companyId: lead.companyId,
        userId: opts?.userId,
        leadId: lead.id,
        operationType: OpenAIOperationType.INTENT_EXTRACTION,
        model,
        temperature: 0.1,
        responseFormat: { type: 'json_object' },
        estimatedOutputTokens: 1200,
        idempotencyKey,
        messages: [
          { role: 'system', content: INTENT_SYSTEM_PROMPT },
          {
            role: 'user',
            content:
              userContent +
              `

Devuelve JSON con exactamente estas claves (en inglés, tipos según instrucciones del sistema):
destination, origin, durationDays, dateRange, month, budgetTotal, budgetPerPerson, travelers, adults, children, travelType (array de strings), preferences, restrictions, confidence, missingInfo.`,
          },
        ],
      });

      if (!res.ok) {
        return {
          intent: this.enrichMissingInfo(
            heuristic,
            `OpenAI no ejecutado (${res.code}): ${res.reason}`,
          ),
          usedOpenAI: false,
          model: null,
        };
      }

      const raw = res.content;
      if (!raw) {
        return {
          intent: this.enrichMissingInfo(heuristic, 'OpenAI devolvió respuesta vacía.'),
          usedOpenAI: false,
          model,
        };
      }

      const parsed = JSON.parse(raw) as unknown;
      const out = normalizedIntentZ.safeParse(parsed);
      if (!out.success) {
        logger.warn({ issues: out.error.issues }, 'Lead intent: JSON no valida Zod');
        const fallback = this.enrichMissingInfo(
          { ...heuristic, confidence: Math.min(heuristic.confidence, 0.25) },
          'Respuesta del modelo inválida; se usaron heurísticas.',
        );
        return {
          intent: fallback,
          usedOpenAI: true,
          model,
        };
      }

      const merged = this.mergePreferHeuristicForNulls(heuristic, out.data);
      return {
        intent: this.enrichMissingInfo(merged),
        usedOpenAI: true,
        model,
      };
    } catch (e) {
      logger.error(e, 'Lead intent: OpenAI error');
      return {
        intent: this.enrichMissingInfo(heuristic, 'Error al llamar a OpenAI; revisar logs.'),
        usedOpenAI: false,
        model: null,
      };
    }
  }

  private mergeLabelLists(a: string[], b: string[]): string[] {
    return [...new Set([...(a ?? []), ...(b ?? [])].map((s) => s.trim()).filter(Boolean))];
  }

  /** Si el modelo deja null pero el payload ya tenía un valor explícito, conservamos el explícito. */
  private mergePreferHeuristicForNulls(
    heuristic: LeadIntentExtraction,
    model: LeadIntentExtraction,
  ): LeadIntentExtraction {
    const pick = <T>(
      h: T | null | undefined,
      m: T | null | undefined,
    ): T | null | undefined => {
      if (m !== null && m !== undefined) return m;
      return h ?? null;
    };

    const dateRange =
      model.dateRange == null && heuristic.dateRange != null
        ? heuristic.dateRange
        : model.dateRange;

    return {
      destination: pick(heuristic.destination, model.destination) as string | null,
      origin: pick(heuristic.origin, model.origin) as string | null,
      durationDays: pick(heuristic.durationDays, model.durationDays) as number | null,
      dateRange: (dateRange ?? null) as LeadIntentExtraction['dateRange'],
      month: pick(heuristic.month, model.month) as string | null,
      budgetTotal: pick(heuristic.budgetTotal, model.budgetTotal) as number | null,
      budgetPerPerson: pick(heuristic.budgetPerPerson, model.budgetPerPerson) as number | null,
      travelers: pick(heuristic.travelers, model.travelers) as number | null,
      adults: pick(heuristic.adults, model.adults) as number | null,
      children: pick(heuristic.children, model.children) as number | null,
      travelType: this.mergeLabelLists(heuristic.travelType, model.travelType),
      preferences: [...new Set([...(heuristic.preferences ?? []), ...(model.preferences ?? [])])],
      restrictions: [...new Set([...(heuristic.restrictions ?? []), ...(model.restrictions ?? [])])],
      confidence: model.confidence,
      missingInfo: [...new Set([...(heuristic.missingInfo ?? []), ...(model.missingInfo ?? [])])],
    };
  }

  private travelTypesFromPayload(v: unknown): string[] {
    if (v == null) return [];
    if (typeof v === 'string' && v.trim()) return [v.trim().slice(0, 120)];
    if (Array.isArray(v)) {
      return v
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => x.trim().slice(0, 120));
    }
    return [];
  }

  private heuristicFromStructuredFields(lead: LeadForIntent): LeadIntentExtraction {
    const n = lead.normalizedPayload as Record<string, unknown> | null | undefined;
    const travel = (n?.travel as Record<string, unknown> | undefined) ?? undefined;
    const context = (n?.context as Record<string, unknown> | undefined) ?? undefined;
    const contact = (n?.contact as Record<string, unknown> | undefined) ?? undefined;

    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

    const destination =
      str(travel?.destination) ?? str(travel?.destinationName) ?? str(context?.destination) ?? null;

    const origin = str(n?.origin) ?? str(context?.origin) ?? str(context?.from) ?? null;

    const seats = num(travel?.seats);
    const travelers = seats ?? num(context?.travelers) ?? num(contact?.travelers) ?? null;

    let dateRange: LeadIntentExtraction['dateRange'] = null;
    const travelDate = str(travel?.travelDate);
    if (travelDate) {
      const day = travelDate.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        dateRange = { start: day, end: day };
      }
    }

    const hasAny =
      !!destination ||
      !!origin ||
      travelers != null ||
      dateRange != null ||
      !!(lead.message && lead.message.trim().length > 0);

    return {
      destination,
      origin,
      durationDays: num(travel?.durationDays) ?? num(context?.durationDays),
      dateRange,
      month: str(travel?.month) ?? str(context?.month),
      budgetTotal: num(travel?.budgetTotal) ?? num(context?.budgetTotal),
      budgetPerPerson: num(travel?.budgetPerPerson) ?? num(context?.budgetPerPerson),
      travelers,
      adults: num(travel?.adults) ?? num(context?.adults),
      children: num(travel?.children) ?? num(context?.children),
      travelType: this.mergeLabelLists(
        this.travelTypesFromPayload(travel?.travelType),
        this.travelTypesFromPayload(context?.travelType),
      ),
      preferences: [],
      restrictions: [],
      confidence: hasAny ? 0.35 : 0.15,
      missingInfo: [],
    };
  }

  private enrichMissingInfo(base: LeadIntentExtraction, extraNote?: string): LeadIntentExtraction {
    const missing = new Set(base.missingInfo);
    if (!base.destination) missing.add('destino');
    if (!base.origin) missing.add('origen / ciudad de salida');
    if (base.durationDays == null) missing.add('duración del viaje (días)');
    if (base.dateRange == null && base.month == null) {
      missing.add('fechas o mes aproximado');
    }
    if (base.budgetTotal == null && base.budgetPerPerson == null) missing.add('presupuesto');
    if (base.travelers == null) missing.add('número de viajeros');
    if (extraNote) missing.add(extraNote);
    return {
      ...base,
      missingInfo: [...missing],
    };
  }

  private buildUserPrompt(lead: LeadForIntent): string {
    const parts: string[] = [];

    parts.push(`Fuente del lead: ${lead.source}${lead.sourceDetail ? ` (${lead.sourceDetail})` : ''}`);

    if (lead.firstName || lead.lastName || lead.fullName) {
      parts.push(
        `Contacto (nombres ya en CRM, no extraer como destino): ${[lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.fullName || ''}`,
      );
    }

    if (lead.message?.trim()) {
      parts.push(`Mensaje del cliente:\n"""${lead.message.trim().slice(0, 12_000)}"""`);
    }

    if (lead.normalizedPayload != null) {
      parts.push(`Payload normalizado (JSON):\n${JSON.stringify(lead.normalizedPayload).slice(0, 12_000)}`);
    }

    if (lead.rawPayload != null) {
      parts.push(`Payload crudo (JSON, puede contener ruido):\n${JSON.stringify(lead.rawPayload).slice(0, 8000)}`);
    }

    if (lead.details?.currentContext != null) {
      parts.push(
        `Contexto actual en CRM:\n${JSON.stringify(lead.details.currentContext).slice(0, 8000)}`,
      );
    }

    return parts.join('\n\n');
  }
}

export const leadIntentExtractorAgent = new LeadIntentExtractorAgent();
