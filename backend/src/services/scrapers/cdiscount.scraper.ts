import type { ScraperConfig, ScrapedPlan } from './types';

export const cdiscountMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 7000));

        try {
            const acceptBtn = await page.$('#footer_tc_privacy_button_2, button[id*="accept"], #onetrust-accept-btn-handler, .cc-accept, button[class*="cookie"]');
            if (acceptBtn) await acceptBtn.click();
            await new Promise(r => setTimeout(r, 1500));
        } catch (_) { }

        for (let s = 0; s < 3; s++) {
            await page.evaluate((step) => window.scrollTo(0, (step + 1) * (document.body.scrollHeight / 3)), s);
            await new Promise(r => setTimeout(r, 1500));
        }
        await new Promise(r => setTimeout(r, 2000));

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string; dataEuGb: number }[] = [];
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            for (let i = 0; i < lines.length; i++) {
                let rawData = 0;
                let unit = '';
                let dataLineIdx = i;

                // Case 1: "150 Go" on same line
                const dataMatch = lines[i].match(/^(\d{1,4})\s*(Go|Mo)\s*$/i);
                if (dataMatch) {
                    rawData = parseInt(dataMatch[1], 10);
                    unit = dataMatch[2];
                }

                // Case 2: number alone then "Go"/"Mo" on next line
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

                for (let j = dataLineIdx + 1; j < Math.min(lines.length, dataLineIdx + 20); j++) {
                    const clean = lines[j].replace(/\u00a0/g, ' ').trim();

                    // "8€99" or "12€99/mois"
                    const inlineMatch = clean.match(/^(\d{1,3})\s*€(\d{2})/);
                    if (inlineMatch && price === 0) {
                        price = parseFloat(`${inlineMatch[1]}.${inlineMatch[2]}`);
                        continue;
                    }

                    // "X,XX€/mois"
                    const stdMatch = clean.match(/(\d{1,3})[,.](\d{2})\s*€/);
                    if (stdMatch && price === 0) {
                        price = parseFloat(`${stdMatch[1]}.${stdMatch[2]}`);
                        continue;
                    }

                    // Split: number alone then "€XX" on next line
                    if (/^\d{1,2}$/.test(clean) && price === 0) {
                        const nextLine = (j + 1 < lines.length) ? lines[j + 1].replace(/\u00a0/g, ' ').trim() : '';
                        const centsMatch = nextLine.match(/€\s*(\d{2})/);
                        if (centsMatch) {
                            price = parseInt(clean, 10) + parseInt(centsMatch[1], 10) / 100;
                            continue;
                        }
                    }

                    // Stop at next data block
                    if (/^\d{1,4}\s*(Go|Mo)\s*$/i.test(clean) && j > dataLineIdx + 3) break;
                    if (/^\d{1,4}$/.test(clean) && /^(Go|Mo)$/i.test((lines[j + 1] || '').trim()) && j > dataLineIdx + 3) break;
                }

                if (price <= 0) continue;

                let gen = '4G';
                for (let j = Math.max(0, dataLineIdx - 5); j < Math.min(lines.length, dataLineIdx + 25); j++) {
                    if (/\b5g\b/i.test(lines[j])) { gen = '5G'; break; }
                }
                if (gen === '4G') {
                    const rgx = new RegExp(`\\b${rawData}\\s*Go`, 'i');
                    for (const el of Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,span,p,div,label,a,li,strong,b'))) {
                        const t = (el.textContent || '').trim();
                        if (t.length < 3 || t.length > 100) continue;
                        if (rgx.test(t) && /\b5g\b/i.test(t)) { gen = '5G'; break; }
                    }
                }
                if (gen === '4G') {
                    const rgx = new RegExp(`\\b${rawData}\\s*Go`, 'i');
                    for (const img of Array.from(document.querySelectorAll('img'))) {
                        const attrs = `${img.getAttribute('alt') || ''} ${img.getAttribute('src') || ''}`;
                        if (!/5g/i.test(attrs)) continue;
                        let p: Element | null = img.parentElement;
                        for (let d = 0; d < 8 && p; d++, p = p.parentElement) {
                            if ((p.textContent || '').length < 300 && rgx.test(p.textContent || '')) { gen = '5G'; break; }
                        }
                        if (gen === '5G') break;
                    }
                }

                let euGb = 0;
                for (let j = dataLineIdx; j < Math.min(lines.length, dataLineIdx + 20); j++) {
                    const euMatch = lines[j].match(/\+?\s*(\d{1,3})\s*[Gg]o\s*(?:depuis|en|utilisables?)?\s*(?:l')?(?:europ|UE|DOM)/i);
                    if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                    const euMatch2 = lines[j].match(/(?:europ|UE|DOM)\D*(\d{1,3})\s*[Gg]o/i);
                    if (euMatch2) { euGb = parseInt(euMatch2[1], 10); break; }
                }

                const planName = `Forfait Cdiscount Mobile ${rawData} ${unit}`;

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
                operator: 'Cdiscount Mobile',
                network: 'Bouygues',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Cdiscount Mobile:', error);
        return [];
    }
};
