import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  getStoredThemePreference,
  applyResolvedTheme,
  resolveThemeToMode,
  type ThemePreference,
} from '../lib/theme';

function useSystemDark() {
  const [systemIsDark, setSystemIsDark] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemIsDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return systemIsDark;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const systemIsDark = useSystemDark();

  const pref: ThemePreference =
    (user?.theme as ThemePreference | undefined) ?? getStoredThemePreference() ?? 'SYSTEM';

  const mode = resolveThemeToMode(pref, systemIsDark);

  useEffect(() => {
    applyResolvedTheme(mode);
  }, [mode]);

  return <>{children}</>;
}
