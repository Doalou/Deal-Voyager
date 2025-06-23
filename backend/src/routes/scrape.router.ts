import { Router } from 'express';
import { handleScrapeRequest, handleGetDealsRequest } from '../controllers/scrape.controller';

const router = Router();

// POST /scrape
router.post('/scrape', handleScrapeRequest);

// GET /deals
router.get('/deals', handleGetDealsRequest);

export default router; 