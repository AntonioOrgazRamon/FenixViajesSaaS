import OpenAI from 'openai';
import { config } from '../../common/config';
import { tripAiExtractZ, type TripAiExtract } from './trip-ai.schemas';
import { logger } from '../../common/logger';

/**
 * FASE 5 — Convierte un bloque de texto de un viaje en JSON validado con Zod.
 * Sin OPENAI_API_KEY no “inventa”: devuelve estructura mínima con título y descripción = excerpt.
 */
export class TripAIExtractionService {
  async extractFromBlock(input: {
    titleHint: string;
    pageStart: number;
    pageEnd: number;
    text: string;
  }): Promise<{ data: TripAiExtract; usedModel: boolean }> {
    if (!config.OPENAI_API_KEY) {
      return {
        data: fallbackExtraction(input),
        usedModel: false,
      };
    }

    const client = new OpenAI({ apiKey: config.OPENAI_API_KEY });
    const system = `Eres un extractor de catálogos turísticos. Devuelves SOLO JSON válido según el esquema pedido.
Reglas estrictas:
- No inventes precios, fechas, hoteles ni destinos que no aparezcan en el texto.
- Si un campo no está en el texto, usa null o listas vacías.
- Los nombres de destinos deben copiarse del texto.
- confidence: tu grado de confianza 0-1 en la calidad de la extracción.`;

    const user = `Título candidato: ${input.titleHint}
Páginas aproximadas: ${input.pageStart}-${input.pageEnd}

TEXTO:
---
${input.text.slice(0, 120_000)}
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
      const res = await client.chat.completions.create({
        model: config.TRAVEL_OPENAI_MODEL,
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const raw = res.choices[0]?.message?.content;
      if (!raw) {
        return { data: fallbackExtraction(input), usedModel: false };
      }
      const parsed = JSON.parse(raw) as unknown;
      const out = tripAiExtractZ.safeParse(parsed);
      if (!out.success) {
        logger.warn({ issues: out.error.issues }, 'IA: JSON no valida esquema, fallback');
        return { data: fallbackExtraction(input), usedModel: true };
      }
      return { data: out.data, usedModel: true };
    } catch (e) {
      logger.error(e, 'OpenAI extract error');
      return { data: fallbackExtraction(input), usedModel: false };
    }
  }
}

function fallbackExtraction(input: { titleHint: string; text: string }): TripAiExtract {
  return {
    title: input.titleHint.slice(0, 500) || 'Viaje (sin título)',
    provider: null,
    season: null,
    mainDestination: null,
    description: input.text.slice(0, 8000) || null,
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
