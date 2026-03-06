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

            for (let i = 0; i < lines.length; i++) {
                let price = 0;

                const priceMatch = lines[i].match(/^(\d{1,3})\s*€(\d{2})\s*\/?\s*mois/i);
                if (priceMatch) {
                    price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                } else if (/^\d{1,2}$/.test(lines[i])) {
                    const next = (lines[i + 1] || '').trim();
                    const splitMatch = next.match(/^€(\d{2})\s*\/?\s*mois/i);
                    if (splitMatch) {
                        price = parseInt(lines[i], 10) + parseInt(splitMatch[1], 10) / 100;
                    }
                }

                if (price <= 0 || price > 50) continue;

                let dataGb = 0;
                for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 5); j++) {
                    if (j === i) continue;
                    const dm = lines[j].match(/^(\d{2,4})\s*Go\s+\d{2,4}\s*Go\s*$/i);
                    if (dm) { dataGb = parseInt(dm[1], 10); break; }
                    const dm2 = lines[j].match(/^(\d{2,4})\s*Go\s*$/i);
                    if (dm2 && parseInt(dm2[1], 10) >= 50) { dataGb = parseInt(dm2[1], 10); break; }
                }

                if (dataGb <= 0 || seenDataGb.has(dataGb)) continue;
                seenDataGb.add(dataGb);

                let planLabel = '';
                for (let j = Math.max(0, i - 5); j < i; j++) {
                    if (/^(lesept|leneuf|ledouze|lecinq|lequinze|levingt)$/i.test(lines[j])) {
                        planLabel = lines[j]; break;
                    }
                }

                let gen = '4G';
                for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 10); j++) {
                    if (/\b5g\b/i.test(lines[j])) { gen = '5G'; break; }
                }

                let euGb = 0;
                if (planLabel) {
                    const planId = planLabel.toLowerCase();
                    for (let j = i + 10; j < lines.length; j++) {
                        if (lines[j].toLowerCase() === planId) {
                            for (let k = j; k < Math.min(lines.length, j + 15); k++) {
                                const euMatch = lines[k].match(/(\d{1,3})\s*Go.*?(?:UE|DOM|union|europ)/i);
                                if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                                const euMatch2 = lines[k].match(/(?:UE|DOM|union|europ).*?(\d{1,3})\s*Go/i);
                                if (euMatch2) { euGb = parseInt(euMatch2[1], 10); break; }
                            }
                            break;
                        }
                    }
                }
                if (euGb === 0) {
                    for (let j = i; j < Math.min(lines.length, i + 30); j++) {
                        const euMatch = lines[j].match(/(\d{1,3})\s*Go.*?(?:UE|DOM|union|europ)/i);
                        if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                        if (j > i + 5 && /^\d{1,3}\s*€\d{2}\s*\/?\s*mois/i.test(lines[j])) break;
                    }
                }

                const name = planLabel
                    ? `Forfait Syma Mobile ${planLabel} ${dataGb} Go`
                    : `Forfait Syma Mobile ${dataGb} Go`;

                results.push({
                    planName: name,
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
