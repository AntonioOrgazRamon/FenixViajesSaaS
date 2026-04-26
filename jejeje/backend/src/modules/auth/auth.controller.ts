import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { loginSchema, refreshSchema, updateProfileSchema, changePasswordSchema, requestPasswordResetSchema, verifyResetTokenSchema, resetPasswordSchema } from './auth.schema';
import { ValidationError } from '../../common/errors/AppError';

const authService = new AuthService();

export class AuthController {
  async login(req: Request, res: Response) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const { email, password, deviceName } = parsed.data;
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(email, password, ipAddress, userAgent, deviceName);
    res.json({ success: true, data: result });
  }

  async logout(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    await authService.logout(req.user.sessionId);
    res.json({ success: true, data: { message: 'Logout exitoso' } });
  }

  async refresh(req: Request, res: Response) {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await authService.refresh(parsed.data.refreshToken, ipAddress, userAgent);
    res.json({ success: true, data: result });
  }

  async me(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const profile = await authService.getProfile(req.user.id);
    res.json({ success: true, data: profile });
  }

  async getProfile(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const profile = await authService.getProfile(req.user.id);
    res.json({ success: true, data: profile });
  }

  async updateProfile(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const profile = await authService.updateProfile(req.user.id, parsed.data);
    res.json({ success: true, data: profile });
  }

  async changePassword(req: Request, res: Response) {
    if (!req.user) throw new ValidationError('No autenticado');
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const result = await authService.changePassword(req.user.id, parsed.data.currentPassword, parsed.data.newPassword);
    res.json({ success: true, data: result });
  }

  async requestPasswordReset(req: Request, res: Response) {
    const parsed = requestPasswordResetSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const result = await authService.requestPasswordReset(
      parsed.data.email,
      req.ip,
      req.get('user-agent') || undefined
    );
    res.json({ success: true, data: result });
  }

  async verifyResetToken(req: Request, res: Response) {
    const parsed = verifyResetTokenSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const result = await authService.verifyResetToken(parsed.data.token);
    res.json({ success: true, data: result });
  }

  async resetPassword(req: Request, res: Response) {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const result = await authService.resetPassword(
      parsed.data.token,
      parsed.data.newPassword,
      parsed.data.confirmPassword
    );
    res.json({ success: true, data: result });
  }
}
