import type { ScraperConfig } from './types';

export const youPriceScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 3000));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number; calls: string; network: string; networkGeneration: string; dataEuGb: number }[] = [];

            const allText = document.body.innerText;
            const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            let currentNetwork = 'Orange / SFR';

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lowerLine = line.toLowerCase();

                if (lowerLine.includes('réseau orange')) currentNetwork = 'Orange';
                else if (lowerLine.includes('réseau sfr')) currentNetwork = 'SFR';
                else if (lowerLine.includes('réseau bouygues')) currentNetwork = 'Bouygues';

                // Title line: "XXGo à YY,YY€/mois"
                const fullMatch = lowerLine.match(/^(\d{1,3})\s*go\s*à\s*(\d{1,2})[,\.](\d{2})€/);
                if (!fullMatch) continue;

                const dataGb = parseInt(fullMatch[1], 10);
                const price = parseFloat(`${fullMatch[2]}.${fullMatch[3]}`);

                // Look AHEAD for "Réseau 4G/5G" and "Go EU & DOM XXGo"
                let gen = '4G';
                let euGb = 0;
                for (let j = i + 1; j < Math.min(lines.length, i + 15); j++) {
                    const ahead = lines[j];
                    if (gen === '4G') {
                        const reseauMatch = ahead.match(/r[ée]seau\s+(4g|5g)/i) || ahead.match(/\b(5g)\b/i);
                        if (reseauMatch) gen = reseauMatch[1].toUpperCase();
                    }
                    const euMatch = ahead.match(/(?:go\s*eu|europe|dom)\D*(\d{1,3})\s*go/i);
                    if (!euMatch) {
                        const euMatch2 = ahead.match(/^(\d{1,3})\s*go$/i);
                        if (euMatch2 && /eu|dom|europe/i.test(lines[j - 1] || '')) {
                            euGb = parseInt(euMatch2[1], 10);
                        }
                    } else {
                        euGb = parseInt(euMatch[1], 10);
                    }
                    if (j > i + 1 && /^\d{1,3}\s*go\s*à\s*\d/i.test(ahead)) break;
                }
                if (gen === '4G') {
                    const s = String(dataGb);
                    for (const img of Array.from(document.querySelectorAll('img'))) {
                        if (!/5g/i.test(`${img.getAttribute('alt') || ''} ${img.getAttribute('src') || ''}`)) continue;
                        let p: Element | null = img;
                        for (let d = 0; d < 10 && p; d++, p = p.parentElement)
                            if ((p.textContent || '').includes(s) && /go/i.test(p.textContent || '')) { gen = '5G'; break; }
                        if (gen === '5G') break;
                    }
                }
                if (gen === '4G') {
                    const s = String(dataGb);
                    for (const el of Array.from(document.querySelectorAll('[class*="5g"],[class*="5G"],[aria-label*="5g"],[aria-label*="5G"]'))) {
                        let p: Element | null = el;
                        for (let d = 0; d < 10 && p; d++, p = p.parentElement)
                            if ((p.textContent || '').includes(s) && /go/i.test(p.textContent || '')) { gen = '5G'; break; }
                        if (gen === '5G') break;
                    }
                }

                results.push({
                    planName: `Forfait YouPrice ${dataGb} Go (${currentNetwork})`,
                    dataGb,
                    price,
                    calls: 'Illimités',
                    network: currentNetwork,
                    networkGeneration: gen,
                    dataEuGb: euGb
                });
            }

            return results;
        });

        // Nettoyage et déduplication
        const uniquePlans = [];
        const seen = new Set();

        for (const plan of plans) {
            const key = `${plan.network}-${plan.dataGb}-${plan.price}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniquePlans.push({
                    planName: plan.planName.charAt(0).toUpperCase() + plan.planName.slice(1),
                    dataGb: plan.dataGb,
                    price: plan.price,
                    calls: plan.calls,
                    operator: 'YouPrice',
                    network: plan.network || 'Orange / SFR',
                    networkGeneration: plan.networkGeneration || '4G',
                    dataEuGb: plan.dataEuGb || undefined
                });
            }
        }

        for (const p of uniquePlans) {
        }

        return uniquePlans;
    } catch (error) {
        console.error('Erreur dans la collecte YouPrice:', error);
        return [];
    }
};
