import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../infrastructure/db';
import { config } from '../../common/config';
import { logger } from '../../common/logger';
import { UnauthorizedError, ForbiddenError, ValidationError } from '../../common/errors/AppError';
import { ProfileService } from '../profile/profile.service';
import { buildClientAvatar, legacyAvatarUrlFrom } from '../profile/avatar-helpers';
import {
  createPasswordResetTokenPlain,
  hashPasswordResetToken,
} from '../../common/crypto/tokenHash';
import { validateNewPasswordForReset } from '../../common/validation/passwordPolicy';
import { sendPasswordResetEmail } from '../../infrastructure/email/email.service';
import {
  notePasswordResetEvent,
  shouldBlockPasswordResetEmail,
} from './passwordResetRateLimit';
import { AuthProvider, CompanyStatus, UserStatus } from '@prisma/client';
import type { z } from 'zod';
import { updateProfileExtendedSchema } from '../profile/profile.schema';
import { companyListSelect, userCoreNoPreferenceColumns } from '../../common/prisma/userSelects';

const profileService = new ProfileService();

type UpdateProfileBody = z.infer<typeof updateProfileExtendedSchema>;

const GENERIC_FORGOT_RESPONSE = {
  message: 'Si el correo existe en nuestro sistema, recibirás un enlace para restablecer tu contraseña.',
};
const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const OAUTH_STATE_TTL_SECONDS = 5 * 60;

type GoogleIdTokenClaims = {
  sub: string;
  email: string;
  email_verified: 'true' | 'false';
  given_name?: string;
  family_name?: string;
  hd?: string;
};
type OAuthBridgePayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};
const googleBridgeStore = new Map<string, OAuthBridgePayload>();

function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

function canRequestPasswordForUser(u: {
  status: UserStatus;
  authProvider: AuthProvider;
  lockedUntil: Date | null;
  company: { status: CompanyStatus } | null;
}) {
  if (u.status !== 'ACTIVE') return false;
  if (u.lockedUntil && u.lockedUntil > new Date()) return false;
  if (u.company && u.company.status !== CompanyStatus.ACTIVE) return false;
  if (u.authProvider === 'GOOGLE') return false;
  return true;
}

/**
 * Misma lógica que "login" para comprobar si la nueva clave es la actual: verify contra el hash, no string compare.
 */
async function isSameAsCurrentPassword(plain: string, passwordHash: string) {
  return bcrypt.compare(plain, passwordHash);
}

function genericResetLinkError() {
  return new ValidationError(
    'El enlace no es válido o ha caducado. Solicita uno nuevo en «He olvidado mi contraseña».'
  );
}

export class AuthService {
  consumeGoogleBridgeCode(code: string) {
    const rec = googleBridgeStore.get(code);
    if (!rec) throw new UnauthorizedError('Código OAuth inválido o expirado');
    googleBridgeStore.delete(code);
    if (rec.expiresAt < Date.now()) {
      throw new UnauthorizedError('Código OAuth expirado');
    }
    return { accessToken: rec.accessToken, refreshToken: rec.refreshToken };
  }

  private ensureGoogleConfigured() {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REDIRECT_URI) {
      throw new ValidationError('Google OAuth no está configurado en el servidor');
    }
  }

  private signGoogleState() {
    const stateSecret = config.GOOGLE_OAUTH_STATE_SECRET || config.JWT_SECRET;
    return jwt.sign({ nonce: uuidv4() }, stateSecret, { expiresIn: OAUTH_STATE_TTL_SECONDS });
  }

  private verifyGoogleState(state: string) {
    const stateSecret = config.GOOGLE_OAUTH_STATE_SECRET || config.JWT_SECRET;
    try {
      jwt.verify(state, stateSecret);
    } catch {
      throw new UnauthorizedError('Estado OAuth inválido o expirado');
    }
  }

  private async issueSessionForUser(
    user: {
      id: string;
      companyId: string | null;
      role: string;
      email: string;
      firstName: string;
      lastName: string;
      theme: 'LIGHT' | 'DARK' | 'SYSTEM';
      avatarType: 'DEFAULT' | 'UPLOADED';
      avatarUrl: string | null;
      avatarInitials: string | null;
      avatarBackgroundColor: string | null;
      avatarTextColor: string | null;
      avatarShape: 'CIRCLE' | 'ROUNDED' | 'SQUARE';
    },
    ipAddress?: string,
    userAgent?: string,
    deviceName?: string
  ) {
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
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const refreshToken = `${session.id}:${refreshTokenId}`;
    const accessToken = jwt.sign({ userId: user.id, sessionId: session.id }, config.JWT_SECRET, { expiresIn: '15m' });
    const avatar = buildClientAvatar(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        theme: user.theme,
        avatar,
        avatar_url: legacyAvatarUrlFrom(avatar),
      },
    };
  }

  getGoogleStartUrl() {
    this.ensureGoogleConfigured();
    const state = this.signGoogleState();
    const params = new URLSearchParams({
      client_id: config.GOOGLE_CLIENT_ID!,
      redirect_uri: config.GOOGLE_REDIRECT_URI!,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    if (config.GOOGLE_ALLOWED_HOSTED_DOMAIN) {
      params.set('hd', config.GOOGLE_ALLOWED_HOSTED_DOMAIN);
    }
    return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`;
  }

  async loginWithGoogle(code: string, state: string, ipAddress?: string, userAgent?: string) {
    this.ensureGoogleConfigured();
    this.verifyGoogleState(state);

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.GOOGLE_CLIENT_ID!,
        client_secret: config.GOOGLE_CLIENT_SECRET!,
        redirect_uri: config.GOOGLE_REDIRECT_URI!,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!tokenRes.ok) throw new UnauthorizedError('No se pudo completar OAuth con Google');

    const tokenBody = (await tokenRes.json()) as { id_token?: string };
    if (!tokenBody.id_token) throw new UnauthorizedError('Google no devolvió id_token');

    const infoRes = await fetch(`${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(tokenBody.id_token)}`);
    if (!infoRes.ok) throw new UnauthorizedError('No se pudo validar identidad con Google');
    const claims = (await infoRes.json()) as GoogleIdTokenClaims & { aud?: string };

    if (claims.aud !== config.GOOGLE_CLIENT_ID) throw new UnauthorizedError('Token de Google inválido para esta app');
    if (claims.email_verified !== 'true' || !claims.email) throw new UnauthorizedError('Cuenta de Google sin email verificado');
    if (config.GOOGLE_ALLOWED_HOSTED_DOMAIN && claims.hd !== config.GOOGLE_ALLOWED_HOSTED_DOMAIN) {
      throw new ForbiddenError('Dominio de Google no permitido');
    }

    const email = normalizeEmail(claims.email);
    const googleSub = claims.sub;

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: googleSub }, { email }],
      },
      select: {
        ...userCoreNoPreferenceColumns,
        company: { select: companyListSelect },
      },
    });

    if (!user) {
      throw new UnauthorizedError('No existe una cuenta permitida para este correo en la plataforma');
    }
    if (user.status === 'SUSPENDED') throw new ForbiddenError('USER_SUSPENDED');
    if (user.status === 'LOCKED') throw new ForbiddenError('USER_LOCKED');
    if (user.status === 'DELETED') throw new ForbiddenError('USER_DELETED');
    if (user.company && user.company.status !== 'ACTIVE') throw new ForbiddenError('COMPANY_SUSPENDED');
    if (user.googleId && user.googleId !== googleSub) throw new UnauthorizedError('Cuenta de Google no vinculada con este usuario');

    const nextAuthProvider =
      user.authProvider === AuthProvider.LOCAL ? AuthProvider.LOCAL_GOOGLE : AuthProvider.GOOGLE;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: googleSub,
        authProvider: nextAuthProvider,
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        firstName: user.firstName || claims.given_name || user.firstName,
        lastName: user.lastName || claims.family_name || user.lastName,
      },
    });

    user = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        ...userCoreNoPreferenceColumns,
        company: { select: companyListSelect },
      },
    });
    if (!user) throw new UnauthorizedError('Usuario no encontrado');

    const result = await this.issueSessionForUser(
      user,
      ipAddress,
      userAgent,
      `google-oauth:${claims.hd ?? 'external'}`
    );

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
        reason: 'google_oauth',
      },
    });

    return result;
  }

  createGoogleBridgeCode(payload: { accessToken: string; refreshToken: string }) {
    const code = uuidv4();
    googleBridgeStore.set(code, {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      expiresAt: Date.now() + 60 * 1000,
    });
    return code;
  }

  async login(email: string, password: string, ipAddress?: string, userAgent?: string, deviceName?: string) {
    const user = await prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
      select: {
        ...userCoreNoPreferenceColumns,
        company: { select: companyListSelect },
      },
    });

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

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
    });

    const result = await this.issueSessionForUser(user, ipAddress, userAgent, deviceName);
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

    return result;
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
      include: {
        user: {
          select: {
            ...userCoreNoPreferenceColumns,
            company: { select: companyListSelect },
          },
        },
      },
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

  async updateProfile(userId: string, data: UpdateProfileBody) {
    return profileService.updateProfile(userId, data);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, companyId: true, role: true, email: true },
    });
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

  async requestPasswordReset(email: string, ipAddress?: string, userAgent?: string) {
    const key = normalizeEmail(email);
    const block = shouldBlockPasswordResetEmail(key);
    if (block.blocked) {
      await prisma.auditLog.create({
        data: {
          companyId: null,
          action: 'AUTH_PASSWORD_RESET_REQUESTED',
          targetType: 'EMAIL',
          targetId: 'unknown',
          result: 'FAILURE',
          reason: block.reason,
          ipAddress,
          userAgent,
        },
      });
      return GENERIC_FORGOT_RESPONSE;
    }

    const user = await prisma.user.findUnique({
      where: { email: key },
      select: {
        ...userCoreNoPreferenceColumns,
        company: { select: { status: true } },
      },
    });

    if (!user) {
      await prisma.auditLog.create({
        data: {
          companyId: null,
          action: 'AUTH_PASSWORD_RESET_REQUESTED',
          targetType: 'EMAIL',
          targetId: '00000000-0000-0000-0000-000000000000',
          result: 'SUCCESS',
          reason: 'no_user',
          ipAddress,
          userAgent,
        },
      });
      notePasswordResetEvent(key);
      return GENERIC_FORGOT_RESPONSE;
    }

    if (!canRequestPasswordForUser({ ...user, company: user.company, lockedUntil: user.lockedUntil })) {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          companyId: user.companyId,
          action: 'AUTH_PASSWORD_RESET_REQUESTED',
          targetType: 'USER',
          targetId: user.id,
          result: 'FAILURE',
          reason: 'user_not_eligible',
          ipAddress,
          userAgent,
        },
      });
      notePasswordResetEvent(key);
      return GENERIC_FORGOT_RESPONSE;
    }

    const plain = createPasswordResetTokenPlain();
    const tokenHash = hashPasswordResetToken(plain);
    const expiresAt = new Date(
      Date.now() + config.PASSWORD_RESET_TTL_MINUTES * 60 * 1000
    );

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          requestedIp: ipAddress,
          userAgent: userAgent ?? null,
        },
      }),
    ]);

    const path = `/reset-password/${encodeURIComponent(plain)}`;
    const result = await sendPasswordResetEmail(user.email, path);

    if (result.sent) {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          companyId: user.companyId,
          action: 'AUTH_PASSWORD_RESET_EMAIL_SENT',
          targetType: 'USER',
          targetId: user.id,
          result: 'SUCCESS',
        },
      });
    } else {
      logger.error(
        { userId: user.id, err: !result.sent ? result.error : null },
        'No se pudo completar el envío del enlace; el usuario no debe verlo'
      );
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          companyId: user.companyId,
          action: 'AUTH_PASSWORD_RESET_EMAIL_FAILED',
          targetType: 'USER',
          targetId: user.id,
          result: 'FAILURE',
          reason: !result.sent ? result.error : undefined,
        },
      });
    }

    notePasswordResetEvent(key);
    return GENERIC_FORGOT_RESPONSE;
  }

  private async getPasswordResetByPlainToken(plain: string) {
    const tokenHash = hashPasswordResetToken(plain);
    return prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            ...userCoreNoPreferenceColumns,
            company: { select: { status: true } },
          },
        },
      },
    });
  }

  async verifyResetToken(plain: string) {
    const rec = await this.getPasswordResetByPlainToken(plain);
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
      return { valid: false as const };
    }
    const { user } = rec;
    if (!user || !canRequestPasswordForUser({ ...user, company: user.company, lockedUntil: user.lockedUntil })) {
      return { valid: false as const };
    }
    return { valid: true as const };
  }

  async resetPassword(plain: string, newPassword: string, confirmPassword: string) {
    if (newPassword !== confirmPassword) {
      throw new ValidationError('Las contraseñas no coinciden');
    }

    const rec = await this.getPasswordResetByPlainToken(plain);

    if (!rec) {
      await prisma.auditLog.create({
        data: {
          companyId: null,
          action: 'AUTH_PASSWORD_RESET_FAILED',
          targetType: 'PASSWORD_RESET_TOKEN',
          targetId: 'invalid',
          result: 'FAILURE',
          reason: 'token_not_found',
        },
      });
      throw genericResetLinkError();
    }

    if (rec.usedAt || rec.expiresAt < new Date()) {
      await prisma.auditLog.create({
        data: {
          actorUserId: rec.userId,
          companyId: rec.user?.companyId,
          action: 'AUTH_PASSWORD_RESET_FAILED',
          targetType: 'PASSWORD_RESET_TOKEN',
          targetId: rec.id,
          result: 'FAILURE',
          reason: rec.usedAt ? 'token_used' : 'expired',
        },
      });
      throw genericResetLinkError();
    }

    const user = rec.user;
    if (!user) {
      throw genericResetLinkError();
    }
    if (!canRequestPasswordForUser({ ...user, company: user.company, lockedUntil: user.lockedUntil })) {
      throw genericResetLinkError();
    }

    const sameAsCurrent = await isSameAsCurrentPassword(newPassword, user.passwordHash);
    if (sameAsCurrent) {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          companyId: user.companyId,
          action: 'AUTH_PASSWORD_RESET_FAILED',
          targetType: 'USER',
          targetId: user.id,
          result: 'FAILURE',
          reason: 'same_as_current',
        },
      });
      throw new ValidationError('La nueva contraseña no puede ser igual a la anterior');
    }

    const policy = validateNewPasswordForReset(newPassword);
    if (!policy.ok) {
      await prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          companyId: user.companyId,
          action: 'AUTH_PASSWORD_RESET_FAILED',
          targetType: 'USER',
          targetId: user.id,
          result: 'FAILURE',
          reason: 'weak_password',
        },
      });
      throw new ValidationError('La contraseña no cumple los requisitos mínimos de seguridad.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      prisma.passwordResetToken.update({
        where: { id: rec.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, id: { not: rec.id } },
      }),
      prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' },
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
        },
      }),
      prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          companyId: user.companyId,
          action: 'AUTH_PASSWORD_CHANGED',
          targetType: 'USER',
          targetId: user.id,
          result: 'SUCCESS',
          reason: 'via_password_reset',
        },
      }),
    ]);

    return {
      message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.',
    };
  }
}
