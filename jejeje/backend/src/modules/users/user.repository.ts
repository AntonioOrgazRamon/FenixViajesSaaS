import prisma from '../../infrastructure/db';
import { Prisma } from '@prisma/client';

export class UserRepository {
  async create(data: Prisma.UserCreateInput | Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({ data });
  }

  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  }

  async findMany(args: Prisma.UserFindManyArgs) {
    return prisma.user.findMany(args);
  }
}
