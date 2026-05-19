/* eslint-disable @typescript-eslint/no-explicit-any */
import puppeteer from 'puppeteer-extra';
import type { Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';
import prisma from '../lib/prisma';
import type { ScraperConfig, ScrapedPlan } from './scrapers/types';
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
import { lycamobileScrapeLogic } from './scrapers/lycamobile.scraper';
import { prixtelScrapeLogic } from './scrapers/prixtel.scraper';
import { telecoopScrapeLogic } from './scrapers/telecoop.scraper';
import { akeoScrapeLogic } from './scrapers/akeo.scraper';
import { nordnetScrapeLogic } from './scrapers/nordnet.scraper';
import { franceTelephoneScrapeLogic } from './scrapers/francetelephone.scraper';
import { fetchFeesFromPdf, detectFeesFromCheckout } from './scrapers/utils';
import { broadcastDeal } from './discord.service';

puppeteer.use(StealthPlugin());
puppeteer.use(
  RecaptchaPlugin({
    visualFeedback: true,
  })
);

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
      '--ignore-certificate-errors',
      '--disable-blink-features=AutomationControlled',
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
  { name: 'Sosh', url: 'https://shop.sosh.fr/mobile/forfaits-mobiles', defaultSimPrice: 10, scrapeFunction: soshScrapeLogic },
  { name: 'RED by SFR', url: 'https://www.red-by-sfr.fr/forfaits-mobiles/', defaultSimPrice: 10, scrapeFunction: redScrapeLogic },
  {
    name: 'B&You',
    url: 'https://www.bouyguestelecom.fr/forfaits-mobiles/b-and-you',
    pdfUrl: 'https://www.bouyguestelecom.fr/static/cms/tarifs/Guide_Des_Tarifs.pdf',
    findPdfUrl: async (page) => {
      try {
        const pdfLink = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          for (const a of links) {
            const href = a.getAttribute('href') || '';
            if (/guide.*(tarif|prix)|tarif.*guide/i.test(href) && /\.pdf$/i.test(href)) {
              return new URL(href, window.location.origin).href;
            }
          }
          for (const a of links) {
            const href = a.getAttribute('href') || '';
            const text = (a.textContent || '').toLowerCase();
            if (/\.pdf$/i.test(href) && /(tarif|prix|brochure|cgs)/i.test(text + href)) {
              return new URL(href, window.location.origin).href;
            }
          }
          return null;
        });
        return pdfLink;
      } catch { return null; }
    },
    scrapeFunction: bAndYouScrapeLogic,
  },
  {
    name: 'Free Mobile',
    url: 'https://mobile.free.fr/',
    pdfUrl: 'https://mobile.free.fr/docs/bt/tarifs.pdf',
    scrapeFunction: freeMobileScrapeLogic,
  },

  // Principaux MVNOs
  { name: 'YouPrice', url: 'https://www.youprice.fr/forfaits', scrapeFunction: youPriceScrapeLogic },
  { name: 'Coriolis', url: 'https://www.coriolis.com/forfaits-sans-mobile', scrapeFunction: coriolisScrapeLogic },
  {
    name: 'La Poste Mobile',
    url: 'https://www.lapostemobile.fr/offres-mobiles/forfaits-sans-engagement',
    pdfUrl: 'https://medias.lapostemobile.fr/portail_mobile/pdf/portail_web/LPM-Recapitulatif-contractuel-SIM.pdf',
    scrapeFunction: laPosteMobileScrapeLogic,
  },
  {
    name: 'NRJ Mobile',
    url: 'https://www.nrjmobile.fr/forfait-se',
    pdfUrl: 'https://www.nrjmobile.fr/pdf/nrj-mobile-cgs.pdf',
    scrapeFunction: nrjMobileScrapeLogic,
  },
  {
    name: 'Auchan Telecom',
    url: 'https://www.auchantelecom.fr/forfait-se',
    pdfUrl: 'https://www.auchantelecom.fr/pdf/auchan-telecom-cgs.pdf',
    scrapeFunction: auchanTelecomScrapeLogic,
  },
  {
    name: 'Cdiscount Mobile',
    url: 'https://www.cdiscount.com/cdiscount-mobile/v-164-0.html',
    pdfUrl: 'https://cdiscountmobile.cdiscount.com/pdf/cdiscount-mobile-cgs.pdf',
    scrapeFunction: cdiscountMobileScrapeLogic,
  },
  {
    name: 'Syma Mobile',
    url: 'https://www.symamobile.com/forfait',
    pdfUrl: 'https://api.symamobile.com/fr_FR/docs/legal/dl/brochure-tarifaire-forfaits-sans-engagement-symamobile.pdf',
    scrapeFunction: symaMobileScrapeLogic
  },
  { name: 'Lebara', url: 'https://mobile.lebara.com/fr/fr/', scrapeFunction: lebaraScrapeLogic },
  // { name: 'Réglo Mobile', url: 'https://www.reglomobile.fr/forfaits-mobiles', scrapeFunction: regloMobileScrapeLogic },

  // v2.0.0 — Nouveaux MVNOs
  { name: 'Lycamobile', url: 'https://www.lycamobile.fr/abo/fr/bundles/sim-only-deals/', scrapeFunction: lycamobileScrapeLogic },
  {
    name: 'Prixtel',
    url: 'https://www.prixtel.com/forfait-mobile/',
    findPdfUrl: async (page) => {
      try {
        const pdfLink = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          for (const a of links) {
            const href = a.getAttribute('href') || '';
            const text = (a.textContent || '').toLowerCase();
            if (/\.pdf$/i.test(href) && /prixtel_.*_gt_|guide tarifaire|fiche standardis/i.test(href + ' ' + text)) {
              return new URL(href, globalThis.location.origin).href;
            }
          }
          return null;
        });
        return pdfLink;
      } catch {
        return null;
      }
    },
    scrapeFunction: prixtelScrapeLogic,
  },
  { name: 'TeleCoop', url: 'https://telecoop.fr/particuliers', scrapeFunction: telecoopScrapeLogic },
  { name: 'Akeo Telecom', url: 'https://www.akeotelecom.com/mobile/forfaits', scrapeFunction: akeoScrapeLogic },
  { name: 'Nordnet', url: 'https://www.nordnet.com/forfaits-mobile', scrapeFunction: nordnetScrapeLogic },
  { name: 'France Téléphone', url: 'https://france-telephone.com/forfaits-mobiles-bleutel-2/', scrapeFunction: franceTelephoneScrapeLogic },
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
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        );
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8' });

        // Navigation avec retry en cas de timeout réseau
        let navSuccess = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            await page.goto(config.url, { waitUntil: 'networkidle2', timeout: 60000 });
            navSuccess = true;
            break;
          } catch (navError: any) {
            if (navError?.name === 'TimeoutError') {
              console.warn(`[${config.name}] Timeout de navigation (tentative ${attempt + 1}/2), tentative avec la page partiellement chargée...`);
              navSuccess = true; // On essaie quand même avec la page partielle
              break;
            } else if (navError?.message?.includes('ERR_TIMED_OUT') && attempt === 0) {
              console.warn(`[${config.name}] Erreur réseau (tentative 1/2), retry dans 10s...`);
              await new Promise(r => setTimeout(r, 10000));
            } else {
              throw navError;
            }
          }
        }

        if (!navSuccess) {
          console.warn(`[${config.name}] Navigation échouée après 2 tentatives, passage au suivant.`);
          continue;
        }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        await sleep(3000);

        const scrapedPlans = await config.scrapeFunction(page);

        if (scrapedPlans.length > 0) {
          console.log(`[${config.name}] ${scrapedPlans.length} offres trouvées. Enrichissement des données...`);

          const siteSimCount = scrapedPlans.filter(p => p.simPrice != null).length;
          const siteActCount = scrapedPlans.filter(p => p.activationPrice != null).length;
          const siteCancelCount = scrapedPlans.filter(p => p.cancellationPrice != null).length;
          console.log(`[${config.name}] Données site — SIM: ${siteSimCount}/${scrapedPlans.length}, activation: ${siteActCount}/${scrapedPlans.length}, résiliation: ${siteCancelCount}/${scrapedPlans.length}`);

          // --- Fallback checkout : SIM + activation (si le site n'a pas trouvé) ---
          const needsSimPrice = scrapedPlans.some(p => p.simPrice == null);
          const needsActivation = scrapedPlans.some(p => p.activationPrice == null);
          let checkoutFees = { simPrice: null as number | null, activationPrice: null as number | null };
          if (needsSimPrice || needsActivation) {
            console.log(`[${config.name}] Données manquantes sur le site (SIM: ${needsSimPrice}, activation: ${needsActivation}), tentative checkout...`);
            checkoutFees = await detectFeesFromCheckout(page, config.name);
          }

          // --- Fallback PDF (dernier recours) ---
          const needsCancellation = scrapedPlans.some(p => p.cancellationPrice == null);
          const needsActivFromPdf = needsActivation && checkoutFees.activationPrice == null;
          const needsSimFromPdf = needsSimPrice && checkoutFees.simPrice == null;
          let pdfFees = null;
          if (needsCancellation || needsActivFromPdf || needsSimFromPdf) {
            let resolvedPdfUrl = config.pdfUrl || null;
            if (config.findPdfUrl) {
              try {
                const dynamicUrl = await config.findPdfUrl(page);
                if (dynamicUrl) {
                  console.log(`[${config.name}] PDF détecté dynamiquement : ${dynamicUrl}`);
                  resolvedPdfUrl = dynamicUrl;
                }
              } catch (e) {
                console.warn(`[${config.name}] Erreur lors de la recherche dynamique du PDF:`, e);
              }
            }
            if (resolvedPdfUrl) {
              console.log(`[${config.name}] Données manquantes — fallback PDF (cancel: ${needsCancellation}, activ: ${needsActivFromPdf}, sim: ${needsSimFromPdf})`);
              pdfFees = await fetchFeesFromPdf(resolvedPdfUrl, config.name);
            }
          }

          for (const plan of scrapedPlans) {
            if (plan.simPrice == null && checkoutFees.simPrice != null) {
              plan.simPrice = checkoutFees.simPrice;
            }
            if (plan.simPrice == null && pdfFees?.simPrice != null) {
              plan.simPrice = pdfFees.simPrice;
            }
            if (plan.simPrice == null && config.defaultSimPrice != null) {
              console.log(`[${config.name}] SIM prix par défaut appliqué : ${config.defaultSimPrice}€`);
              plan.simPrice = config.defaultSimPrice;
            }
            if (plan.activationPrice == null && checkoutFees.activationPrice != null) {
              plan.activationPrice = checkoutFees.activationPrice;
            }
            if (plan.activationPrice == null && pdfFees?.activationPrice != null) {
              plan.activationPrice = pdfFees.activationPrice;
            }
            if (plan.cancellationPrice == null && pdfFees?.cancellationPrice != null) {
              plan.cancellationPrice = pdfFees.cancellationPrice;
            }
          }

          console.log(`[${config.name}] Sauvegarde en cours...`);

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
                const hasChanged =
                  existing.price !== plan.price ||
                  existing.dataGb !== plan.dataGb ||
                  existing.calls !== (plan.calls || 'Illimités') ||
                  existing.networkGeneration !== (plan.networkGeneration || null) ||
                  existing.dataEuGb !== (plan.dataEuGb ?? null) ||
                  existing.simPrice !== (plan.simPrice ?? null) ||
                  existing.activationPrice !== (plan.activationPrice ?? null) ||
                  existing.cancellationPrice !== (plan.cancellationPrice ?? null);

                const updatedPlan = await prisma.mobilePlan.update({
                  where: { id: existing.id },
                  data: {
                    price: plan.price,
                    dataGb: plan.dataGb,
                    calls: plan.calls || 'Illimités',
                    network: plan.network,
                    networkGeneration: plan.networkGeneration || null,
                    dataEuGb: plan.dataEuGb ?? null,
                    simPrice: plan.simPrice ?? null,
                    activationPrice: plan.activationPrice ?? null,
                    cancellationPrice: plan.cancellationPrice ?? null,
                    url: config.url,
                    score: score,
                  },
                });

                if (hasChanged) {
                  await broadcastDeal(updatedPlan, 'UPDATE', existing);
                }
              } else {
                const newPlan = await prisma.mobilePlan.create({
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
                    activationPrice: plan.activationPrice ?? null,
                    cancellationPrice: plan.cancellationPrice ?? null,
                    url: config.url,
                    score: score,
                  },
                });

                await broadcastDeal(newPlan, 'NEW');
              }
            } catch (dbError) {
              console.error(`Erreur lors de la sauvegarde de l'offre "${plan.planName}" de ${plan.operator}:`, dbError);
            }
          }
          console.log(`[${config.name}] Sauvegarde terminée.`);

          // --- Nettoyage : supprimer les forfaits obsolètes ---
          // On compare les plans en base pour cet opérateur avec ceux qu'on vient de scraper.
          // Si un plan en base n'a pas été retourné par le scraper, il a été retiré par l'opérateur.
          try {
            const existingPlans = await prisma.mobilePlan.findMany({
              where: { operator: config.name },
            });

            const scrapedKeys = new Set(
              scrapedPlans.map(p => `${p.planName}|||${p.network || ''}`),
            );

            const stalePlans = existingPlans.filter(
              ep => !scrapedKeys.has(`${ep.planName}|||${ep.network || ''}`),
            );

            if (stalePlans.length > 0) {
              console.log(`[${config.name}] 🗑️ - ${stalePlans.length} forfait(s) obsolète(s) détecté(s), suppression...`);
              for (const stale of stalePlans) {
                try {
                  await prisma.mobilePlan.delete({ where: { id: stale.id } });
                  console.log(`[${config.name}]   → Supprimé : ${stale.planName} (${stale.network || 'N/A'}) — ${stale.price}€/mois, ${stale.dataGb} Go`);
                  await broadcastDeal(stale, 'DELETE');
                } catch (delErr) {
                  console.error(`[${config.name}] Erreur suppression "${stale.planName}":`, delErr);
                }
              }
            }
          } catch (cleanupErr) {
            console.error(`[${config.name}] Erreur lors du nettoyage des forfaits obsolètes:`, cleanupErr);
          }
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
