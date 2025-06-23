/* eslint-disable @typescript-eslint/no-explicit-any */
import puppeteer from 'puppeteer-extra';
import type { Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import prisma from '../lib/prisma';

interface ScrapedPlan {
  operator: string;
  planName: string;
  price: number;
  dataGb: number;
  network?: string;
  url?: string;
}

interface ScraperConfig {
  name: string;
  url: string;
  scrapeFunction: (page: Page) => Promise<ScrapedPlan[]>;
}

// Appliquer le plugin stealth pour contourner certaines protections anti-bot
puppeteer.use(StealthPlugin());

/**
 * Lance un navigateur Puppeteer avec les options nécessaires pour Docker.
 */
const launchBrowser = () => {
  return puppeteer.launch({
    headless: true,
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

/**
 * Logique de scraping spécifique à Sosh.
 */
const soshScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  console.log('Extraction des données de la page Sosh...');
  try {
    // On attend au maximum 30 s que le texte de la page contienne à la fois un prix (€) et une quantité de data (Go/GB).
    try {
      await page.waitForFunction(
        () => /€/.test(document.body.innerText) && /(Go|GO|GB)/.test(document.body.innerText),
        { timeout: 30000 }
      );
    } catch (_) { /* on continue même si ça échoue */ }

    // Sosh utilise des "shadow roots" pour encapsuler ses composants.
    // La méthode evaluate est la plus simple pour y accéder.
    const plans = await page.evaluate(() => {
      // Tableau pour stocker les résultats
      const results: Omit<ScrapedPlan, 'operator' | 'network'>[] = [];
      
      // Les offres sont dans des éléments <sh-offer-card-mobile>
      const offerCards = document.querySelectorAll('sh-offer-card-mobile');

      offerCards.forEach(card => {
        const shadowRoot = card.shadowRoot;
        if (shadowRoot) {
          const planNameElement = shadowRoot.querySelector('h3[slot="title"]');
          const dataElement = shadowRoot.querySelector('.sh-offer-card-mobile__data-value');
          const priceElement = shadowRoot.querySelector('sh-price');

          if (planNameElement && dataElement && priceElement) {
            const planName = planNameElement.textContent?.trim() || 'Nom inconnu';
            
            const dataText = dataElement.textContent?.trim().toUpperCase();
            let dataGb = 0;
            if (dataText?.includes('GO')) {
              dataGb = parseInt(dataText, 10);
            } else if (dataText?.includes('MO')) {
              dataGb = parseFloat(dataText) / 1000;
            }

            const priceRoot = priceElement.shadowRoot;
            if(priceRoot) {
              const priceValue = priceRoot.querySelector('.sh-price__value')?.textContent?.trim();
              const priceDecimal = priceRoot.querySelector('.sh-price__decimal')?.textContent?.trim();
              
              if(priceValue && priceDecimal) {
                const price = parseFloat(`${priceValue}.${priceDecimal}`);
                results.push({ planName, dataGb, price });
              }
            }
          }
        }
      });
      return results;
    });

    return plans.map(plan => ({ ...plan, operator: 'Sosh', network: 'Orange' }));
  } catch (error) {
    console.error('Erreur dans page.evaluate pour Sosh:', error);
    return [];
  }
};

/**
 * Logique de scraping spécifique à RED by SFR.
 */
const redScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  console.log('Extraction des données de la page RED by SFR...');
  try {
    // Attente que la page ait rendu un texte contenant prix + data.
    await page.waitForFunction(
      () => /€/.test(document.body.innerText) && /(Go|GO|GB)/.test(document.body.innerText),
      { timeout: 30000 }
    ).catch(() => {
      console.warn('[RED] Sélecteur principal non trouvé ; tentative de fallback full-text.');
    });

    const plans = await page.evaluate(() => {
      const results: Omit<ScrapedPlan, 'operator' | 'network'>[] = [];
      const offerCards = document.querySelectorAll('[data-testid="offer-card-mobile"]');

      offerCards.forEach(card => {
        const planNameElement = card.querySelector('h3');
        const dataElement = card.querySelector('[data-testid="offer-data-amount"]');
        const priceElement = card.querySelector('[data-testid="offer-price-super-price"]');

        if (planNameElement && dataElement && priceElement) {
          const planName = planNameElement.textContent?.trim() || 'Nom inconnu';
          
          const dataText = dataElement.textContent?.trim().toUpperCase();
          let dataGb = 0;
          if (dataText?.includes('GO')) {
            dataGb = parseInt(dataText, 10);
          } else if (dataText?.includes('MO')) {
            dataGb = parseFloat(dataText) / 1000;
          }

          // Le prix peut contenir des virgules et le symbole €
          const priceText = priceElement.textContent?.replace(',', '.').replace('€', '').trim();
          const price = priceText ? parseFloat(priceText) : 0;
          
          if(price > 0) {
            results.push({ planName, dataGb, price });
          }
        }
      });

      // Fallback : si aucune carte n'a été trouvée, on parcourt le texte complet.
      if (results.length === 0) {
        const pageText = document.body.innerText;
        const regex = /(\d{1,3}[,\.\d]*)\s*€.*?(\d{1,4})\s*Go/gi;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(pageText)) !== null) {
          const price = parseFloat(m[1].replace(',', '.'));
          const dataGb = parseInt(m[2], 10);
          if (!isNaN(price) && !isNaN(dataGb)) {
            results.push({ planName: `${dataGb} Go`, dataGb, price });
          }
        }
      }

      return results;
    });

    return plans.map(plan => ({ ...plan, operator: 'RED by SFR', network: 'SFR' }));
  } catch (error) {
    console.error('Erreur dans page.evaluate pour RED by SFR:', error);
    return [];
  }
};

/**
 * Logique de scraping spécifique à B&You.
 */
const bAndYouScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  console.log('Extraction des données de la page B&You...');
  try {
    // On laisse jusqu'à 30 s pour que la page se stabilise.
    await page.waitForFunction(
      () => /€/.test(document.body.innerText) && /(Go|GO|GB)/.test(document.body.innerText),
      { timeout: 30000 }
    ).catch(() => {
      console.warn('[B&You] Sélecteur principal non trouvé ; tentative de fallback.');
    });

    const plans = await page.evaluate(() => {
      const results: Omit<ScrapedPlan, 'operator' | 'network'>[] = [];
      // Bouygues utilise des cartes pour chaque offre
      const offerCards = document.querySelectorAll('.offre-card');

      offerCards.forEach(card => {
        // Le nom du forfait est souvent dans un titre h3 ou similaire
        const planNameElement = card.querySelector('h3.e-h3');
        // La data est mise en avant
        const dataElement = card.querySelector('.key-features__item-data-value');
        // Le prix est souvent dans une structure spécifique
        const priceElement = card.querySelector('.e-rte-price__main-price .e-rte-price__pricenumber');
        const priceDecimalElement = card.querySelector('.e-rte-price__main-price .e-rte-price__centime');

        if (planNameElement && dataElement && priceElement) {
          const planName = planNameElement.textContent?.trim() || 'Nom inconnu';
          
          const dataText = dataElement.textContent?.trim().toUpperCase();
          let dataGb = 0;
          if (dataText?.includes('GO')) {
            dataGb = parseInt(dataText, 10);
          } else if (dataText?.includes('MO')) {
            dataGb = parseFloat(dataText) / 1000;
          }

          const priceInt = priceElement.textContent?.trim() || '0';
          const priceDecimal = priceDecimalElement?.textContent?.trim() || '00';
          const price = parseFloat(`${priceInt}.${priceDecimal}`);

          if (price > 0 && !planName.toLowerCase().includes('5g')) { // Exclure les options/box
             results.push({ planName, dataGb, price });
          }
        }
      });

      if (results.length === 0) {
        const pageText = document.body.innerText;
        const regex = /(\d{1,3}[,\.\d]*)\s*€.*?(\d{1,4})\s*Go/gi;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(pageText)) !== null) {
          const price = parseFloat(m[1].replace(',', '.'));
          const dataGb = parseInt(m[2], 10);
          if (!isNaN(price) && !isNaN(dataGb)) {
            results.push({ planName: `${dataGb} Go`, dataGb, price });
          }
        }
      }

      return results;
    });

    return plans.map(plan => ({ ...plan, operator: 'B&You', network: 'Bouygues Telecom' }));
  } catch (error) {
    console.error('Erreur dans page.evaluate pour B&You:', error);
    return [];
  }
};

/**
 * Logique de scraping spécifique à Free Mobile.
 */
const freeMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  console.log('Extraction des données de la page Free Mobile…');
  try {
    // Attente active jusqu'à ce que le texte contienne à la fois un prix et une quantité de data
    await page.waitForFunction(
      () => /€/.test(document.body.innerText) && /(Go|GO|GB|Mo|MO)/.test(document.body.innerText),
      { timeout: 30000 }
    ).catch(() => {
      console.warn('[Free] Texte prix/data non détecté, poursuite quand même.');
    });

    const plans = await page.evaluate(() => {
      const results: { planName: string; dataGb: number; price: number }[] = [];

      // Texte complet de la page (minuscules pour fiabilité du test regex)
      const pageText = document.body.innerText;

      /*
        Exemples rencontrés :
          "19,99 €/mois – 210 Go"
          "19€99/mois – 210 Go"
          "2 € /mois – 100 Mo"
      */
      const regex = /(\d{1,3}(?:[.,]\d{1,2})?|\d{1,3}€\d{1,2})\s*€?\s*(?:\/mois|par mois|\/|–|-)?.{0,40}?(\d{1,4})\s*(Go|GO|GB|Gb|Mo|MO|MB)/gi;

      const normalizePrice = (raw: string): number => {
        // Supprimer les espaces et remplacer les virgules par des points
        let cleaned = raw.replace(/\s|€/g, '').replace(',', '.');
        // Si le symbole euro était entre les chiffres (ex: 19€99) on l'a déjà retiré => "1999"
        if (!cleaned.includes('.') && cleaned.length > 2) {
          // On insère un point deux chiffres avant la fin pour avoir les centimes
          cleaned = cleaned.slice(0, -2) + '.' + cleaned.slice(-2);
        }
        return parseFloat(cleaned);
      };

      let match: RegExpExecArray | null;
      while ((match = regex.exec(pageText)) !== null) {
        const price = normalizePrice(match[1]);
        const rawData = parseInt(match[2], 10);
        const unit = match[3].toLowerCase();

        let dataGb = rawData;
        if (unit.includes('mo') || unit.includes('mb')) {
          dataGb = rawData / 1000; // Conversion Mo → Go
        }

        if (!isNaN(price) && price > 0 && !isNaN(dataGb) && dataGb > 0) {
          const planName = `${dataGb} Go`;
          results.push({ planName, dataGb, price });
        }
      }

      // Éliminer d'éventuels doublons (prix & data identiques)
      return Array.from(new Map(results.map(p => [`${p.price}-${p.dataGb}`, p])).values());
    });

    return plans.map(plan => ({ ...plan, operator: 'Free Mobile', network: 'Free Mobile' }));
  } catch (error) {
    console.error('Erreur dans la collecte Free Mobile:', error);
    return [];
  }
};

/**
 * Fonction de scraping générique qui retourne un tableau vide.
 * Utilisée comme placeholder pour les opérateurs non encore implémentés.
 */
const placeholderScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  console.log(`Logique de scraping non implémentée pour : ${page.url()}`);
  return [];
};

// ... D'autres logiques de scraping pour RED, B&You, etc. seront ajoutées ici

/**
 * Configuration des scrapers pour chaque opérateur.
 * C'est ici que l'on ajoute ou retire des opérateurs à scraper.
 */
const scraperConfigs: ScraperConfig[] = [
  // MNOs & leurs marques "low-cost"
  {
    name: 'Sosh',
    url: 'https://www.sosh.fr/forfaits-mobiles',
    scrapeFunction: soshScrapeLogic, // Logique spécifique (à faire)
  },
  {
    name: 'RED by SFR',
    url: 'https://www.red-by-sfr.fr/forfaits-mobiles/',
    scrapeFunction: redScrapeLogic,
  },
  {
    name: 'B&You',
    url: 'https://www.bouyguestelecom.fr/forfaits-mobiles/sans-engagement-b-and-you',
    scrapeFunction: bAndYouScrapeLogic,
  },
  {
    name: 'Free Mobile',
    url: 'https://mobile.free.fr/',
    scrapeFunction: freeMobileScrapeLogic,
  },
  
  // Principaux MVNOs
  {
    name: 'Prixtel',
    url: 'https://www.prixtel.com/forfait-mobile/',
    scrapeFunction: placeholderScrapeLogic,
  },
  {
    name: 'La Poste Mobile',
    url: 'https://www.lapostemobile.fr/offres/forfaits-sans-engagement',
    scrapeFunction: placeholderScrapeLogic,
  },
  {
    name: 'NRJ Mobile',
    url: 'https://www.nrjmobile.fr/fr/forfaits.html',
    scrapeFunction: placeholderScrapeLogic,
  },
  {
    name: 'Auchan Telecom',
    url: 'https://www.auchantelecom.fr/fr/forfaits-mobiles.html',
    scrapeFunction: placeholderScrapeLogic,
  },
  {
    name: 'Cdiscount Mobile',
    url: 'https://www.cdiscountmobile.com/fr/forfaits.html',
    scrapeFunction: placeholderScrapeLogic,
  },
  {
    name: 'YouPrice',
    url: 'https://www.youprice.fr/',
    scrapeFunction: placeholderScrapeLogic,
  },
  {
    name: 'Syma Mobile',
    url: 'https://www.symamobile.com/forfaits-mobiles',
    scrapeFunction: placeholderScrapeLogic,
  },
  {
    name: 'Lebara',
    url: 'https://mobile.lebara.com/fr/fr/',
    scrapeFunction: placeholderScrapeLogic,
  },
  {
    name: 'Coriolis',
    url: 'https://www.coriolis.com/forfait-mobile/',
    scrapeFunction: placeholderScrapeLogic,
  },
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
        // Paramétrage du contexte pour ressembler à un vrai navigateur desktop français.
        await page.setViewport({ width: 1280, height: 960 });
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
        );
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' });

        await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Scroll pour déclencher le lazy-loading éventuel et attendre quelques ms.
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        await sleep(3000);

        const scrapedPlans = await config.scrapeFunction(page);

        if (scrapedPlans.length > 0) {
          console.log(`[${config.name}] ${scrapedPlans.length} offres trouvées. Sauvegarde en cours...`);
          
          for (const plan of scrapedPlans) {
            try {
              // Calcul du score. Si dataGb est 0, le score est 'Infinity' ce que l'on évite.
              const score = plan.dataGb > 0 ? plan.price / plan.dataGb : null;

              const existing = await prisma.mobilePlan.findFirst({
                where: {
                  operator: plan.operator,
                  planName: plan.planName,
                },
              });

              if (existing) {
                await prisma.mobilePlan.update({
                  where: { id: existing.id },
                  data: {
                    price: plan.price,
                    dataGb: plan.dataGb,
                    network: plan.network,
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
                    calls: 'Illimités',
                    sms: 'Illimités',
                    network: plan.network,
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