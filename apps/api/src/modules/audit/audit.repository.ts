import prisma from '../../infrastructure/db';
import { Prisma } from '@prisma/client';

export class AuditLogRepository {
  async create(data: Prisma.AuditLogUncheckedCreateInput) {
    return prisma.auditLog.create({ data });
  }

  async findMany(args: Prisma.AuditLogFindManyArgs) {
    return prisma.auditLog.findMany(args);
  }
}
