import type { ScraperConfig, ScrapedPlan } from './types';

export const nrjMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 6000));

        try {
            const acceptBtn = await page.$('#didomi-notice-agree-button, button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler');
            if (acceptBtn) await acceptBtn.click();
            await new Promise(r => setTimeout(r, 1500));
        } catch (_) { }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 3000));

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string; dataEuGb: number }[] = [];
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            for (let i = 0; i < lines.length; i++) {
                let rawData = 0;
                let unit = '';
                let dataLineIdx = i;

                // Case 1: "30 Go" on same line
                const dataMatch = lines[i].match(/^(\d{1,4})\s*(Go|Mo)\s*$/i);
                if (dataMatch) {
                    rawData = parseInt(dataMatch[1], 10);
                    unit = dataMatch[2];
                }

                // Case 2: number alone then "Go"/"Mo" on next line (EI Telecom rendering)
                if (!dataMatch && /^\d{1,4}$/.test(lines[i])) {
                    const next = (lines[i + 1] || '').trim();
                    if (/^(Go|Mo)$/i.test(next)) {
                        rawData = parseInt(lines[i], 10);
                        unit = next;
                        dataLineIdx = i;
                    }
                }

                if (rawData <= 0) continue;
                const dataGb = unit.toLowerCase() === 'mo' ? rawData / 1000 : rawData;
                if (dataGb <= 0 || dataGb > 1000) continue;

                let price = 0;
                const calls = 'Illimités';

                for (let j = dataLineIdx + 1; j < Math.min(lines.length, dataLineIdx + 25); j++) {
                    const clean = lines[j].replace(/\u00a0/g, ' ').trim();

                    // "4€99" or "17€49 /mois"
                    const inlineMatch = clean.match(/^(\d{1,3})€(\d{2})/);
                    if (inlineMatch && price === 0) {
                        price = parseFloat(`${inlineMatch[1]}.${inlineMatch[2]}`);
                        continue;
                    }

                    // Number alone then "€XX" on next line
                    if (/^\d{1,2}$/.test(clean) && price === 0) {
                        const nextLine = (j + 1 < lines.length) ? lines[j + 1].replace(/\u00a0/g, ' ').trim() : '';
                        const centsMatch = nextLine.match(/€\s*(\d{2})/);
                        if (centsMatch) {
                            price = parseInt(clean, 10) + parseInt(centsMatch[1], 10) / 100;
                            continue;
                        }
                        if (/^€/.test(nextLine) && !centsMatch) {
                            price = parseInt(clean, 10);
                            continue;
                        }
                    }

                    // "X,XX€"
                    const stdMatch = clean.match(/(\d{1,3})[,.](\d{2})\s*€/);
                    if (stdMatch && price === 0) {
                        price = parseFloat(`${stdMatch[1]}.${stdMatch[2]}`);
                    }

                    // Stop at next data block
                    if (/^\d{1,4}\s*(Go|Mo)\s*$/i.test(clean) && j > dataLineIdx + 3) break;
                    if (/^\d{1,4}$/.test(clean) && /^(Go|Mo)$/i.test((lines[j + 1] || '').trim()) && j > dataLineIdx + 3) break;
                }

                if (price <= 0) continue;

                let gen = '4G';
                for (let j = Math.max(0, dataLineIdx - 3); j < Math.min(lines.length, dataLineIdx + 20); j++) {
                    if (/\b5g\b/i.test(lines[j])) { gen = '5G'; break; }
                }

                let euGb = 0;
                for (let j = dataLineIdx; j < Math.min(lines.length, dataLineIdx + 20); j++) {
                    const euMatch = lines[j].match(/\+?\s*(\d{1,3})\s*[Gg]o\s*(?:depuis|en|utilisables?)?\s*(?:l')?(?:europ|UE|DOM)/i);
                    if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                    const euMatch2 = lines[j].match(/(?:europ|UE|DOM)\D*(\d{1,3})\s*[Gg]o/i);
                    if (euMatch2) { euGb = parseInt(euMatch2[1], 10); break; }
                }

                const planName = `Forfait NRJ Mobile ${rawData} ${unit}`;

                if (!results.some(r => r.dataGb === dataGb && r.price === price)) {
                    results.push({ planName, dataGb, price, calls, networkGeneration: gen, dataEuGb: euGb });
                }
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
                operator: 'NRJ Mobile',
                network: 'Bouygues',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
            }));
    } catch (error) {
        console.error('Erreur dans la collecte NRJ Mobile:', error);
        return [];
    }
};
