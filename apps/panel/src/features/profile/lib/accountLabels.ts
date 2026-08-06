import type { AppRole } from '../../../store/authStore';

export function roleLabel(role: AppRole | undefined): string {
  if (role === 'SUPER_ADMIN') return 'Super administrador';
  if (role === 'COMPANY_ADMIN') return 'Administrador de empresa';
  return 'Usuario';
}

export function accountStatusLabel(
  s: 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'DELETED' | undefined
): string {
  if (s === 'ACTIVE' || s === undefined) return 'Activa';
  if (s === 'SUSPENDED') return 'Suspendida';
  if (s === 'LOCKED') return 'Bloqueada';
  if (s === 'DELETED') return 'Eliminada';
  return '—';
}

export function companyStatusLabel(s: string | undefined): string {
  if (s === 'ACTIVE' || s === undefined) return 'Activa';
  if (s === 'SUSPENDED') return 'Suspendida';
  if (s === 'DELETED') return 'Eliminada';
  return s;
}

export function formatDateTime(iso: string | null | undefined, locale: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale === 'en' ? 'en-GB' : 'es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Muestra “ahora” según idioma, reloj y zona (vista previa de preferencias). */
export function formatNowPreview(
  language: 'es' | 'en',
  timeFormat: '12h' | '24h' | null | undefined,
  timeZone: string | null | undefined
): string {
  const d = new Date();
  const locale = language === 'en' ? 'en-GB' : 'es-ES';
  const hour12 = timeFormat === '12h';
  try {
    return d.toLocaleString(locale, {
      timeZone: (timeZone && timeZone.trim()) || undefined,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    });
  } catch {
    return d.toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
