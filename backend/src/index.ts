import express, { Request, Response } from 'express';
import cors from 'cors';
import scrapeRouter from './routes/scrape.router';

import { scrapeOffers } from './services/scraper.service';
import cron from 'node-cron';

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for Nuxt frontend
app.use(cors({
  origin: '*', // For dev mode, accept all. In production restrict to frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

app.use(express.json());

// Routes de l'API
app.use('/api/v1', scrapeRouter);

app.get('/', (req: Request, res: Response) => {
  res.send('Hello from Deal-Voyager API!');
});

// Planification du scraping automatique toutes les heures
cron.schedule('0 * * * *', () => {
  console.log(`Exécution du scraping planifié par Cron (${new Date().toLocaleTimeString('fr-FR')})...`);
  scrapeOffers();
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
}); 