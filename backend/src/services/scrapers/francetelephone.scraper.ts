import type { ScrapedPlan, ScraperConfig } from './types';
import { extractFeesFromText, extractVisibleTextFromHtml } from './utils';

export const franceTelephoneScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  try {
    const text = (await page.locator('body').innerText()).replace(/\u00a0|\u202f/g, ' ');
    return parseFranceTelephoneText(text);
  } catch (error) {
    console.error('Erreur dans la collecte France Téléphone:', error);
    return [];
  }
};

export function parseFranceTelephoneText(text: string): ScrapedPlan[] {
  const mobileSection = text.match(/5 forfaits BleuTel([\s\S]*?)D[ÉE]COUVREZ AUSSI/i)?.[1] ?? '';
  const lines = mobileSection.split('\n').map((line) => line.trim()).filter(Boolean);
  const fees = extractFeesFromText(mobileSection);
  const basePlans: Array<{ name: string; dataGb: number; price: number }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const dataMatch = lines[index].match(/^(\d{1,3})\s*Go$/i);
    if (!dataMatch) continue;
    const dataGb = Number.parseInt(dataMatch[1], 10);
    const nearby = lines.slice(index + 1, index + 16);
    const name = nearby.find((line) => /^[A-ZÉÈÀÙÇ][A-ZÉÈÀÙÇ\s+]+$/.test(line) && line.length < 30);
    const priceIndex = nearby.findIndex((line) => /\d{1,3}[,.]\d{2}\s*€/.test(line));
    const priceMatch = priceIndex >= 0 ? nearby[priceIndex].match(/(\d{1,3})[,.](\d{2})\s*€/) : null;
    if (!name || !priceMatch) continue;
    let price = Number.parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
    const promoText = nearby.slice(priceIndex, priceIndex + 4).join(' ');
    const recurring = promoText.match(/pendant\s+(\d+)\s*mois,?\s*puis\s+(\d{1,3})[,.](\d{2})\s*€/i);
    if (recurring) {
      const promoMonths = Number.parseInt(recurring[1], 10);
      const recurringPrice = Number.parseFloat(`${recurring[2]}.${recurring[3]}`);
      price = Math.round(((price * promoMonths + recurringPrice * (12 - promoMonths)) / 12) * 100) / 100;
    }
    basePlans.push({ name, dataGb, price });
  }

  return basePlans.flatMap((plan) => (['Orange', 'Bouygues Telecom'] as const).map((network) => ({
    operator: 'France Téléphone',
    planName: `Forfait Mobile ${plan.name} (${network})`,
    dataGb: plan.dataGb,
    price: plan.price,
    calls: 'Illimités',
    network,
    networkGeneration: '5G',
    dataEuGb: plan.dataGb,
    simPrice: fees.simPrice ?? undefined,
    activationPrice: fees.activationPrice ?? 0,
    cancellationPrice: fees.cancellationPrice ?? 0,
  })));
}

export const franceTelephoneHtmlScrapeLogic = (html: string) =>
  parseFranceTelephoneText(extractVisibleTextFromHtml(html));
