import { Router } from 'express';
import { handleScrapeRequest, handleGetDealsRequest, handleGetStatsRequest, handleClearDealsRequest, handleGetOperatorsRequest, handleToggleFairplayRequest, handleUpdateOperatorSimPriceRequest } from '../controllers/scrape.controller';
import { basicAuthMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// POST /scrape
router.post('/scrape', basicAuthMiddleware, handleScrapeRequest);

// GET /deals
router.get('/deals', handleGetDealsRequest);

// GET /stats
router.get('/stats', handleGetStatsRequest);

// DELETE /clear
router.delete('/clear', basicAuthMiddleware, handleClearDealsRequest);

// GET /operators
router.get('/operators', handleGetOperatorsRequest);

// PUT /operators/:name/fairplay
router.put('/operators/:name/fairplay', basicAuthMiddleware, handleToggleFairplayRequest);

// PUT /operators/:name/simprice - Modifier le prix SIM d'un opérateur
router.put('/operators/:name/simprice', basicAuthMiddleware, handleUpdateOperatorSimPriceRequest);

export default router; 