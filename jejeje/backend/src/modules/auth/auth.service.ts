import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../infrastructure/db';
import { config } from '../../common/config';
import { logger } from '../../common/logger';
import { UnauthorizedError, ForbiddenError, ValidationError } from '../../common/errors/AppError';
import { ProfileService, toPublicAvatarUrl } from '../profile/profile.service';

const profileService = new ProfileService();

export class AuthService {
  async login(email: string, password: string, ipAddress?: string, userAgent?: string, deviceName?: string) {
    const user = await prisma.user.findUnique({ where: { email }, include: { company: true } });

    if (!user) throw new UnauthorizedError('Credenciales inválidas');
    if (user.status === 'SUSPENDED') throw new ForbiddenError('USER_SUSPENDED');
    if (user.status === 'LOCKED') throw new ForbiddenError('USER_LOCKED');
    if (user.status === 'DELETED') throw new ForbiddenError('USER_DELETED');
    if (user.company && user.company.status !== 'ACTIVE') throw new ForbiddenError('COMPANY_SUSPENDED');

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: { increment: 1 } },
      });

      if (updatedUser.failedLoginAttempts >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: 'LOCKED', lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
        });
        await prisma.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: 'USER_LOCKED' }
        });
      }

      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          companyId: user.companyId,
          action: 'AUTH_LOGIN_FAILED',
          targetType: 'USER',
          targetId: user.id,
          ipAddress,
          userAgent,
          result: 'FAILURE',
        }
      });

      throw new UnauthorizedError('Credenciales inválidas');
    }

    // Reset failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
    });

    const refreshTokenId = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshTokenId, 10);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        companyId: user.companyId,
        refreshTokenHash,
        ipAddress,
        userAgent,
        deviceName,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      },
    });

    const refreshToken = `${session.id}:${refreshTokenId}`;

    const accessToken = jwt.sign(
      { userId: user.id, sessionId: session.id },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        companyId: user.companyId,
        action: 'AUTH_LOGIN_SUCCESS',
        targetType: 'USER',
        targetId: user.id,
        ipAddress,
        userAgent,
        result: 'SUCCESS',
      }
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar_url: toPublicAvatarUrl(user.avatarUrl),
        theme: user.theme,
      },
    };
  }

  async logout(sessionId: string) {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
      include: { user: true }
    });

    if (session && session.user) {
      await prisma.auditLog.create({
        data: {
          actorUserId: session.userId,
          actorRole: session.user.role,
          companyId: session.companyId,
          action: 'AUTH_LOGOUT',
          targetType: 'SESSION',
          targetId: sessionId,
          result: 'SUCCESS',
        }
      });
    }
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const [sessionId, refreshTokenId] = refreshToken.split(':');
    if (!sessionId || !refreshTokenId) throw new UnauthorizedError('INVALID_REFRESH_TOKEN');

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { include: { company: true } } }
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedError('INVALID_REFRESH_TOKEN');
    }

    const isValid = await bcrypt.compare(refreshTokenId, session.refreshTokenHash);
    if (!isValid) throw new UnauthorizedError('INVALID_REFRESH_TOKEN');

    const user = session.user;
    if (user.status !== 'ACTIVE') throw new ForbiddenError('USER_SUSPENDED');
    if (user.company && user.company.status !== 'ACTIVE') throw new ForbiddenError('COMPANY_SUSPENDED');

    const newRefreshTokenId = uuidv4();
    const newRefreshTokenHash = await bcrypt.hash(newRefreshTokenId, 10);

    // Rotar token actualizando la sesión
    await prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        lastSeenAt: new Date(),
        ipAddress,
        userAgent
      }
    });

    const accessToken = jwt.sign(
      { userId: user.id, sessionId: session.id },
      config.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        companyId: user.companyId,
        action: 'AUTH_REFRESH_SUCCESS',
        targetType: 'USER',
        targetId: user.id,
        ipAddress,
        userAgent,
        result: 'SUCCESS',
      }
    });

    return { accessToken, refreshToken: `${session.id}:${newRefreshTokenId}` };
  }

  async getProfile(userId: string) {
    return profileService.getProfile(userId);
  }

  async updateProfile(userId: string, data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    locale?: 'es' | 'en';
    timezone?: string;
    theme?: 'LIGHT' | 'DARK' | 'SYSTEM';
  }) {
    return profileService.updateProfile(userId, {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      language: data.locale,
      timezone: data.timezone,
      theme: data.theme,
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError();

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new ValidationError('Contraseña actual incorrecta');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'PASSWORD_CHANGED' }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        companyId: user.companyId,
        action: 'AUTH_PASSWORD_CHANGED',
        targetType: 'USER',
        targetId: user.id,
        result: 'SUCCESS',
      }
    });

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async requestPasswordReset(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'ACTIVE') {
      // Return success anyway to avoid email enumeration
      return { message: 'Si el correo existe, se ha enviado un enlace de recuperación.' };
    }

    const token = uuidv4();
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        companyId: user.companyId,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        targetType: 'USER',
        targetId: user.id,
        result: 'SUCCESS',
      }
    });

    // TODO: Send email
    logger.info(`Password reset token for ${email}: ${token}`);

    return { message: 'Si el correo existe, se ha enviado un enlace de recuperación.' };
  }

  async verifyResetToken(token: string) {
    const tokens = await prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    let validToken = null;
    let user = null;

    for (const t of tokens) {
      const isValid = await bcrypt.compare(token, t.tokenHash);
      if (isValid) {
        validToken = t;
        user = t.user;
        break;
      }
    }

    if (!validToken || !user) throw new ValidationError('Token inválido o expirado');

    return { valid: true, userId: user.id };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokens = await prisma.passwordResetToken.findMany({
      where: {
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: true }
    });

    let validToken = null;
    let user = null;

    for (const t of tokens) {
      const isValid = await bcrypt.compare(token, t.tokenHash);
      if (isValid) {
        validToken = t;
        user = t.user;
        break;
      }
    }

    if (!validToken || !user) throw new ValidationError('Token inválido o expirado');

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
      }),
      prisma.passwordResetToken.update({
        where: { id: validToken.id },
        data: { usedAt: new Date() }
      }),
      // Revoke all active sessions
      prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' }
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          companyId: user.companyId,
          action: 'AUTH_PASSWORD_RESET_COMPLETED',
          targetType: 'USER',
          targetId: user.id,
          result: 'SUCCESS',
        }
      })
    ]);

    return { message: 'Contraseña actualizada exitosamente' };
  }
}
