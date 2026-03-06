import type { ScraperConfig, ScrapedPlan } from './types';

export const laPosteMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));

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
                const dataMatch = lines[i].match(/^(\d{1,4})\s*(Go|Mo)\s*$/i);
                if (!dataMatch) continue;

                const rawData = parseInt(dataMatch[1], 10);
                const unit = dataMatch[2].toLowerCase();
                const dataGb = unit === 'mo' ? rawData / 1000 : rawData;
                if (dataGb <= 0 || dataGb > 1000) continue;

                // Look for the *regular* price (after promo) in nearby lines
                // Pattern: "pendant 3 mois puis XX€XX" or just "XX€XX"
                let price = 0;
                let promoPrice = 0;
                const calls = 'Illimités';

                for (let j = i + 1; j < Math.min(lines.length, i + 25); j++) {
                    const clean = lines[j].replace(/\u00a0/g, ' ').trim();

                    // Regular price after promo: "pendant 3 mois puis 19€99"
                    const afterPromo = clean.match(/puis\s+(\d{1,3})€(\d{2})/i);
                    if (afterPromo) {
                        price = parseFloat(`${afterPromo[1]}.${afterPromo[2]}`);
                        continue;
                    }

                    // Standalone price: "XX€XX/mois" or "XX€XX"
                    if (promoPrice === 0) {
                        const priceMatch = clean.match(/^(\d{1,3})€(\d{2})/);
                        if (priceMatch) {
                            promoPrice = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                        }
                    }

                    // Stop at next data block
                    if (/^\d{1,4}\s*(Go|Mo)\s*$/i.test(clean) && j > i + 3) break;
                }

                // Use regular price if found, otherwise fall back to first price seen
                const finalPrice = price > 0 ? price : promoPrice;
                if (finalPrice <= 0) continue;

                const planName = `Forfait La Poste Mobile ${dataMatch[1]} ${dataMatch[2]}`;

                let gen = '4G';
                for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 25); j++) {
                    if (/\b5g\b/i.test(lines[j])) { gen = '5G'; break; }
                }
                if (gen === '4G') {
                    const s = String(rawData);
                    for (const img of Array.from(document.querySelectorAll('img'))) {
                        if (!/5g/i.test(`${img.getAttribute('alt') || ''} ${img.getAttribute('src') || ''}`)) continue;
                        let p: Element | null = img;
                        for (let d = 0; d < 10 && p; d++, p = p.parentElement)
                            if ((p.textContent || '').includes(s) && /go/i.test(p.textContent || '')) { gen = '5G'; break; }
                        if (gen === '5G') break;
                    }
                }
                if (gen === '4G') {
                    const s = String(rawData);
                    for (const el of Array.from(document.querySelectorAll('[class*="5g"],[class*="5G"],[aria-label*="5g"],[aria-label*="5G"]'))) {
                        let p: Element | null = el;
                        for (let d = 0; d < 10 && p; d++, p = p.parentElement)
                            if ((p.textContent || '').includes(s) && /go/i.test(p.textContent || '')) { gen = '5G'; break; }
                        if (gen === '5G') break;
                    }
                }
                if (dataGb < 1) gen = '4G';

                let euGb = 0;
                for (let j = i; j < Math.min(lines.length, i + 20); j++) {
                    const euMatch = lines[j].match(/\+?\s*(\d{1,3})\s*[Gg]o\s*(?:depuis|en|utilisables?)?\s*(?:l')?(?:europ|UE|DOM)/i);
                    if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                    const euMatch2 = lines[j].match(/(?:europ|UE|DOM)\D*(\d{1,3})\s*[Gg]o/i);
                    if (euMatch2) { euGb = parseInt(euMatch2[1], 10); break; }
                }

                if (!results.some(r => r.dataGb === dataGb && r.price === finalPrice)) {
                    results.push({ planName, dataGb, price: finalPrice, calls, networkGeneration: gen, dataEuGb: euGb });
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
                operator: 'La Poste Mobile',
                network: 'Bouygues',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
            }));
    } catch (error) {
        console.error('Erreur dans la collecte La Poste Mobile:', error);
        return [];
    }
};
