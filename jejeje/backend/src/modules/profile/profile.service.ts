import bcrypt from 'bcrypt';
import type { Express } from 'express';
import prisma from '../../infrastructure/db';
import { ConflictError, UnauthorizedError, ValidationError } from '../../common/errors/AppError';
import type { z } from 'zod';
import type { updateProfileExtendedSchema, changeEmailSchema, patchDefaultAvatarSchema } from './profile.schema';
import { Prisma, Theme } from '@prisma/client';
import {
  buildClientAvatar,
  legacyAvatarUrlFrom,
  LOCAL_AVATAR_PREFIX,
  mapClientShapeToPrisma,
  unlinkLocalAvatarIfAny,
} from './avatar-helpers';

type UpdateExtended = z.infer<typeof updateProfileExtendedSchema>;
type ChangeEmail = z.infer<typeof changeEmailSchema>;
type PatchDefault = z.infer<typeof patchDefaultAvatarSchema>;

export { toPublicAvatarUrl, buildClientAvatar } from './avatar-helpers';

const profileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  locale: true,
  timezone: true,
  role: true,
  companyId: true,
  avatarUrl: true,
  avatarType: true,
  avatarBackgroundColor: true,
  avatarTextColor: true,
  avatarInitials: true,
  avatarShape: true,
  theme: true,
  googleId: true,
  authProvider: true,
} as const;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

function mapToClient(user: ProfileRow) {
  const avatar = buildClientAvatar(user);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    locale: user.locale,
    timezone: user.timezone,
    role: user.role,
    companyId: user.companyId,
    avatar,
    avatar_url: legacyAvatarUrlFrom(avatar),
    language: user.locale === 'en' ? 'en' : 'es',
    theme: user.theme,
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });
    if (!user) throw new UnauthorizedError();
    return mapToClient(user);
  }

  async updateProfile(userId: string, data: UpdateExtended) {
    const update: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      locale?: string | null;
      timezone?: string | null;
      theme?: Theme;
    } = {};

    if (data.firstName !== undefined) update.firstName = data.firstName;
    if (data.lastName !== undefined) update.lastName = data.lastName;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.timezone !== undefined) update.timezone = data.timezone;
    if (data.theme !== undefined) update.theme = data.theme as Theme;
    if (data.language !== undefined) update.locale = data.language;

    const user = await prisma.user.update({
      where: { id: userId },
      data: update,
      select: profileSelect,
    });

    return mapToClient(user);
  }

  async changeEmail(userId: string, data: ChangeEmail) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError();

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) throw new ValidationError('Contraseña incorrecta');

    const taken = await prisma.user.findUnique({ where: { email: data.new_email } });
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
    const prev = await prisma.user.findUnique({ where: { id: userId } });
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
}
