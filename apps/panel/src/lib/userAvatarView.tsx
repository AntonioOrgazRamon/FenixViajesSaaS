import { useEffect, useState } from 'react';
import { cn } from './cn';
import { resolveMediaUrl } from './resolveMediaUrl';
import type { UserAvatar } from '../store/authStore';

export type UserAvatarUserFields = {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  avatar?: UserAvatar | null;
  /** @deprecated Compat: sesiones antiguas sin objeto `avatar` */
  avatar_url?: string | null;
};

function legacyInitials(u: UserAvatarUserFields): string {
  const a = u.firstName?.trim().charAt(0);
  const b = u.lastName?.trim().charAt(0);
  if (a && b) return (a + b).toUpperCase();
  if (a) return a.toUpperCase();
  return u.email.charAt(0).toUpperCase();
}

function imageSrc(u: UserAvatarUserFields): string | null {
  const nested = (u.avatar?.url ?? '').trim();
  const legacy = (u.avatar_url ?? '').trim();
  if (!nested && !legacy) return null;
  // Preferir objeto anidado, luego legado (si hubo sesión a medio mezclar, sigue el fallback).
  return resolveMediaUrl(nested || legacy);
}

const shapeClass = (s: 'circle' | 'rounded' | 'square' | undefined) => {
  if (s === 'rounded') return 'rounded-xl';
  if (s === 'square') return 'rounded-md';
  return 'rounded-full';
};

type Size = 'sm' | 'md' | 'lg' | 'profile';

const sizeClass: Record<Size, string> = {
  sm: 'h-9 w-9 min-h-9 min-w-9 text-[10px]',
  md: 'h-11 w-11 min-h-11 min-w-11 text-xs',
  lg: 'h-12 w-12 min-h-12 min-w-12 text-sm',
  profile: 'h-16 w-16 min-h-16 min-w-16 text-lg',
};

/**
 * Muestra foto subida, URL legada, o iniciales con colores (avatar por defecto).
 */
export function UserAvatarView({
  user,
  size = 'md',
  className,
  imgClassName,
}: {
  user: UserAvatarUserFields;
  size?: Size;
  className?: string;
  imgClassName?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = imageSrc(user);

  useEffect(() => {
    setImgFailed(false);
  }, [src, user?.avatar?.type, user?.avatar_url]);

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setImgFailed(true)}
        className={cn(
          'shrink-0 border border-zinc-200/80 object-cover dark:border-white/10',
          shapeClass(user.avatar?.shape),
          sizeClass[size],
          className,
          imgClassName,
        )}
      />
    );
  }

  const bg = user.avatar?.backgroundColor ?? undefined;
  const fg = user.avatar?.textColor ?? undefined;
  const shape = user.avatar?.shape;
  const initials = user.avatar?.initials?.trim() ? user.avatar.initials : legacyInitials(user);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center font-semibold',
        shapeClass(shape),
        sizeClass[size],
        !user.avatar && 'border border-amber-200/60 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
        className,
      )}
      style={
        user.avatar
          ? {
              backgroundColor: bg,
              color: fg,
            }
          : undefined
      }
      aria-hidden
    >
      {initials}
    </div>
  );
}
