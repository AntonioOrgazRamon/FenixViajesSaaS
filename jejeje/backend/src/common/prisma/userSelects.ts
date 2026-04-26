import type { Prisma } from '@prisma/client';

/**
 * Campos "core" de User SIN `displayName`, `timeFormat`, `dateFormat` (rutas auth
 * que deben evitar depender de migraciones pendientes).
 */
export const userCoreNoPreferenceColumns = {
  id: true,
  email: true,
  passwordHash: true,
  firstName: true,
  lastName: true,
  phone: true,
  locale: true,
  timezone: true,
  companyId: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  avatarUrl: true,
  avatarType: true,
  avatarBackgroundColor: true,
  avatarTextColor: true,
  avatarInitials: true,
  avatarShape: true,
  theme: true,
  googleId: true,
  authProvider: true,
  failedLoginAttempts: true,
  lockedUntil: true,
} as const;

export const companyListSelect = { id: true, name: true, status: true } as const;

/** GET /profile y respuestas de actualización. */
export const userProfileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  phone: true,
  locale: true,
  timezone: true,
  timeFormat: true,
  dateFormat: true,
  companyId: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  avatarUrl: true,
  avatarType: true,
  avatarBackgroundColor: true,
  avatarTextColor: true,
  avatarInitials: true,
  avatarShape: true,
  theme: true,
  profilePreferences: true,
  googleId: true,
  authProvider: true,
  company: { select: companyListSelect },
} as const;

export type UserCoreNoPrefs = Prisma.UserGetPayload<{
  select: typeof userCoreNoPreferenceColumns;
}>;

export type UserProfileRow = Prisma.UserGetPayload<{
  select: typeof userProfileSelect;
}>;
