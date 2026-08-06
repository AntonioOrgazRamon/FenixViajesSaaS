/** Etiquetas en castellano para campos técnicos de usuario (listados y fichas). */

const ROLE: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  COMPANY_ADMIN: 'Admin de empresa',
  COMPANY_USER: 'Usuario',
};

const STATUS: Record<string, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  LOCKED: 'Bloqueado',
  DELETED: 'Eliminado',
};

const AUTH: Record<string, string> = {
  LOCAL: 'Email y contraseña',
  GOOGLE: 'Google',
};

const COMPANY_ST: Record<string, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  DELETED: 'Eliminado',
};

const THEME: Record<string, string> = {
  SYSTEM: 'Sistema',
  LIGHT: 'Claro',
  DARK: 'Oscuro',
};

export function labelRole(code: string): string {
  return ROLE[code] ?? code;
}

export function labelUserStatus(code: string): string {
  return STATUS[code] ?? code;
}

export function labelAuthProvider(code: string): string {
  return AUTH[code] ?? code;
}

export function labelCompanyStatus(code: string): string {
  return COMPANY_ST[code] ?? code;
}

export function labelTheme(code: string | null | undefined): string {
  if (code == null) return '—';
  return THEME[code] ?? code;
}

export function formatDateTime(iso: string | null | undefined, empty = '—') {
  if (iso == null) return empty;
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return empty;
  }
}
