import { createHash } from 'crypto';
import { OpenAIOperationType } from '@prisma/client';
import { config } from '../../common/config';
import { tripAiExtractZ, type TripAiExtract } from './trip-ai.schemas';
import { logger } from '../../common/logger';
import { cleanRepeatedCatalogHeaders } from './trip-text-cleaning.service';
import { filterHotelsForPersistence } from './trip-hotels-extract.service';
import { guardedChatCompletion } from '../openai/openai-guarded.executor';

/**
 * FASE 5 — Convierte un bloque de texto de un viaje en JSON validado con Zod.
 * Sin OPENAI_API_KEY no “inventa”: devuelve estructura mínima con título y descripción = excerpt.
 */
export class TripAIExtractionService {
  async extractFromBlock(input: {
    companyId: string;
    userId?: string | null;
    titleHint: string;
    pageStart: number;
    pageEnd: number;
    text: string;
  }): Promise<{ data: TripAiExtract; usedModel: boolean }> {
    if (!config.OPENAI_API_KEY?.trim()) {
      return {
        data: fallbackExtraction(input),
        usedModel: false,
      };
    }

    const system = `Eres un extractor de catálogos turísticos. Devuelves SOLO JSON válido según el esquema pedido.
Reglas estrictas:
- No inventes precios, fechas, hoteles ni destinos que no aparezcan en el texto.
- Si un campo no está en el texto, usa null o listas vacías.
- Los nombres de destinos deben copiarse del texto.
- confidence: tu grado de confianza 0-1 en la calidad de la extracción.`;

    const textForModel = cleanRepeatedCatalogHeaders(input.text).slice(0, 120_000);
    const user = `Título candidato: ${input.titleHint}
Páginas aproximadas: ${input.pageStart}-${input.pageEnd}

TEXTO:
---
${textForModel}
---

Responde con un único JSON con las claves:
title, provider, season, mainDestination, description, durationDays, durationNights, indicativePrice, currency, confidence,
destinations[], itineraryDays[], services[], departures[], hotels[], highlights[], observations[].
destinations: {name, type} con type en COUNTRY|REGION|CITY|AREA|ATTRACTION.
itineraryDays: {dayNumber, title, description, meals, accommodation, order}.
services: {type, text, order} con type INCLUDED|NOT_INCLUDED|OPTIONAL.
departures: {departureText, startDate, endDate, weekdays, order}.
hotels: {category, city, hotelName, order}.
highlights: {text, order}.
observations: {text, order}.`;

    try {
      const idempotencyKey = createHash('sha256')
        .update(`${input.companyId}:${input.pageStart}:${input.pageEnd}:${textForModel.slice(0, 8000)}`)
        .digest('hex')
        .slice(0, 40);

      const res = await guardedChatCompletion({
        companyId: input.companyId,
        userId: input.userId,
        operationType: OpenAIOperationType.TRIP_PDF_EXTRACTION,
        model: config.TRAVEL_OPENAI_MODEL,
        temperature: 0.1,
        responseFormat: { type: 'json_object' },
        estimatedOutputTokens: 4096,
        idempotencyKey,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });

      if (!res.ok) {
        return { data: fallbackExtraction(input), usedModel: false };
      }

      const raw = res.content;
      if (!raw) {
        return { data: fallbackExtraction(input), usedModel: false };
      }
      const parsed = JSON.parse(raw) as unknown;
      const out = tripAiExtractZ.safeParse(parsed);
      if (!out.success) {
        logger.warn({ issues: out.error.issues }, 'IA: JSON no valida esquema, fallback');
        return { data: fallbackExtraction(input), usedModel: true };
      }
      const hClean = filterHotelsForPersistence(out.data.hotels);
      const data: TripAiExtract = {
        ...out.data,
        hotels: hClean.kept.map((h, i) => ({ ...h, order: i })),
      };
      if (hClean.dropped.length > 0) {
        logger.debug(
          { nDropped: hClean.dropped.length, sample: hClean.dropped.slice(0, 8) },
          'IA: hoteles filtrados (candidatos inválidos)',
        );
      }
      return { data, usedModel: true };
    } catch (e) {
      logger.error(e, 'OpenAI extract error');
      return { data: fallbackExtraction(input), usedModel: false };
    }
  }
}

function fallbackExtraction(input: { titleHint: string; text: string }): TripAiExtract {
  const forDesc = cleanRepeatedCatalogHeaders(input.text);
  return {
    title: input.titleHint.slice(0, 500) || 'Viaje (sin título)',
    provider: null,
    season: null,
    mainDestination: null,
    description: forDesc.slice(0, 8000) || null,
    durationDays: null,
    durationNights: null,
    indicativePrice: null,
    currency: null,
    confidence: 0.2,
    destinations: [],
    itineraryDays: [],
    services: [],
    departures: [],
    hotels: [],
    highlights: [],
    observations: [],
  };
}
