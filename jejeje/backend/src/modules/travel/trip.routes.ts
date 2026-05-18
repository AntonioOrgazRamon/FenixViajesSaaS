import { Router } from 'express';
import { requireAuth } from '../../common/middlewares/auth';
import { travelEmbeddingAdminLimiter } from '../../common/middlewares/embedding-admin-limiter';
import { TravelTripController } from './trip.controller';
import { TravelEmbeddingAdminController } from './travel-embedding-admin.controller';

const router = Router();
const c = new TravelTripController();
const embAdmin = new TravelEmbeddingAdminController();

router.use(requireAuth);
router.get('/search', c.search.bind(c));
router.post('/search-intent', c.searchIntent.bind(c));
router.get('/recommendation-runs/:runId', c.getRecommendationRun.bind(c));
router.post('/leads/:leadId/proposal', c.attachLeadProposal.bind(c));

router.get('/embeddings/status', travelEmbeddingAdminLimiter, embAdmin.embeddingsStatus.bind(embAdmin));
router.post('/embeddings/rebuild', travelEmbeddingAdminLimiter, embAdmin.rebuildEmbeddings.bind(embAdmin));
router.post('/retrieval/preview', travelEmbeddingAdminLimiter, embAdmin.retrievalPreview.bind(embAdmin));

router.get('/', c.list.bind(c));
router.post('/manual', c.createManual.bind(c));
router.post(
  '/:tripId/embedding/regenerate',
  travelEmbeddingAdminLimiter,
  embAdmin.regenerateTripEmbedding.bind(embAdmin),
);

router.get('/:id', c.getOne.bind(c));
router.patch('/:id', c.patch.bind(c));
router.post('/:id/approve', c.approve.bind(c));
router.post('/:id/reject', c.reject.bind(c));

export default router;
