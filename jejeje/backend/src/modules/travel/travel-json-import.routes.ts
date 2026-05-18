import { Router } from 'express';
import multer from 'multer';
import { ValidationError } from '../../common/errors/AppError';
import { requireAuth } from '../../common/middlewares/auth';
import { getTravelJsonImportMaxBytes } from '../../services/travel/travel-json-import-parse';
import { TravelJsonImportController } from './travel-json-import.controller';

const maxBytes = getTravelJsonImportMaxBytes();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const okMime = file.mimetype === 'application/json' || file.mimetype === 'text/json';
    const okExt = name.endsWith('.json');
    if (okMime || okExt) {
      cb(null, true);
      return;
    }
    cb(new ValidationError('Solo se admiten archivos .json'));
  },
});

const router = Router();
const c = new TravelJsonImportController();

router.use(requireAuth);
router.post('/upload', upload.single('file'), c.upload.bind(c));
router.post('/paste', c.paste.bind(c));
router.get('/batches', c.listBatches.bind(c));
router.get('/batches/:batchId', c.getBatch.bind(c));
router.patch('/items/:itemId', c.patchItem.bind(c));
router.post('/batches/:batchId/import', c.importBatch.bind(c));
router.delete('/batches/:batchId', c.deleteBatch.bind(c));

export default router;
