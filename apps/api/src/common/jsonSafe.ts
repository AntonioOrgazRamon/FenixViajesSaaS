import { Prisma } from '@prisma/client';

/**
 * Clona un valor para JSON: Decimal y fechas legibles, sin sorpresas al serializar.
 */
export function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (v instanceof Prisma.Decimal) {
        return v.toString();
      }
      if (v instanceof Date) {
        return v.toISOString();
      }
      if (typeof v === 'bigint') {
        return v.toString();
      }
      return v;
    }),
  ) as T;
}
