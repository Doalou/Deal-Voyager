import { Router } from 'express';
import { handleScrapeRequest, handleGetDealsRequest, handleGetStatsRequest, handleClearDealsRequest, handleGetOperatorsRequest, handleToggleFairplayRequest, handleUpdateOperatorSimPriceRequest } from '../controllers/scrape.controller';

const router = Router();

// POST /scrape
router.post('/scrape', handleScrapeRequest);

// GET /deals
router.get('/deals', handleGetDealsRequest);

// GET /stats
router.get('/stats', handleGetStatsRequest);

// DELETE /clear
router.delete('/clear', handleClearDealsRequest);

// GET /operators
router.get('/operators', handleGetOperatorsRequest);

// PUT /operators/:name/fairplay
router.put('/operators/:name/fairplay', handleToggleFairplayRequest);

// PUT /operators/:name/simprice - Modifier le prix SIM d'un opérateur
router.put('/operators/:name/simprice', handleUpdateOperatorSimPriceRequest);

export default router; 