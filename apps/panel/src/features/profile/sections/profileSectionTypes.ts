export const PROFILE_SECTION_IDS = [
  'overview',
  'activity',
  'organization',
  'personal',
  'appearance',
  'preferences',
  'notifications',
  'privacy',
  'connections',
  'avatar',
  'security',
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTION_IDS)[number];

const SECTION_SET = new Set<string>(PROFILE_SECTION_IDS);

export function parseProfileSectionId(raw: string | null | undefined): ProfileSectionId | null {
  if (raw == null || raw === '') return null;
  return SECTION_SET.has(raw) ? (raw as ProfileSectionId) : null;
}

/** Ruta a la sección interna (sidebar) "Seguridad" con query estable. */
export const PROFILE_SECTION_SECURITY_HREF = '/profile?section=security' as const;

export const PROFILE_SECTIONS: Record<
  ProfileSectionId,
  { title: string; description: string; label: string }
> = {
  overview: {
    label: 'Resumen',
    title: 'Resumen',
    description: 'Identidad, acceso, estado de seguridad y datos clave.',
  },
  activity: {
    label: 'Actividad',
    title: 'Actividad de cuenta',
    description: 'Accesos, cambios de correo, contraseña o avatar (registro de auditoría).',
  },
  organization: {
    label: 'Organización',
    title: 'Organización y soporte',
    description: 'Espacio de trabajo, rol y vías de contacto.',
  },
  personal: {
    label: 'Datos personales',
    title: 'Datos personales',
    description: 'Cómo apareces en el directorio. Cada bloque se guarda por separado.',
  },
  appearance: {
    label: 'Apariencia',
    title: 'Apariencia',
    description: 'Tema del panel. Se aplica al instante y se sincroniza con otros dispositivos al iniciar sesión.',
  },
  preferences: {
    label: 'Región e idioma',
    title: 'Región, idioma y fechas',
    description: 'Idioma, zona horaria, formato de hora y vista previa de fechas.',
  },
  notifications: {
    label: 'Notificaciones',
    title: 'Notificaciones',
    description: 'Qué tipo de avisos quieres recibir por correo (preferencias almacenadas en tu cuenta).',
  },
  privacy: {
    label: 'Privacidad',
    title: 'Privacidad y datos',
    description: 'Documentación legal, exportación y enlaces al servicio.',
  },
  connections: {
    label: 'Conexiones',
    title: 'Conexiones (Google)',
    description: 'Vincular o desvincular inicio de sesión con terceros.',
  },
  avatar: {
    label: 'Avatar',
    title: 'Avatar e imagen de perfil',
    description: 'Foto, vista previa y generador con iniciales.',
  },
  security: {
    label: 'Seguridad',
    title: 'Seguridad y acceso',
    description: 'Correo, contraseña, 2FA, sesiones, cierre y políticas de cuenta.',
  },
};
