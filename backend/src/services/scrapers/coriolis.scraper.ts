import type { ScraperConfig } from './types';

export const coriolisScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));

        try {
            const acceptBtn = await page.$('#didomi-notice-agree-button, button[id*="accept"], #onetrust-accept-btn-handler');
            if (acceptBtn) {
                await acceptBtn.click();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) { }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string; dataEuGb: number }[] = [];
            const bodyText = document.body.innerText;
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            const detect5G = (dataGb: number, idx: number): string => {
                for (let k = Math.max(0, idx - 5); k < Math.min(lines.length, idx + 30); k++) {
                    if (/\b5g\b/i.test(lines[k])) return '5G';
                }
                const rgx = new RegExp(`\\b${dataGb}\\s*Go`, 'i');
                for (const el of Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,span,p,div,label,a,li,strong,b'))) {
                    const t = (el.textContent || '').trim();
                    if (t.length < 3 || t.length > 100) continue;
                    if (rgx.test(t) && /\b5g\b/i.test(t)) return '5G';
                }
                for (const img of Array.from(document.querySelectorAll('img'))) {
                    if (!/5g/i.test(`${img.getAttribute('alt') || ''} ${img.getAttribute('src') || ''}`)) continue;
                    let p: Element | null = img.parentElement;
                    for (let d = 0; d < 8 && p; d++, p = p.parentElement)
                        if ((p.textContent || '').length < 300 && rgx.test(p.textContent || '')) return '5G';
                }
                return '4G';
            };

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Match "Le [Nom] [optional offerte] XXX Go X€XX par mois" or split across lines
                // Pattern 1: single line "Le Basic 30 Go 4€99par mois"
                const singleLineMatch = line.match(/^(Le\s+\w+).*?(\d{1,4})\s*Go\s*(\d{1,3})€(\d{2})/i);
                if (singleLineMatch) {
                    const planName = singleLineMatch[1].trim();
                    const dataGb = parseInt(singleLineMatch[2], 10);
                    const price = parseFloat(`${singleLineMatch[3]}.${singleLineMatch[4]}`);

                    if (dataGb > 0 && price > 0 && price < 80 && !results.some(r => r.dataGb === dataGb)) {
                        const gen = detect5G(dataGb, i);

                        let euGb = 0;
                        for (let j = i; j < Math.min(lines.length, i + 20); j++) {
                            const euMatch = lines[j].match(/\+?\s*(\d{1,3})\s*[Gg]o\s*(?:depuis|en|utilisables?)?\s*(?:l')?(?:europ|UE|DOM)/i);
                            if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                            const euMatch2 = lines[j].match(/(?:europ|UE|DOM)\D*(\d{1,3})\s*[Gg]o/i);
                            if (euMatch2) { euGb = parseInt(euMatch2[1], 10); break; }
                        }

                        results.push({
                            planName: `Coriolis ${planName} ${dataGb} Go`,
                            dataGb,
                            price,
                            calls: 'Illimités',
                            networkGeneration: gen,
                            dataEuGb: euGb
                        });
                    }
                    continue;
                }

                // Pattern 2: data on one line, price on another
                const dataMatch = line.match(/^(\d{1,4})\s*Go$/i);
                if (dataMatch) {
                    const dataGb = parseInt(dataMatch[1], 10);
                    if (dataGb <= 0 || dataGb > 1000) continue;

                    let planName = '';
                    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
                        if (/^Le\s+\w+/i.test(lines[j])) {
                            planName = lines[j].replace(/offerte/i, '').trim();
                            break;
                        }
                    }

                    let price = 0;
                    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
                        const priceMatch = lines[j].match(/(\d{1,3})€(\d{2})/);
                        if (priceMatch) {
                            price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                            break;
                        }
                        const priceMatch2 = lines[j].match(/(\d{1,3})[,.](\d{2})\s*€/);
                        if (priceMatch2) {
                            price = parseFloat(`${priceMatch2[1]}.${priceMatch2[2]}`);
                            break;
                        }
                    }

                    if (price > 0 && price < 80 && !results.some(r => r.dataGb === dataGb)) {
                        const gen = detect5G(dataGb, i);

                        let euGb = 0;
                        for (let j = i; j < Math.min(lines.length, i + 20); j++) {
                            const euMatch = lines[j].match(/\+?\s*(\d{1,3})\s*[Gg]o\s*(?:depuis|en|utilisables?)?\s*(?:l')?(?:europ|UE|DOM)/i);
                            if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                            const euMatch2 = lines[j].match(/(?:europ|UE|DOM)\D*(\d{1,3})\s*[Gg]o/i);
                            if (euMatch2) { euGb = parseInt(euMatch2[1], 10); break; }
                        }

                        results.push({
                            planName: planName ? `Coriolis ${planName} ${dataGb} Go` : `Coriolis ${dataGb} Go`,
                            dataGb,
                            price,
                            calls: 'Illimités',
                            networkGeneration: gen,
                            dataEuGb: euGb
                        });
                    }
                }
            }

            return results;
        });

        for (const p of plans) {
        }

        return plans
            .filter(p => p.price > 0 && p.dataGb > 0)
            .map(plan => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'Coriolis',
                network: 'SFR',
                networkGeneration: plan.networkGeneration,
                dataEuGb: plan.dataEuGb || undefined
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Coriolis:', error);
        return [];
    }
};
