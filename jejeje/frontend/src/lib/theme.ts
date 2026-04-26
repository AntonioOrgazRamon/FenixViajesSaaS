export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

const LS_KEY = 'nc-theme';

export function isValidTheme(v: string | null | undefined): v is ThemePreference {
  return v === 'LIGHT' || v === 'DARK' || v === 'SYSTEM';
}

export function getStoredThemePreference(): ThemePreference | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const v = localStorage.getItem(LS_KEY);
    return isValidTheme(v) ? v : null;
  } catch {
    return null;
  }
}

/** @deprecated use getStoredThemePreference — mismo comportamiento */
export const readStoredThemePreference = getStoredThemePreference;

export function writeStoredThemePreference(pref: ThemePreference) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(LS_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function resolveThemeToMode(
  pref: ThemePreference | undefined | null,
  systemIsDark: boolean
): 'light' | 'dark' {
  if (pref === 'LIGHT') return 'light';
  if (pref === 'DARK') return 'dark';
  return systemIsDark ? 'dark' : 'light';
}

const THEME_COLOR_LIGHT = '#fafafa';
const THEME_COLOR_DARK = '#09090b';

/**
 * Aplica el modo resuelto al documento: clase `dark` en <html>, color-scheme, meta theme-color.
 */
export function applyResolvedTheme(mode: 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const isDark = mode === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
}

/**
 * Resolución previa a React: misma lógica que getStored + SYSTEM → matchMedia.
 * Segura en SSR (no hace nada) y con try/catch para localStorage.
 */
export function resolveInitialModeBeforePaint(): 'light' | 'dark' {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return 'light';
  }
  let pref: ThemePreference | null = null;
  try {
    const v = localStorage.getItem(LS_KEY);
    if (isValidTheme(v)) pref = v;
  } catch {
    /* ignore */
  }
  if (pref === 'DARK') return 'dark';
  if (pref === 'LIGHT') return 'light';
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function runThemeBootstrapScript() {
  if (typeof document === 'undefined') return;
  applyResolvedTheme(resolveInitialModeBeforePaint());
}
