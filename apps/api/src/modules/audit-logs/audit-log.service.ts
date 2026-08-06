import prisma from '../../infrastructure/db';

export class AuditLogService {
  async getAuditLogs(filters: any, page: number, pageSize: number) {
    const where: any = {};
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.actorUserId) where.actorUserId = filters.actorUserId;
    if (filters.action) where.action = filters.action;

    const skip = (page - 1) * pageSize;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip,
        include: {
          actorUser: { select: { email: true, firstName: true, lastName: true } },
          company: { select: { name: true } }
        }
      }),
      prisma.auditLog.count({ where })
    ]);

    return { total, page, pageSize, data: logs };
  }
}
