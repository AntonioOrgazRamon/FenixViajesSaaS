import { Router } from 'express';
import { ProfileController } from './profile.controller';
import { uploadAvatarMiddleware } from './profile.upload';
import { requireAuth } from '../../common/middlewares/auth';

const router = Router();
const c = new ProfileController();

router.use(requireAuth);

router.get('/', c.get.bind(c));
router.patch('/', c.patch.bind(c));
router.patch('/email', c.patchEmail.bind(c));
router.post('/avatar/upload', uploadAvatarMiddleware.single('file'), c.postAvatarUpload.bind(c));
router.post('/avatar', c.postAvatar.bind(c));
router.delete('/avatar', c.deleteAvatar.bind(c));
router.post('/link-google', c.linkGoogleStub.bind(c));
router.post('/unlink-google', c.unlinkGoogleStub.bind(c));

export default router;
