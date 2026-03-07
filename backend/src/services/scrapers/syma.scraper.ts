import type { ScraperConfig, ScrapedPlan } from './types';

export const symaMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 8000));

        try {
            const acceptBtn = await page.$('#didomi-notice-agree-button, button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler, .cc-accept');
            if (acceptBtn) await acceptBtn.click();
            await new Promise(r => setTimeout(r, 1500));
        } catch (_) { }

        for (let s = 0; s < 3; s++) {
            await page.evaluate((step) => window.scrollTo(0, (step + 1) * (document.body.scrollHeight / 3)), s);
            await new Promise(r => setTimeout(r, 2000));
        }
        await new Promise(r => setTimeout(r, 3000));

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string; dataEuGb: number; simPrice: number }[] = [];
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const seenDataGb = new Set<number>();

            const planNames = ['lesept', 'leneuf', 'ledouze', 'lecinq', 'lequinze', 'levingt'];
            const processedPlans = new Set<string>();

            for (let i = 0; i < lines.length; i++) {
                const lineLower = lines[i].toLowerCase();
                if (!planNames.includes(lineLower) || processedPlans.has(lineLower)) continue;

                const planLabel = lines[i];
                let price = 0;
                let dataGb = 0;
                let euGb = 0;
                let gen = '4G';

                for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 10); j++) {
                    if (price === 0) {
                        const priceMatch = lines[j].match(/(\d{1,3})\s*€\s*(\d{2})/);
                        if (priceMatch) {
                            price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                        }
                    }

                    if (dataGb === 0) {
                        const dataMatch = lines[j].match(/(\d{2,4})\s*Go/i);
                        if (dataMatch && parseInt(dataMatch[1], 10) >= 50) {
                            dataGb = parseInt(dataMatch[1], 10);
                        }
                    }

                    if (/\b5g\b/i.test(lines[j])) gen = '5G';
                }

                if (price <= 0 || price > 50 || dataGb <= 0 || seenDataGb.has(dataGb)) continue;
                seenDataGb.add(dataGb);
                processedPlans.add(lineLower);

                for (let j = i + 15; j < lines.length; j++) {
                    if (lines[j].toLowerCase() === planLabel.toLowerCase()) {
                        for (let k = j; k < Math.min(lines.length, j + 20); k++) {
                            const euMatch = lines[k].match(/(\d{1,3})\s*Go.*?(?:UE|DOM|union|europ)/i);
                            if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                            const euMatch2 = lines[k].match(/(?:UE|DOM|union|europ).*?(\d{1,3})\s*Go/i);
                            if (euMatch2) { euGb = parseInt(euMatch2[1], 10); break; }
                        }
                        break;
                    }
                }

                results.push({
                    planName: `Forfait Syma Mobile ${planLabel} ${dataGb} Go`,
                    dataGb,
                    price,
                    calls: 'Illimités',
                    networkGeneration: gen,
                    dataEuGb: euGb,
                    simPrice: 10
                });
            }

            return results;
        });

        return plans
            .filter(p => p.price > 0 && p.dataGb > 0)
            .map(plan => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'Syma Mobile',
                network: 'SFR',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
                simPrice: plan.simPrice,
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Syma Mobile:', error);
        return [];
    }
};
