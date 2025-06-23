import { Request, Response } from 'express';
import { scrapeOffers } from '../services/scraper.service';
import prisma from '../lib/prisma';

export const handleScrapeRequest = async (req: Request, res: Response) => {
  console.log('Requête de scraping reçue...');
  
  // On n'attend pas la fin du scraping pour répondre,
  // car cela peut être très long. On le lance en arrière-plan.
  scrapeOffers();

  res.status(202).json({ message: 'Le scraping a été lancé en arrière-plan.' });
};

export const handleGetDealsRequest = async (req: Request, res: Response) => {
  try {
    const deals = await prisma.mobilePlan.findMany({
      orderBy: {
        score: 'asc', // Trier par le score (plus petit = meilleur)
      },
    });
    res.status(200).json(deals);
  } catch (error) {
    console.error("Erreur lors de la récupération des offres :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
}; 