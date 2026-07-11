import type { ScrapedPlan, ScraperConfig } from './types';
import { extractFeesFromText, extractVisibleTextFromHtml } from './utils';

const PLAN_NAMES = ['INFINITY', 'ULTRA', 'MAXI', 'MINI'] as const;

export const akeoScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  try {
    const text = (await page.locator('body').innerText()).replace(/\u00a0|\u202f/g, ' ');
    return parseAkeoText(text);
  } catch (error) {
    console.error('Erreur dans la collecte Akeo Telecom:', error);
    return [];
  }
};

export function parseAkeoText(text: string): ScrapedPlan[] {
    text = text.split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
    const fees = extractFeesFromText(text);
    const plans: ScrapedPlan[] = [];

    for (let index = 0; index < PLAN_NAMES.length; index += 1) {
      const name = PLAN_NAMES[index];
      const start = text.search(new RegExp(`^${name}$`, 'mi'));
      if (start < 0) continue;
      const nextName = PLAN_NAMES[index + 1];
      const rest = text.slice(start + name.length);
      const nextOffset = nextName ? rest.search(new RegExp(`^${nextName}$`, 'mi')) : -1;
      const block = nextOffset >= 0 ? rest.slice(0, nextOffset) : rest.slice(0, 1800);
      const dataMatch = block.match(/(\d{1,3})\s*Go\s+d['’]internet mobile/i);
      const orangeMatch = block.match(/Orange[\s\S]*?ou\s+(\d{1,2})[,.](\d{2})\s*€\s*\/\s*mois/i);
      const bouyguesMatch = block.match(/Bouygues Telecom[\s\S]*?ou\s+(\d{1,2})[,.](\d{2})\s*€\s*\/\s*mois/i);
      if (!dataMatch || !orangeMatch || !bouyguesMatch) continue;
      const dataGb = Number.parseInt(dataMatch[1], 10);
      const euMatch = block.match(/dont\s+(\d{1,3})\s*Go\s+utilisables/i);
      const dataEuGb = euMatch ? Number.parseInt(euMatch[1], 10) : dataGb;
      const calls = name === 'MINI' ? '10h' : 'Illimités';
      const variants = [
        { network: 'Orange' as const, price: Number.parseFloat(`${orangeMatch[1]}.${orangeMatch[2]}`), generation: '4G' },
        { network: 'Bouygues Telecom' as const, price: Number.parseFloat(`${bouyguesMatch[1]}.${bouyguesMatch[2]}`), generation: '5G' },
      ];
      for (const variant of variants) {
        plans.push({
          operator: 'Akeo Telecom',
          planName: `Forfait Akeo ${name.charAt(0)}${name.slice(1).toLowerCase()} (${variant.network})`,
          dataGb,
          price: variant.price,
          calls,
          network: variant.network,
          networkGeneration: variant.generation,
          dataEuGb,
          simPrice: fees.simPrice ?? undefined,
          activationPrice: fees.activationPrice ?? undefined,
          cancellationPrice: fees.cancellationPrice ?? undefined,
        });
      }
    }
    return plans;
}

export const akeoHtmlScrapeLogic = (html: string) =>
  parseAkeoText(extractVisibleTextFromHtml(html));
