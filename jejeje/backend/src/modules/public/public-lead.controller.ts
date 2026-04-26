import { Request, Response } from 'express';
import { LeadService } from '../leads/lead.service';
import { intakeBodySchema } from '../leads/lead.schema';
import { ValidationError } from '../../common/errors/AppError';

const leadService = new LeadService();

export class PublicLeadController {
  async intake(req: Request, res: Response) {
    const parsed = intakeBodySchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Body inválido');

    const integrationHeader =
      (req.headers['x-integration-token'] as string | undefined) ??
      (req.headers['X-Integration-Token'] as string | undefined);

    const result = await leadService.createFromIntake(parsed.data, integrationHeader, req.ip, req.headers['user-agent']);

    res.status(201).json({ success: true, data: result });
  }
}
