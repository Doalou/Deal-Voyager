import type { ScrapedPlan, ScraperConfig } from './types';
import { extractFeesFromText } from './utils';

const NETWORK_HEADING = /^R[ÉE]SEAU\s+(ORANGE|SFR|BOUYGUES(?:\s+T[ÉE]L[ÉE]COM)?)$/i;

export const youPriceScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  try {
    await page.waitForTimeout(1500);
    const text = (await page.locator('body').innerText()).replace(/\u00a0|\u202f/g, ' ');
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const fees = extractFeesFromText(text);
    const plans: ScrapedPlan[] = [];
    let network: 'Orange' | 'SFR' | 'Bouygues Telecom' | null = null;

    for (let index = 0; index < lines.length; index += 1) {
      const heading = lines[index].match(NETWORK_HEADING);
      if (heading) {
        const value = heading[1].toLowerCase();
        network = value.startsWith('bouygues') ? 'Bouygues Telecom' : value === 'sfr' ? 'SFR' : 'Orange';
        continue;
      }
      if (!network) continue;

      const dataMatch = lines[index].match(/^(\d{1,4})\s*Go$/i);
      if (!dataMatch) continue;
      const dataGb = Number.parseInt(dataMatch[1], 10);
      const nearby = lines.slice(Math.max(0, index - 2), Math.min(lines.length, index + 10));
      const priceMatch = lines[index + 1]?.match(/^(\d{1,3})[,.](\d{2})\s*€$/);
      if (!priceMatch) continue;

      const euMarker = nearby.findIndex((line) => /Go EU\s*&\s*DOM/i.test(line));
      const euMatch = euMarker >= 0 ? nearby.slice(euMarker + 1).join(' ').match(/(\d{1,3})\s*Go/i) : null;
      const generation = nearby.some((line) => /^5G$/i.test(line)) ? '5G' : '4G';
      const price = Number.parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
      const key = `${network}-${dataGb}-${price}`;
      if (plans.some((plan) => `${plan.network}-${plan.dataGb}-${plan.price}` === key)) continue;

      plans.push({
        operator: 'YouPrice',
        planName: `Forfait YouPrice ${dataGb} Go (${network})`,
        dataGb,
        price,
        calls: 'Illimités',
        network,
        networkGeneration: generation,
        dataEuGb: euMatch ? Number.parseInt(euMatch[1], 10) : undefined,
        simPrice: fees.simPrice ?? undefined,
        activationPrice: fees.activationPrice ?? undefined,
        cancellationPrice: fees.cancellationPrice ?? 0,
      });
    }

    return plans;
  } catch (error) {
    console.error('Erreur dans la collecte YouPrice:', error);
    return [];
  }
};
