import { config } from '../../common/config';
import { ValidationError } from '../../common/errors/AppError';

/** Límite efectivo en bytes (UTF-8) para pegar JSON; alineado con multer en upload. */
export function getTravelJsonImportMaxBytes(): number {
  const configuredMb = parseFloat(config.TRAVEL_JSON_IMPORT_MAX_MB || '8');
  const maxMb = Number.isFinite(configuredMb) ? Math.min(32, Math.max(1, configuredMb)) : 8;
  return Math.floor(maxMb * 1024 * 1024);
}

export function assertPasteJsonContentWithinLimit(jsonContent: string): void {
  const n = Buffer.byteLength(jsonContent, 'utf8');
  const max = getTravelJsonImportMaxBytes();
  if (n > max) {
    const mb = Math.round(max / 1024 / 1024);
    throw new ValidationError(`El contenido supera el tamaño máximo permitido (${mb} MB UTF-8)`);
  }
}

/**
 * Raíz JSON: array de viajes o un único objeto viaje → siempre array no vacío.
 */
export function normalizeRootJsonToTripsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new ValidationError('El array de viajes está vacío');
    }
    return parsed;
  }
  if (parsed !== null && typeof parsed === 'object') {
    return [parsed];
  }
  throw new ValidationError('El JSON debe ser un array de viajes o un único objeto viaje');
}

export function parseJsonTextToTripsArray(jsonText: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new ValidationError('JSON inválido: sintaxis incorrecta');
  }
  return normalizeRootJsonToTripsArray(parsed);
}
