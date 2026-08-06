import fs from 'fs';
import path from 'path';
import { config } from '../../common/config';
import type { User, UserAvatarShape, UserAvatarType } from '@prisma/client';

export const LOCAL_AVATAR_PREFIX = '/uploads/avatars/';

export type ClientAvatar = {
  type: 'uploaded' | 'default';
  url: string | null;
  initials: string;
  backgroundColor: string;
  textColor: string;
  shape: 'circle' | 'rounded' | 'square';
};

const DEFAULT_BG = '#2563EB';
const DEFAULT_FG = '#FFFFFF';

export function toPublicAvatarUrl(stored: string | null): string | null {
  if (!stored) return null;
  if (stored.startsWith('http://') || stored.startsWith('https://')) return stored;
  const base = config.PUBLIC_URL.replace(/\/$/, '');
  const p = stored.startsWith('/') ? stored : `/${stored}`;
  return `${base}${p}`;
}

export function unlinkLocalAvatarIfAny(stored: string | null) {
  if (!stored || stored.startsWith('http://') || stored.startsWith('https://')) return;
  if (!stored.startsWith(LOCAL_AVATAR_PREFIX)) return;
  const rel = stored.replace(/^\//, '');
  if (rel.includes('..')) return;
  const full = path.join(process.cwd(), rel);
  fs.unlink(full, () => {});
}

export function mapShapeToClient(s: UserAvatarShape): 'circle' | 'rounded' | 'square' {
  if (s === 'ROUNDED') return 'rounded';
  if (s === 'SQUARE') return 'square';
  return 'circle';
}

function mapClientShapeToPrisma(s: 'circle' | 'rounded' | 'square'): UserAvatarShape {
  if (s === 'rounded') return 'ROUNDED';
  if (s === 'square') return 'SQUARE';
  return 'CIRCLE';
}

export { mapClientShapeToPrisma };

type AvatarFields = {
  id: string;
  avatarType: UserAvatarType;
  avatarUrl: string | null;
  avatarBackgroundColor: string | null;
  avatarTextColor: string | null;
  avatarInitials: string | null;
  avatarShape: UserAvatarShape;
  firstName: string;
  lastName: string;
  email: string;
};

export function deriveDisplayInitials(u: Pick<AvatarFields, 'firstName' | 'lastName' | 'email' | 'avatarInitials'>): string {
  const fromDb = u.avatarInitials?.trim();
  if (fromDb) {
    return fromDb.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || '?';
  }
  const a = u.firstName?.trim().charAt(0);
  const b = u.lastName?.trim().charAt(0);
  if (a && b) return `${a}${b}`.toUpperCase();
  if (a) return a.toUpperCase().slice(0, 2) || a.toUpperCase();
  const local = u.email?.split('@')[0] ?? '';
  const alnum = local.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (alnum.length >= 2) return alnum.slice(0, 2);
  if (alnum.length === 1) return alnum;
  return (u.email?.charAt(0) ?? '?').toUpperCase();
}

export function buildClientAvatar(
  u: Pick<
    User,
    | 'avatarType'
    | 'avatarUrl'
    | 'avatarBackgroundColor'
    | 'avatarTextColor'
    | 'avatarInitials'
    | 'avatarShape'
    | 'firstName'
    | 'lastName'
    | 'email'
  >
): ClientAvatar {
  const backgroundColor = u.avatarBackgroundColor ?? DEFAULT_BG;
  const textColor = u.avatarTextColor ?? DEFAULT_FG;
  const shape = mapShapeToClient(u.avatarShape);
  const initials = deriveDisplayInitials(u);

  // Cualquier ruta/URL guardada implica imagen (no depender solo de avatarType: datos viejos o desincronizados
  // mostraban "default" y un PATCH de preferencias podía borrar la ruta creyendo que no había subida).
  const stored = u.avatarUrl?.trim();
  if (stored) {
    return {
      type: 'uploaded',
      url: toPublicAvatarUrl(u.avatarUrl),
      initials,
      backgroundColor,
      textColor,
      shape,
    };
  }

  return {
    type: 'default',
    url: null,
    initials,
    backgroundColor,
    textColor,
    shape,
  };
}

/** @deprecated use buildClientAvatar(). coexists for login/profile responses */
export function legacyAvatarUrlFrom(avatar: ClientAvatar): string | null {
  if (avatar.type === 'uploaded' && avatar.url) return avatar.url;
  return null;
}
