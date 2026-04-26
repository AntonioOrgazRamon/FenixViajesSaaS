import prisma from '../../infrastructure/db';
import { NotFoundError } from '../../common/errors/AppError';

export class SessionService {
  async getSessions(userId: string, currentSessionId: string, page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    const [total, rows] = await Promise.all([
      prisma.session.count({ where: { userId } }),
      prisma.session.findMany({
        where: { userId },
        skip,
        take: pageSize,
        select: {
          id: true,
          deviceName: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const data = rows.map((s) => ({
      ...s,
      isCurrent: s.id === currentSessionId,
    }));

    return { total, page, pageSize, currentSessionId, data };
  }

  async revokeSession(sessionId: string, userId: string, reason?: string) {
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) throw new NotFoundError('Sesión no encontrada');

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedReason: reason || 'USER_REVOKED'
      }
    });

    return { message: 'Sesión revocada' };
  }

  /**
   * Revoca todas las sesiones activas del usuario excepto la indicada (normalmente la sesión del token).
   */
  async revokeOtherSessions(userId: string, keepSessionId: string) {
    await prisma.session.updateMany({
      where: {
        userId,
        id: { not: keepSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date(), revokedReason: 'USER_REVOKE_OTHERS' },
    });
    return { message: 'Se cerraron el resto de dispositivos activos.' };
  }

  async revokeUserSessions(targetUserId: string, actorUserId: string, reason?: string) {
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!targetUser) throw new NotFoundError('Usuario no encontrado');

    await prisma.session.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: reason || 'ADMIN_REVOKED'
      }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: 'SESSIONS_REVOKED',
        targetType: 'USER',
        targetId: targetUserId,
        result: 'SUCCESS'
      }
    });

    return { message: 'Sesiones revocadas' };
  }
}
