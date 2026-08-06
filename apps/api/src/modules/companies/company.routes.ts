import { Router } from 'express';
import { CompanyController } from './company.controller';
import { requireAuth, requireRole } from '../../common/middlewares/auth';

const router = Router();
const companyController = new CompanyController();

// Todos los endpoints de companies requieren ser SUPER_ADMIN
router.use(requireAuth);
router.use(requireRole(['SUPER_ADMIN']));

router.post('/', companyController.create.bind(companyController));
router.get('/', companyController.findAll.bind(companyController));
router.get('/:id', companyController.findById.bind(companyController));
router.patch('/:id', companyController.update.bind(companyController));
router.post('/:id/suspend', companyController.suspend.bind(companyController));
router.post('/:id/reactivate', companyController.reactivate.bind(companyController));
router.delete('/:id', companyController.delete.bind(companyController));

export default router;
