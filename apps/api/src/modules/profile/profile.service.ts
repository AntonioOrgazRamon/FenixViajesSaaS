import bcrypt from 'bcrypt';
import type { Express } from 'express';
import prisma from '../../infrastructure/db';
import { ConflictError, UnauthorizedError, ValidationError } from '../../common/errors/AppError';
import type { z } from 'zod';
import type { updateProfileExtendedSchema, changeEmailSchema, patchDefaultAvatarSchema } from './profile.schema';
import { Prisma, Theme } from '@prisma/client';

type DefaultProfilePreferences = {
  notifyProduct: boolean;
  notifySecurity: boolean;
  notifyBilling: boolean;
  marketingOptIn: boolean;
};

const DEFAULT_PROFILE_PREFERENCES: DefaultProfilePreferences = {
  notifyProduct: true,
  notifySecurity: true,
  notifyBilling: true,
  marketingOptIn: false,
};

const ACCOUNT_AUDIT_ACTIONS: string[] = [
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGOUT',
  'AUTH_PASSWORD_CHANGED',
  'PROFILE_EMAIL_CHANGED',
  'PROFILE_AVATAR_UPDATED',
  'AUTH_LOGIN_FAILED',
];

function parseProfilePreferencesJson(raw: unknown): DefaultProfilePreferences {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_PROFILE_PREFERENCES };
  }
  const o = raw as Record<string, unknown>;
  return {
    notifyProduct: typeof o.notifyProduct === 'boolean' ? o.notifyProduct : DEFAULT_PROFILE_PREFERENCES.notifyProduct,
    notifySecurity: typeof o.notifySecurity === 'boolean' ? o.notifySecurity : DEFAULT_PROFILE_PREFERENCES.notifySecurity,
    notifyBilling: typeof o.notifyBilling === 'boolean' ? o.notifyBilling : DEFAULT_PROFILE_PREFERENCES.notifyBilling,
    marketingOptIn: typeof o.marketingOptIn === 'boolean' ? o.marketingOptIn : DEFAULT_PROFILE_PREFERENCES.marketingOptIn,
  };
}
import {
  buildClientAvatar,
  legacyAvatarUrlFrom,
  LOCAL_AVATAR_PREFIX,
  mapClientShapeToPrisma,
  unlinkLocalAvatarIfAny,
} from './avatar-helpers';
import { userProfileSelect, type UserProfileRow } from '../../common/prisma/userSelects';

type UpdateExtended = z.infer<typeof updateProfileExtendedSchema>;
type ChangeEmail = z.infer<typeof changeEmailSchema>;
type PatchDefault = z.infer<typeof patchDefaultAvatarSchema>;

export { toPublicAvatarUrl, buildClientAvatar } from './avatar-helpers';

const profileSelect = userProfileSelect;

function mapToClient(user: UserProfileRow, lastPasswordChangeAt: Date | null) {
  const avatar = buildClientAvatar(user);
  const tf: '24h' | '12h' = user.timeFormat === '12h' ? '12h' : '24h';
  const dfRaw = user.dateFormat;
  const df: 'dmy' | 'mdy' | 'ymd' | 'locale' =
    dfRaw === 'dmy' || dfRaw === 'mdy' || dfRaw === 'ymd' || dfRaw === 'locale' ? dfRaw : 'locale';
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    phone: user.phone,
    locale: user.locale,
    timezone: user.timezone,
    timeFormat: tf,
    dateFormat: df,
    role: user.role,
    companyId: user.companyId,
    company: user.company
      ? { id: user.company.id, name: user.company.name, status: user.company.status }
      : null,
    accountStatus: user.status,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    avatar,
    avatar_url: legacyAvatarUrlFrom(avatar),
    language: user.locale === 'en' ? 'en' : 'es',
    theme: user.theme,
    profilePreferences: parseProfilePreferencesJson(user.profilePreferences),
    lastPasswordChangeAt: lastPasswordChangeAt ? lastPasswordChangeAt.toISOString() : null,
    has_google_linked: !!user.googleId,
    auth_provider: user.authProvider,
  };
}

function normalizeInitialsForDb(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  if (!t) return null;
  const u = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!u) return null;
  return u.slice(0, 3);
}

export class ProfileService {
  async getProfile(userId: string) {
    const [user, lastPwd] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: profileSelect,
      }),
      prisma.auditLog.findFirst({
        where: { actorUserId: userId, action: 'AUTH_PASSWORD_CHANGED' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);
    if (!user) throw new UnauthorizedError();
    return mapToClient(user, lastPwd?.createdAt ?? null);
  }

  async updateProfile(userId: string, data: UpdateExtended) {
    const update: {
      firstName?: string;
      lastName?: string;
      displayName?: string | null;
      phone?: string | null;
      locale?: string | null;
      timezone?: string | null;
      timeFormat?: string | null;
      dateFormat?: string | null;
      theme?: Theme;
      profilePreferences?: Prisma.InputJsonValue;
    } = {};

    if (data.firstName !== undefined) update.firstName = data.firstName;
    if (data.lastName !== undefined) update.lastName = data.lastName;
    if (data.displayName !== undefined) update.displayName = data.displayName;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.timezone !== undefined) update.timezone = data.timezone;
    if (data.theme !== undefined) update.theme = data.theme as Theme;
    if (data.language !== undefined) update.locale = data.language;
    if (data.timeFormat !== undefined) update.timeFormat = data.timeFormat;
    if (data.dateFormat !== undefined) update.dateFormat = data.dateFormat;
    if (data.profilePreferences !== undefined) {
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { profilePreferences: true },
      });
      const base = parseProfilePreferencesJson(current?.profilePreferences);
      const merged = { ...base, ...data.profilePreferences };
      update.profilePreferences = merged as Prisma.InputJsonValue;
    }

    await prisma.user.update({
      where: { id: userId },
      data: update,
      select: { id: true },
    });

    return this.getProfile(userId);
  }

  async changeEmail(userId: string, data: ChangeEmail) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, role: true, companyId: true, email: true },
    });
    if (!user) throw new UnauthorizedError();

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) throw new ValidationError('Contraseña incorrecta');

    const taken = await prisma.user.findUnique({ where: { email: data.new_email }, select: { id: true } });
    if (taken && taken.id !== userId) {
      throw new ConflictError('El correo ya está en uso', 'EMAIL_IN_USE');
    }

    await prisma.user.update({
      where: { id: userId },
      data: { email: data.new_email },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        companyId: user.companyId,
        action: 'PROFILE_EMAIL_CHANGED',
        targetType: 'USER',
        targetId: user.id,
        result: 'SUCCESS',
      },
    });

    return { email: data.new_email };
  }

  async setAvatarFromFile(userId: string, file: Express.Multer.File) {
    const prev = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    unlinkLocalAvatarIfAny(prev?.avatarUrl ?? null);

    const relativePath = `${LOCAL_AVATAR_PREFIX}${file.filename}`;

    await prisma.user.update({
      where: { id: userId },
      data: { avatarType: 'UPLOADED', avatarUrl: relativePath },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'PROFILE_AVATAR_UPDATED',
        targetType: 'USER',
        targetId: userId,
        result: 'SUCCESS',
        metadata: { source: 'upload' } as Prisma.InputJsonValue,
      },
    });

    return this.getProfile(userId);
  }

  /**
   * Solo colores, iniciales y forma “de reserva”. Nunca toca avatarUrl ni avatarType: quitar imagen = DELETE /profile/avatar.
   */
  async patchDefaultAvatar(userId: string, data: PatchDefault) {
    const prev = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!prev) throw new UnauthorizedError();

    const prefs = {
      avatarInitials: normalizeInitialsForDb(data.initials),
      avatarBackgroundColor: data.backgroundColor,
      avatarTextColor: data.textColor,
      avatarShape: mapClientShapeToPrisma(data.shape),
    };

    await prisma.user.update({
      where: { id: userId },
      data: prefs,
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'PROFILE_AVATAR_UPDATED',
        targetType: 'USER',
        targetId: userId,
        result: 'SUCCESS',
        metadata: { source: 'default' } as Prisma.InputJsonValue,
      },
    });

    return this.getProfile(userId);
  }

  async deleteAvatar(userId: string) {
    const prev = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    unlinkLocalAvatarIfAny(prev?.avatarUrl ?? null);

    await prisma.user.update({
      where: { id: userId },
      data: { avatarType: 'DEFAULT', avatarUrl: null },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'PROFILE_AVATAR_UPDATED',
        targetType: 'USER',
        targetId: userId,
        result: 'SUCCESS',
        metadata: { cleared: true } as Prisma.InputJsonValue,
      },
    });

    return this.getProfile(userId);
  }

  /** Actividad de cuenta (auditoría filtrada: accesos, correo, avatar, contraseña). */
  async getAccountActivity(userId: string) {
    const [items, lastPwd] = await Promise.all([
      prisma.auditLog.findMany({
        where: { actorUserId: userId, action: { in: ACCOUNT_AUDIT_ACTIONS } },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: {
          id: true,
          action: true,
          result: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          targetType: true,
          metadata: true,
        },
      }),
      prisma.auditLog.findFirst({
        where: { actorUserId: userId, action: 'AUTH_PASSWORD_CHANGED' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      items: items.map((r) => ({
        id: r.id,
        action: r.action,
        result: r.result,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        targetType: r.targetType,
        metadata: r.metadata,
        createdAt: r.createdAt.toISOString(),
      })),
      lastPasswordChangeAt: lastPwd?.createdAt.toISOString() ?? null,
    };
  }
}
