import { Router } from 'express';
import { UserController } from './user.controller';
import { requireAuth, requireRole } from '../../common/middlewares/auth';

const router = Router();
const userController = new UserController();

router.use(requireAuth);

router.get(
  '/',
  requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_USER']),
  userController.getUsers.bind(userController),
);

router.use(requireRole(['SUPER_ADMIN', 'COMPANY_ADMIN']));

router.get('/:id', userController.getUserById.bind(userController));
router.post('/', userController.createUser.bind(userController));
router.patch('/:id', userController.updateUser.bind(userController));
router.delete('/:id', userController.deleteUser.bind(userController));

export default router;
