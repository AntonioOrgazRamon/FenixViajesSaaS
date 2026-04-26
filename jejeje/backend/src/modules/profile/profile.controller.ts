import { Request, Response } from 'express';
import { ProfileService } from './profile.service';
import { avatarBodySchema, changeEmailSchema, updateProfileExtendedSchema } from './profile.schema';
import { ValidationError } from '../../common/errors/AppError';

const profileService = new ProfileService();

export class ProfileController {
  async get(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const data = await profileService.getProfile(req.user.id);
    res.json({ success: true, data });
  }

  async patch(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const parsed = updateProfileExtendedSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    const data = await profileService.updateProfile(req.user.id, parsed.data);
    res.json({ success: true, data });
  }

  async patchEmail(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const parsed = changeEmailSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    const data = await profileService.changeEmail(req.user.id, parsed.data);
    res.json({ success: true, data });
  }

  async postAvatar(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const parsed = avatarBodySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');
    const data = await profileService.setAvatarUrl(req.user.id, parsed.data.avatarUrl);
    res.json({ success: true, data });
  }

  async postAvatarUpload(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    if (!req.file) throw new ValidationError('Selecciona un archivo de imagen');
    const data = await profileService.setAvatarFromFile(req.user.id, req.file);
    res.json({ success: true, data });
  }

  async deleteAvatar(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const data = await profileService.deleteAvatar(req.user.id);
    res.json({ success: true, data });
  }

  async linkGoogleStub(_req: Request, res: Response) {
    res.status(501).json({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Vinculación con Google no disponible en este entorno' },
    });
  }

  async unlinkGoogleStub(_req: Request, res: Response) {
    res.status(501).json({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Desvinculación de Google no disponible en este entorno' },
    });
  }
}
