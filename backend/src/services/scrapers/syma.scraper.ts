import type { ScrapedPlan, ScraperConfig } from './types';
import { extractFeesFromText, extractVisibleTextFromHtml } from './utils';

export const symaMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  try {
    const text = (await page.locator('body').innerText()).replace(/\u00a0|\u202f/g, ' ');
    return parseSymaText(text);
  } catch (error) {
    console.error('Erreur dans la collecte Syma Mobile:', error);
    return [];
  }
};

export function parseSymaText(text: string): ScrapedPlan[] {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const fees = extractFeesFromText(text);
  const prices: number[] = [];
  const plans: ScrapedPlan[] = [];

  for (let index = 0; index < lines.length - 2 && prices.length < 4; index += 1) {
    if (!/^\d{1,2}$/.test(lines[index])) continue;
    const cents = lines[index + 1].match(/^€\s*(\d{2})$/);
    if (cents && /^\/MOIS$/i.test(lines[index + 2])) {
      prices.push(Number.parseFloat(`${lines[index]}.${cents[1]}`));
    }
  }

  let planIndex = 0;
  for (let index = 0; index < lines.length - 3 && planIndex < prices.length; index += 1) {
    if (!/^illimit[ée]s$/i.test(lines[index]) || !/^illimit[ée]s$/i.test(lines[index + 1])) continue;
    const dataMatch = lines[index + 2].match(/^(\d{1,4})\s*Go$/i);
    if (!dataMatch) continue;
    const dataGb = Number.parseInt(dataMatch[1], 10);
    const euLine = lines.slice(index + 3, index + 7).find((line) => /^(\d{1,3})\s*Go$/i.test(line));
    const euMatch = euLine?.match(/^(\d{1,3})\s*Go$/i);
    plans.push({
      operator: 'Syma Mobile',
      planName: `Forfait Syma Mobile ${dataGb} Go`,
      dataGb,
      price: prices[planIndex],
      calls: 'Illimités',
      network: 'SFR',
      networkGeneration: '5G',
      dataEuGb: euMatch ? Number.parseInt(euMatch[1], 10) : undefined,
      simPrice: fees.simPrice ?? undefined,
      activationPrice: fees.activationPrice ?? undefined,
      cancellationPrice: fees.cancellationPrice ?? 0,
    });
    planIndex += 1;
  }
  return plans;
}

export const symaMobileHtmlScrapeLogic = (html: string) =>
  parseSymaText(extractVisibleTextFromHtml(html));
