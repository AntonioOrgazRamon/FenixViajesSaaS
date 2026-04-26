import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import type { Express } from 'express';
import prisma from '../../infrastructure/db';
import { config } from '../../common/config';
import { ConflictError, UnauthorizedError, ValidationError } from '../../common/errors/AppError';
import type { z } from 'zod';
import type { updateProfileExtendedSchema, changeEmailSchema } from './profile.schema';
import { Prisma, Theme } from '@prisma/client';

type UpdateExtended = z.infer<typeof updateProfileExtendedSchema>;
type ChangeEmail = z.infer<typeof changeEmailSchema>;

const LOCAL_AVATAR_PREFIX = '/uploads/avatars/';

export function toPublicAvatarUrl(stored: string | null): string | null {
  if (!stored) return null;
  if (stored.startsWith('http://') || stored.startsWith('https://')) return stored;
  const base = config.PUBLIC_URL.replace(/\/$/, '');
  const p = stored.startsWith('/') ? stored : `/${stored}`;
  return `${base}${p}`;
}

function unlinkLocalAvatarIfAny(stored: string | null) {
  if (!stored || stored.startsWith('http://') || stored.startsWith('https://')) return;
  if (!stored.startsWith(LOCAL_AVATAR_PREFIX)) return;
  const rel = stored.replace(/^\//, '');
  const full = path.join(process.cwd(), rel);
  fs.unlink(full, () => {});
}

export class ProfileService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
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
        theme: true,
        googleId: true,
        authProvider: true,
      },
    });
    if (!user) throw new UnauthorizedError();

    const language = user.locale === 'en' ? 'en' : 'es';

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
      avatar_url: toPublicAvatarUrl(user.avatarUrl),
      language,
      theme: user.theme,
      has_google_linked: !!user.googleId,
      auth_provider: user.authProvider,
    };
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
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        locale: true,
        timezone: true,
        avatarUrl: true,
        theme: true,
        googleId: true,
        authProvider: true,
        role: true,
        companyId: true,
      },
    });

    const language = user.locale === 'en' ? 'en' : 'es';

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
      avatar_url: toPublicAvatarUrl(user.avatarUrl),
      language,
      theme: user.theme,
      has_google_linked: !!user.googleId,
      auth_provider: user.authProvider,
    };
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

  async setAvatarUrl(userId: string, avatarUrl: string) {
    const prev = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    unlinkLocalAvatarIfAny(prev?.avatarUrl ?? null);

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: 'PROFILE_AVATAR_UPDATED',
        targetType: 'USER',
        targetId: userId,
        result: 'SUCCESS',
      },
    });

    return { avatar_url: toPublicAvatarUrl(avatarUrl) };
  }

  async setAvatarFromFile(userId: string, file: Express.Multer.File) {
    const prev = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    unlinkLocalAvatarIfAny(prev?.avatarUrl ?? null);

    const relativePath = `${LOCAL_AVATAR_PREFIX}${file.filename}`;

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: relativePath },
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

    return { avatar_url: toPublicAvatarUrl(relativePath) };
  }

  async deleteAvatar(userId: string) {
    const prev = await prisma.user.findUnique({ where: { id: userId }, select: { avatarUrl: true } });
    unlinkLocalAvatarIfAny(prev?.avatarUrl ?? null);

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
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

    return { avatar_url: null as string | null };
  }
}
