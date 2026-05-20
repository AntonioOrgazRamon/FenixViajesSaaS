import { useEffect, useState } from 'react';

function syncDemoFlagFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search).get('demo');
  if (q === '1' || q === 'true' || q === 'yes') {
    sessionStorage.setItem('demoPresentationMode', '1');
    return true;
  }
  return sessionStorage.getItem('demoPresentationMode') === '1';
}

/**
 * Demo Presentation Mode — lectura liviana (`?demo=1` persiste en sessionStorage).
 * Oculta ruido técnico superficial en vistas pensadas para reuniones.
 */
export function useDemoPresentationMode(): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(syncDemoFlagFromUrl());

    const onPop = () => setOn(syncDemoFlagFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return on;
}
