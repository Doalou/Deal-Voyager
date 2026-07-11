import { chromium } from 'playwright';
import { operatorDefinitions, validateAndNormalizePlans } from '../services/scraper.service';

const concurrency = Math.max(1, Number.parseInt(process.env.SCRAPER_MAX_CONCURRENCY ?? '3', 10) || 3);
const browser = await chromium.launch({ headless: process.env.SCRAPER_HEADLESS !== 'false' });
const outcomes: Array<{ operator: string; offers: number; durationMs: number; error?: string }> = [];
let cursor = 0;

async function worker() {
  while (cursor < operatorDefinitions.length) {
    const definition = operatorDefinitions[cursor++];
    const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1280, height: 960 } });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(30_000);
    const startedAt = Date.now();
    try {
      let navigationError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await page.goto(definition.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
          navigationError = undefined;
          break;
        } catch (error) {
          navigationError = error;
          if (attempt < 2) await page.waitForTimeout(1000 * (attempt + 1));
        }
      }
      if (navigationError) throw navigationError;
      const rawPlans = await definition.scrapeFunction(page);
      const plans = validateAndNormalizePlans(definition, rawPlans);
      if (plans.length < definition.minOffers) {
        throw new Error(`${plans.length}/${definition.minOffers} offre(s) minimum`);
      }
      outcomes.push({ operator: definition.name, offers: plans.length, durationMs: Date.now() - startedAt });
    } catch (error) {
      outcomes.push({
        operator: definition.name,
        offers: 0,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await context.close();
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, operatorDefinitions.length) }, () => worker()));
await browser.close();
outcomes.sort((left, right) => left.operator.localeCompare(right.operator, 'fr'));
console.table(outcomes);
const failures = outcomes.filter((outcome) => outcome.error);
if (failures.length > 0) {
  console.error(`${failures.length} scraper(s) en échec : ${failures.map((failure) => failure.operator).join(', ')}`);
  process.exitCode = 1;
}
