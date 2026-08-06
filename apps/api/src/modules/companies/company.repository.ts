import prisma from '../../infrastructure/db';
import { Prisma } from '@prisma/client';

export class CompanyRepository {
  async create(data: Prisma.CompanyCreateInput) {
    return prisma.company.create({ data });
  }

  async findById(id: string) {
    return prisma.company.findUnique({ where: { id } });
  }

  async findBySlug(slug: string) {
    return prisma.company.findUnique({ where: { slug } });
  }

  async update(id: string, data: Prisma.CompanyUpdateInput) {
    return prisma.company.update({ where: { id }, data });
  }

  async findMany(args: Prisma.CompanyFindManyArgs) {
    return prisma.company.findMany(args);
  }
}
