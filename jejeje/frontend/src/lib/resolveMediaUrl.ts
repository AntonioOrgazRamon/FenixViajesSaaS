/**
 * Asegura URL absoluta al backend para rutas bajo `/uploads/`.
 * En dev, la SPA corre en :5173 y el API en :3000; un `src="/uploads/…"` pide al front y se rompe.
 */
export function resolveMediaUrl(href: string | null | undefined): string | null {
  if (href == null || href === '') return null;
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:') || href.startsWith('blob:')) {
    return href;
  }
  if (href.startsWith('/')) {
    const base = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000/api/v1';
    const origin = base.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
    return `${origin}${href.startsWith('/') ? href : `/${href}`}`;
  }
  return href;
}
