/* eslint-disable @typescript-eslint/no-explicit-any */
import puppeteer from 'puppeteer-extra';
import type { Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import prisma from '../lib/prisma';
import type { ScraperConfig } from './scrapers/types';
import { soshScrapeLogic } from './scrapers/sosh.scraper';
import { redScrapeLogic } from './scrapers/red.scraper';
import { bAndYouScrapeLogic } from './scrapers/byou.scraper';
import { freeMobileScrapeLogic } from './scrapers/free.scraper';
import { youPriceScrapeLogic } from './scrapers/youprice.scraper';
import { coriolisScrapeLogic } from './scrapers/coriolis.scraper';
import { laPosteMobileScrapeLogic } from './scrapers/laposte.scraper';
import { auchanTelecomScrapeLogic } from './scrapers/auchan.scraper';
import { nrjMobileScrapeLogic } from './scrapers/nrj.scraper';
import { cdiscountMobileScrapeLogic } from './scrapers/cdiscount.scraper';
import { symaMobileScrapeLogic } from './scrapers/syma.scraper';
import { lebaraScrapeLogic } from './scrapers/lebara.scraper';

// Appliquer le plugin stealth pour contourner certaines protections anti-bot
puppeteer.use(StealthPlugin());

/**
 * Lance un navigateur Puppeteer avec les options nécessaires pour Docker.
 */
const launchBrowser = () => {
  return puppeteer.launch({
    headless: true,
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  });
};

const placeholderScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  console.log(`Logique de scraping non implémentée pour : ${page.url()}`);
  return [];
};

/**
 * Configuration des scrapers pour chaque opérateur.
 * C'est ici que l'on ajoute ou retire des opérateurs à scraper.
 */
const scraperConfigs: ScraperConfig[] = [
  // MNOs & leurs marques "low-cost"
  { name: 'Sosh', url: 'https://www.sosh.fr/forfaits-mobile/', scrapeFunction: soshScrapeLogic },
  { name: 'RED by SFR', url: 'https://www.red-by-sfr.fr/forfaits-mobiles/', scrapeFunction: redScrapeLogic },
  { name: 'B&You', url: 'https://www.bouyguestelecom.fr/forfaits-mobiles/b-and-you', scrapeFunction: bAndYouScrapeLogic },
  { name: 'Free Mobile', url: 'https://mobile.free.fr/', scrapeFunction: freeMobileScrapeLogic },

  // Principaux MVNOs
  { name: 'YouPrice', url: 'https://www.youprice.fr/forfaits', scrapeFunction: youPriceScrapeLogic },
  { name: 'Coriolis', url: 'https://www.coriolis.com/forfaits-sans-mobile', scrapeFunction: coriolisScrapeLogic },
  { name: 'La Poste Mobile', url: 'https://www.lapostemobile.fr/offres/forfaits-sans-engagement', scrapeFunction: laPosteMobileScrapeLogic },
  { name: 'NRJ Mobile', url: 'https://www.nrjmobile.fr/forfait-se', scrapeFunction: nrjMobileScrapeLogic },
  { name: 'Auchan Telecom', url: 'https://www.auchantelecom.fr/forfait-se', scrapeFunction: auchanTelecomScrapeLogic },
  { name: 'Cdiscount Mobile', url: 'https://www.cdiscount.com/cdiscount-mobile/v-164-0.html', scrapeFunction: cdiscountMobileScrapeLogic },
  { name: 'Syma Mobile', url: 'https://www.symamobile.com/forfait', scrapeFunction: symaMobileScrapeLogic },
  { name: 'Lebara', url: 'https://mobile.lebara.com/fr/fr/', scrapeFunction: lebaraScrapeLogic },
];

/**
 * Fonction principale qui orchestre le scraping de tous les opérateurs configurés.
 */
export const scrapeOffers = async () => {
  console.log('Lancement du scraping de toutes les offres...');
  const browser = await launchBrowser();

  try {
    for (const config of scraperConfigs) {
      console.log(`--- Début du scraping pour ${config.name} ---`);
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1280, height: 960 });
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        );
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' });

        try {
          await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 60000 });
        } catch (navError: any) {
          if (navError?.name === 'TimeoutError') {
            console.warn(`[${config.name}] Timeout de navigation, tentative avec la page partiellement chargée...`);
          } else {
            throw navError;
          }
        }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        await sleep(3000);

        const scrapedPlans = await config.scrapeFunction(page);

        if (scrapedPlans.length > 0) {
          console.log(`[${config.name}] ${scrapedPlans.length} offres trouvées. Sauvegarde en cours...`);

          for (const plan of scrapedPlans) {
            try {
              const score = plan.dataGb > 0 ? plan.price / plan.dataGb : null;

              const existing = await prisma.mobilePlan.findFirst({
                where: {
                  operator: plan.operator,
                  planName: plan.planName,
                  network: plan.network || undefined,
                },
              });

              if (existing) {
                await prisma.mobilePlan.update({
                  where: { id: existing.id },
                  data: {
                    price: plan.price,
                    dataGb: plan.dataGb,
                    calls: plan.calls || 'Illimités',
                    network: plan.network,
                    networkGeneration: plan.networkGeneration || null,
                    dataEuGb: plan.dataEuGb ?? null,
                    simPrice: plan.simPrice ?? null,
                    url: config.url,
                    score: score,
                  },
                });
              } else {
                await prisma.mobilePlan.create({
                  data: {
                    operator: plan.operator,
                    planName: plan.planName,
                    price: plan.price,
                    dataGb: plan.dataGb,
                    calls: plan.calls || 'Illimités',
                    sms: 'Illimités',
                    network: plan.network,
                    networkGeneration: plan.networkGeneration || null,
                    dataEuGb: plan.dataEuGb ?? null,
                    simPrice: plan.simPrice ?? null,
                    url: config.url,
                    score: score,
                  },
                });
              }
            } catch (dbError) {
              console.error(`Erreur lors de la sauvegarde de l'offre "${plan.planName}" de ${plan.operator}:`, dbError);
            }
          }
          console.log(`[${config.name}] Sauvegarde terminée.`);
        } else {
          console.log(`[${config.name}] Aucune offre trouvée ou le scraping a échoué.`);
        }
      } catch (error) {
        console.error(`Erreur lors du scraping de ${config.name}:`, error);
      } finally {
        await page.close();
      }
    }
    console.log('--- Scraping de tous les opérateurs terminé. ---');
  } catch (error) {
    console.error('Une erreur générale est survenue durant le scraping:', error);
  } finally {
    await browser.close();
  }

  return { success: true, message: 'Opération de scraping terminée.' };
};