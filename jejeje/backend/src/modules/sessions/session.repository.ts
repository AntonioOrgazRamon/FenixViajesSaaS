import prisma from '../../infrastructure/db';
import { Prisma } from '@prisma/client';

export class SessionRepository {
  async create(data: Prisma.SessionUncheckedCreateInput) {
    return prisma.session.create({ data });
  }

  async findById(id: string) {
    return prisma.session.findUnique({ where: { id } });
  }

  async revoke(id: string, reason?: string) {
    return prisma.session.update({
      where: { id },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async findMany(args: Prisma.SessionFindManyArgs) {
    return prisma.session.findMany(args);
  }
}
