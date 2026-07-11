import type { ScrapedPlan, ScraperConfig } from './types';
import { extractFeesFromText } from './utils';

const NORDNET_DATA = [1, 30, 70, 100, 150] as const;

export const nordnetScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  try {
    const initialText = (await page.locator('body').innerText()).replace(/\u00a0|\u202f/g, ' ');
    const fees = extractFeesFromText(initialText);
    const plans: ScrapedPlan[] = [];

    for (const dataGb of NORDNET_DATA) {
      const tab = page.locator('[role="tab"][aria-controls]').filter({ hasText: new RegExp(`\\b${dataGb}\\s*Go\\b`, 'i') }).first();
      const panelId = await tab.getAttribute('aria-controls');
      const block = panelId
        ? (await page.locator(`#${panelId}`).textContent().catch(() => null) ?? '').replace(/\u00a0|\u202f/g, ' ')
        : '';
      const priceMatch = block.match(/(\d{1,2})\s*€\s*(\d{2})\s*(?:par\s*mois|\/\s*mois)/i);
      if (!priceMatch) continue;
      plans.push({
        operator: 'Nordnet',
        planName: `Nordnet ${dataGb} Go`,
        dataGb,
        price: Number.parseFloat(`${priceMatch[1]}.${priceMatch[2]}`),
        calls: 'Illimités',
        network: 'Orange',
        networkGeneration: dataGb >= 100 ? '5G' : '4G',
        dataEuGb: dataGb,
        simPrice: fees.simPrice ?? 10,
        activationPrice: fees.activationPrice ?? undefined,
        cancellationPrice: fees.cancellationPrice ?? 0,
      });
    }
    return plans;
  } catch (error) {
    console.error('Erreur dans la collecte Nordnet:', error);
    return [];
  }
};
