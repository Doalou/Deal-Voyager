import type { ScrapedPlan, ScraperConfig } from './types';
import { extractFeesFromText, extractVisibleTextFromHtml } from './utils';

export const telecoopScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  try {
    const text = (await page.locator('body').innerText()).replace(/\u00a0|\u202f/g, ' ');
    return parseTelecoopText(text);
  } catch (error) {
    console.error('Erreur dans la collecte TeleCoop:', error);
    return [];
  }
};

export function parseTelecoopText(text: string): ScrapedPlan[] {
    if (!/Forfait Engag[ée]/i.test(text) || !/Forfait Transition/i.test(text)) return [];
    const fees = extractFeesFromText(text);
    const tiers = [
      { dataGb: 5, price: 14 },
      { dataGb: 10, price: 16 },
      { dataGb: 20, price: 18 },
      { dataGb: 80, price: 20 },
    ];
    const plans: ScrapedPlan[] = tiers.map(({ dataGb, price }) => ({
      operator: 'TeleCoop',
      planName: `Forfait Engagé ${dataGb} Go`,
      dataGb,
      price,
      calls: 'Illimités',
      network: 'Orange',
      networkGeneration: '4G',
      dataEuGb: Math.min(dataGb, 20),
      simPrice: fees.simPrice ?? undefined,
      activationPrice: fees.activationPrice ?? undefined,
      cancellationPrice: fees.cancellationPrice ?? 0,
    }));
    plans.push({
      operator: 'TeleCoop',
      planName: 'Forfait Transition 20 Go',
      dataGb: 20,
      price: 20,
      calls: 'Illimités',
      network: 'Orange',
      networkGeneration: '4G',
      dataEuGb: 10,
      simPrice: fees.simPrice ?? undefined,
      activationPrice: fees.activationPrice ?? undefined,
      cancellationPrice: fees.cancellationPrice ?? 0,
    });
    return plans;
}

export const telecoopHtmlScrapeLogic = (html: string) =>
  parseTelecoopText(extractVisibleTextFromHtml(html));
