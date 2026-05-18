import { Request, Response } from 'express';
import { SessionService } from './session.service';
import { revokeSessionSchema } from './session.schema';
import { ValidationError } from '../../common/errors/AppError';

const sessionService = new SessionService();

export class SessionController {
  async getSessions(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const sessions = await sessionService.getSessions(
      req.user!.id,
      req.user!.sessionId,
      page,
      pageSize
    );
    res.json({ success: true, data: sessions });
  }

  async revokeOtherSessions(req: Request, res: Response) {
    const result = await sessionService.revokeOtherSessions(req.user!.id, req.user!.sessionId);
    res.json({ success: true, data: result });
  }

  async revokeSession(req: Request, res: Response) {
    const parsed = revokeSessionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const result = await sessionService.revokeSession(req.params.id as string, req.user!.id, parsed.data.reason);
    res.json({ success: true, data: result });
  }

  async revokeUserSessions(req: Request, res: Response) {
    const parsed = revokeSessionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);

    const result = await sessionService.revokeUserSessions(
      req.params.userId as string,
      req.user!.id,
      req.user!.role,
      req.user!.companyId ?? null,
      parsed.data.reason
    );
    res.json({ success: true, data: result });
  }
}
