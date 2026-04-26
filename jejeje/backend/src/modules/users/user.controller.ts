import { Request, Response } from 'express';
import { UserService } from './user.service';
import { createUserSchema, updateUserSchema } from './user.schema';
import { ValidationError, ForbiddenError } from '../../common/errors/AppError';

const userService = new UserService();

export class UserController {
  async getUsers(req: Request, res: Response) {
    const { companyId, role } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    
    let targetCompanyId = companyId as string;
    if (req.user?.role === 'COMPANY_ADMIN' || req.user?.role === 'COMPANY_USER') {
      targetCompanyId = req.user.companyId!;
    }

    const users = await userService.getUsers(targetCompanyId, role as string, page, pageSize);
    res.json({ success: true, data: users });
  }

  async getUserById(req: Request, res: Response) {
    const user = await userService.getUserById(req.params.id as string);
    
    if (req.user?.role === 'COMPANY_ADMIN' && user.companyId !== req.user.companyId) {
      throw new ForbiddenError('No tienes permiso para ver este usuario');
    }

    res.json({ success: true, data: user });
  }

  async createUser(req: Request, res: Response) {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const data = parsed.data;
    if (req.user?.role === 'COMPANY_ADMIN') {
      data.companyId = req.user.companyId!; // Forzar companyId
      if (data.role === 'SUPER_ADMIN') throw new ForbiddenError('No puedes crear un SUPER_ADMIN');
    }

    const user = await userService.createUser(data, req.user!.id);
    res.status(201).json({ success: true, data: user });
  }

  async updateUser(req: Request, res: Response) {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const data = parsed.data;
    if (req.user?.role === 'COMPANY_ADMIN') {
      delete data.role;
      delete data.companyId;
    }

    const targetUser = await userService.getUserById(req.params.id as string);
    if (req.user?.role === 'COMPANY_ADMIN' && targetUser.companyId !== req.user.companyId) {
      throw new ForbiddenError('No tienes permiso para editar este usuario');
    }

    const user = await userService.updateUser(req.params.id as string, data, req.user!.id);
    res.json({ success: true, data: user });
  }

  async deleteUser(req: Request, res: Response) {
    const targetUser = await userService.getUserById(req.params.id as string);
    if (req.user?.role === 'COMPANY_ADMIN' && targetUser.companyId !== req.user.companyId) {
      throw new ForbiddenError('No tienes permiso para eliminar este usuario');
    }

    const result = await userService.deleteUser(req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  }
}
