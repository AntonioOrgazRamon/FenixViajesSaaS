/**
 * Enlaces de producto (sustituir por variables de entorno en despliegue).
 */
const env = import.meta.env;

export const accountExternalLinks = {
  statusPage: (env.VITE_STATUS_PAGE_URL as string | undefined) ?? 'https://status.example.com',
  privacy: (env.VITE_PRIVACY_URL as string | undefined) ?? 'https://example.com/privacidad',
  terms: (env.VITE_TERMS_URL as string | undefined) ?? 'https://example.com/terminos',
  productUpdates: (env.VITE_PRODUCT_UPDATES_URL as string | undefined) ?? 'https://example.com/novedades',
} as const;

export const supportMailto = (env.VITE_SUPPORT_EMAIL as string | undefined) ?? 'soporte@example.com';
