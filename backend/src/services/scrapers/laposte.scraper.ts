import type { ScrapedPlan, ScraperConfig } from './types';
import { extractFeesFromText } from './utils';

export const laPosteMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  try {
    await page.waitForTimeout(1200);
    const initialText = (await page.locator('body').innerText()).replace(/\u00a0|\u202f/g, ' ');
    const fees = extractFeesFromText(initialText);
    const catalogue = initialText.match(/Choisissez un forfait([\s\S]*?)Prix client Box/i)?.[1] ?? '';
    const lines = catalogue.split('\n').map((line) => line.trim()).filter(Boolean);
    const offers: Array<{ dataGb: number; label: string; price: number }> = [];

    for (let index = 0; index < lines.length - 3; index += 1) {
      if (!/^\d{1,4}$/.test(lines[index]) || !/^(Go|Mo)$/i.test(lines[index + 1])) continue;
      const priceMatch = `${lines[index + 2]} ${lines[index + 3]}`.match(/(\d{1,3})\s*€\s*(\d{2})/);
      if (!priceMatch) continue;
      const rawData = Number.parseInt(lines[index], 10);
      const unit = lines[index + 1].toLowerCase();
      const dataGb = unit === 'mo' ? rawData / 1000 : rawData;
      offers.push({
        dataGb,
        label: `${rawData} ${unit === 'mo' ? 'Mo' : 'Go'}`,
        price: Number.parseFloat(`${priceMatch[1]}.${priceMatch[2]}`),
      });
    }

    const plans: ScrapedPlan[] = [];
    for (const offer of offers) {
      let detailText = initialText;
      const selectors = [
        page.getByText(new RegExp(`^${offer.label.replace(' ', '\\s*')}$`, 'i')),
        page.getByText(new RegExp(`^${offer.label.split(' ')[0]}$`)),
      ];
      for (const locator of selectors) {
        const candidate = locator.first();
        if (await candidate.isVisible().catch(() => false)) {
          await candidate.click({ timeout: 1500 }).catch(() => undefined);
          await page.waitForTimeout(350);
          detailText = (await page.locator('body').innerText()).replace(/\u00a0|\u202f/g, ' ');
          break;
        }
      }
      const detailPattern = new RegExp(`Forfait(?:\\s+5G)?\\s*${offer.label.split(' ')[0]}\\s*${offer.label.split(' ')[1]}\\s+d['’]internet[\\s\\S]{0,180}?Dont\\s+(\\d{1,3})\\s*Go`, 'i');
      const euMatch = detailText.match(detailPattern);
      plans.push({
        operator: 'La Poste Mobile',
        planName: `Forfait La Poste Mobile ${offer.label}`,
        dataGb: offer.dataGb,
        price: offer.price,
        calls: 'Illimités',
        network: 'Bouygues Telecom',
        networkGeneration: offer.dataGb >= 100 ? '5G' : '4G',
        dataEuGb: euMatch ? Number.parseInt(euMatch[1], 10) : undefined,
        simPrice: fees.simPrice ?? undefined,
        activationPrice: fees.activationPrice ?? undefined,
        cancellationPrice: fees.cancellationPrice ?? 0,
      });
    }
    return plans;
  } catch (error) {
    console.error('Erreur dans la collecte La Poste Mobile:', error);
    return [];
  }
};
