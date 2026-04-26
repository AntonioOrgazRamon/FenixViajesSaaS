export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

export function readStoredThemePreference(): ThemePreference | null {
  const v = localStorage.getItem('nc-theme');
  if (v === 'LIGHT' || v === 'DARK' || v === 'SYSTEM') return v;
  return null;
}

export function writeStoredThemePreference(pref: ThemePreference) {
  localStorage.setItem('nc-theme', pref);
}

export function resolveThemeToMode(pref: ThemePreference | undefined | null, systemIsDark: boolean): 'light' | 'dark' {
  if (pref === 'LIGHT') return 'light';
  if (pref === 'DARK') return 'dark';
  return systemIsDark ? 'dark' : 'light';
}
