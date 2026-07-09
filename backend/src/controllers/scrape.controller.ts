import { Request, Response } from 'express';
import { scrapeOffers } from '../services/scraper.service';
import prisma from '../lib/prisma';

// Simple lock en mémoire
let isScraping = false;

const getSingleParam = (value: string | string[] | undefined): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return null;
};

export const handleScrapeRequest = async (req: Request, res: Response): Promise<void> => {
  if (isScraping) {
    res.status(429).json({ message: 'Un scraping est déjà en cours. Veuillez patienter.' });
    return;
  }

  console.log('Requête de scraping reçue...');
  isScraping = true;

  // On lance en arrière-plan
  scrapeOffers()
    .then(() => {
      console.log('Scraping job finished.');
    })
    .catch((err) => {
      console.error('Scraping job failed:', err);
    })
    .finally(() => {
      isScraping = false;
    });

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

export const handleGetStatsRequest = async (req: Request, res: Response) => {
  try {
    const count = await prisma.mobilePlan.count();
    const lastUpdate = await prisma.mobilePlan.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true }
    });

    res.status(200).json({
      totalOffers: count,
      isScraping: isScraping,
      lastUpdate: lastUpdate?.updatedAt || null
    });
  } catch (error) {
    console.error("Erreur stats :", error);
    res.status(500).json({ message: "Erreur lors de la récupération des statistiques." });
  }
};

export const handleClearDealsRequest = async (req: Request, res: Response) => {
  try {
    const deleted = await prisma.mobilePlan.deleteMany({});
    console.log(`[CLEAR] ${deleted.count} offres supprimées de la base.`);
    res.status(200).json({ message: `${deleted.count} offres supprimées.`, count: deleted.count });
  } catch (error) {
    console.error("Erreur lors du vidage :", error);
    res.status(500).json({ message: "Erreur lors du vidage de la base." });
  }
};

export const handleGetOperatorsRequest = async (req: Request, res: Response) => {
  try {
    const operators = await prisma.operatorSettings.findMany();
    res.status(200).json(operators);
  } catch (error) {
    console.error("Erreur opérateurs :", error);
    res.status(500).json({ message: "Erreur lors de la récupération des opérateurs." });
  }
};

export const handleToggleFairplayRequest = async (req: Request, res: Response) => {
  const name = getSingleParam(req.params.name);
  const { isFairplay } = req.body;

  if (!name) {
    res.status(400).json({ message: "Nom d'opérateur invalide." });
    return;
  }

  try {
    const operator = await prisma.operatorSettings.upsert({
      where: { operatorName: name },
      update: { isFairplay },
      create: { operatorName: name, isFairplay },
    });
    console.log(`[FAIRPLAY] ${name} mis à jour : fairplay=${isFairplay}`);
    res.status(200).json(operator);
  } catch (error) {
    console.error("Erreur maj fairplay :", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour du statut." });
  }
};

export const handleUpdateOperatorSimPriceRequest = async (req: Request, res: Response) => {
  const name = getSingleParam(req.params.name);
  const { simPrice, activationPrice, cancellationPrice } = req.body;

  if (!name) {
    res.status(400).json({ message: "Nom d'opérateur invalide." });
    return;
  }

  const parsedSimPrice = simPrice !== null && simPrice !== undefined ? parseFloat(simPrice) : null;
  const parsedActivationPrice = activationPrice !== null && activationPrice !== undefined ? parseFloat(activationPrice) : null;
  const parsedCancellationPrice = cancellationPrice !== null && cancellationPrice !== undefined ? parseFloat(cancellationPrice) : null;

  try {
    const existing = await prisma.operatorSettings.findUnique({
      where: { operatorName: name }
    });

    let operator;
    if (existing) {
      operator = await prisma.operatorSettings.update({
        where: { operatorName: name },
        data: {
          simPrice: parsedSimPrice,
          activationPrice: parsedActivationPrice,
          cancellationPrice: parsedCancellationPrice
        },
      });
    } else {
      operator = await prisma.operatorSettings.create({
        data: {
          operatorName: name,
          isFairplay: true,
          simPrice: parsedSimPrice,
          activationPrice: parsedActivationPrice,
          cancellationPrice: parsedCancellationPrice
        },
      });
    }

    console.log(`[FEES] ${name} mis à jour : sim=${parsedSimPrice}€ act=${parsedActivationPrice}€ résil=${parsedCancellationPrice}€`);
    res.status(200).json(operator);
  } catch (error) {
    console.error("Erreur maj fees :", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour des frais de l'opérateur." });
  }
}; 
