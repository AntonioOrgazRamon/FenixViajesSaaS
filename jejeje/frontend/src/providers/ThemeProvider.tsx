import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  readStoredThemePreference,
  resolveThemeToMode,
  type ThemePreference,
} from '../lib/theme';

function useSystemDark() {
  const [systemIsDark, setSystemIsDark] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : true,
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

  const pref: ThemePreference | undefined =
    user?.theme ?? readStoredThemePreference() ?? 'SYSTEM';

  const mode = resolveThemeToMode(pref, systemIsDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'dark' ? '#09090b' : '#fafafa');
  }, [mode]);

  return <>{children}</>;
}
