import bcrypt from 'bcrypt';
import { Prisma, Role, UserStatus } from '@prisma/client';
import prisma from '../../infrastructure/db';
import { NotFoundError, ValidationError, ForbiddenError } from '../../common/errors/AppError';

const roleValues = new Set<Role>(Object.values(Role));
const statusValues = new Set<UserStatus>(Object.values(UserStatus));

function parseFilterRole(s: string | undefined): Role | undefined {
  if (!s || s.trim() === '') return undefined;
  const u = s.trim() as Role;
  return roleValues.has(u) ? u : undefined;
}

function parseFilterStatus(s: string | undefined): UserStatus | undefined {
  if (!s || s.trim() === '') return undefined;
  const u = s.trim() as UserStatus;
  return statusValues.has(u) ? u : undefined;
}

export class UserService {
  async getUsers(
    companyId: string | undefined,
    options: { role?: string; status?: string; q?: string; page: number; pageSize: number },
  ) {
    const { q, page, pageSize } = options;
    const r = parseFilterRole(options.role);
    const st = parseFilterStatus(options.status);

    const where: Prisma.UserWhereInput = {};
    if (companyId) where.companyId = companyId;
    if (r) where.role = r;
    if (st) where.status = st;

    const t = (q || '').trim();
    if (t) {
      where.OR = [
        { email: { contains: t } },
        { firstName: { contains: t } },
        { lastName: { contains: t } },
      ];
    }

    const skip = (page - 1) * pageSize;
    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          companyId: true,
          createdAt: true,
          company: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
    ]);

    return { total, page, pageSize, data };
  }

  /**
   * @param viewer — si no es SUPER_ADMIN, la actividad de auditoría se limita a la empresa del visor.
   */
  async getUserById(
    id: string,
    viewer?: { role: string; companyId: string | null },
  ) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        phone: true,
        role: true,
        status: true,
        companyId: true,
        locale: true,
        timezone: true,
        timeFormat: true,
        dateFormat: true,
        theme: true,
        authProvider: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        lockedUntil: true,
        failedLoginAttempts: true,
        avatarUrl: true,
        avatarType: true,
        avatarBackgroundColor: true,
        avatarTextColor: true,
        avatarInitials: true,
        avatarShape: true,
        company: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    const scopeCompany =
      viewer && viewer.role !== 'SUPER_ADMIN' && viewer.companyId ? viewer.companyId : null;

    const auditWhere: Prisma.AuditLogWhereInput = {
      AND: [
        {
          OR: [{ actorUserId: id }, { AND: [{ targetType: 'USER' }, { targetId: id }] }],
        },
        ...(scopeCompany
          ? [{ OR: [{ companyId: scopeCompany }, { targetCompanyId: scopeCompany }] }]
          : []),
      ],
    };

    const [
      activeSessionCount,
      lastPwdAudit,
      leadsAssignedCount,
      leadsCreatedCount,
      recentAudit,
    ] = await Promise.all([
      prisma.session.count({
        where: {
          userId: id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      prisma.auditLog.findFirst({
        where: { actorUserId: id, action: 'AUTH_PASSWORD_CHANGED' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      prisma.lead.count({
        where: {
          assignedUserId: id,
          deletedAt: null,
          ...(user.companyId ? { companyId: user.companyId } : {}),
        },
      }),
      prisma.lead.count({
        where: {
          createdByUserId: id,
          deletedAt: null,
          ...(user.companyId ? { companyId: user.companyId } : {}),
        },
      }),
      prisma.auditLog.findMany({
        where: auditWhere,
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: {
          id: true,
          action: true,
          result: true,
          createdAt: true,
          targetType: true,
          targetId: true,
          companyId: true,
        },
      }),
    ]);

    return {
      ...user,
      activeSessionCount,
      lastPasswordChangeAt: lastPwdAudit?.createdAt.toISOString() ?? null,
      leadsAssignedCount,
      leadsCreatedCount,
      recentAudit: recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        result: a.result,
        createdAt: a.createdAt.toISOString(),
        targetType: a.targetType,
        targetId: a.targetId,
        companyId: a.companyId,
      })),
    };
  }

  async createUser(data: any, actorId: string) {
    const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (existing) throw new ValidationError('El correo ya está en uso');

    const passwordHash = data.password 
      ? await bcrypt.hash(data.password, 10) 
      : await bcrypt.hash(Math.random().toString(36).slice(-8), 10); // Random password if not provided

    const user = await prisma.user.create({
      data: {
        ...data,
        passwordHash,
      },
      select: { id: true, email: true, role: true, companyId: true }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        action: 'USER_CREATED',
        targetType: 'USER',
        targetId: user.id,
        targetCompanyId: user.companyId,
        result: 'SUCCESS',
      }
    });

    return user;
  }

  async updateUser(id: string, data: any, actorId: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        companyId: true,
      },
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
      if (existing) throw new ValidationError('El correo ya está en uso');
    }

    if (user.role === 'COMPANY_ADMIN' && (data.status === 'SUSPENDED' || data.status === 'DELETED' || data.status === 'LOCKED' || (data.role && data.role !== 'COMPANY_ADMIN'))) {
      const adminCount = await prisma.user.count({
        where: { companyId: user.companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE', id: { not: id } }
      });
      if (adminCount === 0) throw new ForbiddenError('No se puede modificar al último administrador activo de la empresa');
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, role: true, status: true, companyId: true }
    });

    if (data.status === 'SUSPENDED' || data.status === 'LOCKED' || data.status === 'DELETED') {
      await prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: `USER_${data.status}` }
      });
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        action: 'USER_UPDATED',
        targetType: 'USER',
        targetId: updatedUser.id,
        targetCompanyId: updatedUser.companyId,
        result: 'SUCCESS',
      }
    });

    return updatedUser;
  }

  async deleteUser(id: string, actorId: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, companyId: true, status: true },
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    if (user.role === 'COMPANY_ADMIN') {
      const adminCount = await prisma.user.count({
        where: { companyId: user.companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE', id: { not: id } }
      });
      if (adminCount === 0) throw new ForbiddenError('No se puede eliminar al último administrador activo de la empresa');
    }

    await prisma.user.update({
      where: { id },
      data: { status: 'DELETED' }
    });

    await prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'USER_DELETED' }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        action: 'USER_DELETED',
        targetType: 'USER',
        targetId: user.id,
        targetCompanyId: user.companyId,
        result: 'SUCCESS',
      }
    });

    return { message: 'Usuario eliminado' };
  }
}
