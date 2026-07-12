import type { ScrapedPlan, ScraperConfig } from './types';
import { extractFeesFromText, extractVisibleTextFromHtml } from './utils';

export function parseLebaraText(rawText: string): ScrapedPlan[] {
  const text = rawText.replace(/[\u00a0\u202f]/g, ' ');
  const lines = text.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const fees = extractFeesFromText(text);

  if (fees.simPrice == null && /(?:carte\s*sim|eSIM)[^.;]{0,60}(?:gratuite?|offerte?|à\s*0\s*€)|sim\s+pour\s+0\s*€/i.test(text)) fees.simPrice = 0;
  if (fees.activationPrice == null && /(?:aucuns?|sans)\s+frais\s+(?:d['’]?activation|de\s+livraison)/i.test(text)) fees.activationPrice = 0;
  if (fees.cancellationPrice == null && /(?:sans\s+engagement|sans\s+frais\s+de\s+r[ée]siliation)/i.test(text)) fees.cancellationPrice = 0;

  const plans: ScrapedPlan[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const dataMatch = lines[index].match(/^(\d{1,4})\s*(Go|Mo)$/i);
    if (!dataMatch) continue;

    const contextStart = Math.max(0, index - 5);
    let contextEnd = Math.min(lines.length, index + 18);
    for (let next = index + 1; next < contextEnd; next += 1) {
      if (/^(?:offre\s+exclusive|forfait\s+mensuel|🔥)/i.test(lines[next])) {
        contextEnd = next;
        break;
      }
    }
    const context = lines.slice(contextStart, contextEnd).join('\n');
    if (!/(?:forfait\s+mensuel|nouvelle\s+souscription|appels?\/sms|renouvellement\s+tous\s+les\s+30\s+jours)/i.test(context)) continue;

    const priceText = lines.slice(index, Math.min(contextEnd, index + 7)).join(' ');
    const priceMatch = priceText.match(/(\d{1,2})[,.](\d{2})\s*€\s*(?:\/\s*)?(?:mois|month)?/i);
    if (!priceMatch) continue;

    const rawData = Number.parseInt(dataMatch[1], 10);
    const dataGb = dataMatch[2].toLowerCase() === 'mo' ? rawData / 1000 : rawData;
    const price = Number.parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
    if (dataGb <= 0 || dataGb > 1000 || price <= 0 || price >= 100) continue;

    const euMatch = context.match(/dont\s+(\d{1,3})\s*Go[^\n]{0,80}(?:UE|Europe|DOM)/i)
      ?? context.match(/(\d{1,3})\s*Go[^\n]{0,50}(?:itin[ée]rance|roaming)/i);
    const dataEuGb = euMatch ? Number.parseInt(euMatch[1], 10) : undefined;
    const networkGeneration = /\b5G\b/i.test(context) ? '5G' : '4G';

    if (!plans.some(plan => plan.dataGb === dataGb && plan.price === price)) {
      plans.push({
        operator: 'Lebara',
        planName: `Forfait Lebara ${dataGb >= 1 ? `${dataGb} Go` : `${rawData} Mo`}`,
        dataGb,
        price,
        calls: 'Illimités',
        network: 'SFR',
        networkGeneration,
        dataEuGb,
        simPrice: fees.simPrice ?? undefined,
        activationPrice: fees.activationPrice ?? undefined,
        cancellationPrice: fees.cancellationPrice ?? undefined,
      });
    }
  }

  return plans;
}

export const lebaraHtmlScrapeLogic: NonNullable<ScraperConfig['htmlScrapeFunction']> = (html) =>
  parseLebaraText(extractVisibleTextFromHtml(html));

export const lebaraScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  try {
    await page.waitForTimeout(2500);
    return parseLebaraText(await page.locator('body').innerText());
  } catch (error) {
    console.error('Erreur dans la collecte Lebara:', error);
    return [];
  }
};
