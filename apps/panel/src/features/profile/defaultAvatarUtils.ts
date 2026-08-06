import type { UserAvatar } from '../../store/authStore';

export type DefaultDraft = {
  initials: string;
  backgroundColor: string;
  textColor: string;
  shape: 'circle' | 'rounded' | 'square';
};

/** Fondos sugeridos (nombre + hex) */
export const PRESET_BACKGROUNDS: readonly { id: string; label: string; value: string }[] = [
  { id: 'indigo', label: 'Azul', value: '#2563EB' },
  { id: 'emerald', label: 'Verde', value: '#059669' },
  { id: 'violet', label: 'Morado', value: '#7C3AED' },
  { id: 'orange', label: 'Naranja', value: '#EA580C' },
  { id: 'red', label: 'Rojo', value: '#DC2626' },
  { id: 'slate', label: 'Gris', value: '#1F2937' },
] as const;

/** Combinaciones fondo + texto en un clic */
export const SUGGESTED_COMBOS: readonly { name: string; backgroundColor: string; textColor: string }[] = [
  { name: 'Cielo', backgroundColor: '#2563EB', textColor: '#FFFFFF' },
  { name: 'Bosque', backgroundColor: '#047857', textColor: '#ECFDF5' },
  { name: 'Noche', backgroundColor: '#18181B', textColor: '#FAFAFA' },
  { name: 'Amanecer', backgroundColor: '#C2410C', textColor: '#FFFBEB' },
  { name: 'Lavanda', backgroundColor: '#5B21B6', textColor: '#F5F3FF' },
  { name: 'Pizarra', backgroundColor: '#334155', textColor: '#F8FAFC' },
];

export const TEXT_PRESETS: readonly { label: string; value: string }[] = [
  { label: 'Blanco', value: '#FFFFFF' },
  { label: 'Negro', value: '#0F172A' },
  { label: 'Ámbar claro', value: '#FEF3C7' },
];

export function buildDefaultPreview(
  draft: DefaultDraft,
  u: { firstName?: string | null; lastName?: string | null; email: string; avatar?: UserAvatar | null }
): UserAvatar {
  const d = draft.initials.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  let initials = d;
  if (!initials) {
    if (u.avatar?.initials?.trim()) initials = u.avatar.initials;
    else {
      const a = u.firstName?.trim().charAt(0);
      const b = u.lastName?.trim().charAt(0);
      if (a && b) initials = `${a}${b}`.toUpperCase();
      else if (a) initials = a.toUpperCase().slice(0, 2) || a.toUpperCase();
      else initials = u.email.split('@')[0]?.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2) || u.email.charAt(0).toUpperCase();
    }
  }
  return {
    type: 'default',
    url: null,
    initials,
    backgroundColor: draft.backgroundColor,
    textColor: draft.textColor,
    shape: draft.shape,
  };
}
