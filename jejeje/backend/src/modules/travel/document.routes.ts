import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../common/middlewares/auth';
import { TravelDocumentController } from './document.controller';
import { config } from '../../common/config';

const maxBytes = Math.floor(parseFloat(config.TRAVEL_PDF_MAX_MB || '80') * 1024 * 1024);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes },
});

const router = Router();
const c = new TravelDocumentController();

router.use(requireAuth);
router.post('/upload', upload.single('file'), c.upload.bind(c));
router.get('/', c.list.bind(c));
router.post('/clear', c.clearAll.bind(c));
router.get('/jobs/:jobId', c.jobStatus.bind(c));
router.delete('/:id', c.remove.bind(c));
router.get('/:id', c.getOne.bind(c));
router.post('/:id/process', c.process.bind(c));

export default router;
