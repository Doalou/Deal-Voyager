import type { ScraperConfig } from './types';

export const youPriceScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 3000));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number; calls: string; network: string; networkGeneration: string; dataEuGb: number; simPrice: number | null; activationPrice: number | null; cancellationPrice: number | null }[] = [];

            const allText = document.body.innerText;
            const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // Détection globale du prix SIM
            let simPrice: number | null = null;
            const lower = allText.toLowerCase();
            if (/sim\s*gratuit/i.test(lower) || /sim\s*offert/i.test(lower) || /livraison\s*gratuit/i.test(lower) || /frais\s*de\s*livraison\s*offert/i.test(lower)) {
                simPrice = 0;
            } else {
                const sp = [
                    /carte\s*sim\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                    /activation\s*sim\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                    /(\d+(?:[,.]\d{2})?)\s*€[^\n]{0,30}(?:carte\s*sim|activation\s*sim)/i,
                    /frais\s*(?:de\s*)?(?:livraison|envoi)\s*(?:de\s*(?:la\s*)?carte\s*sim)?\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*[\u20ac€]/i,
                    /livraison\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*[\u20ac€]/i,
                ];
                for (const pat of sp) {
                    const m = lower.match(pat);
                    if (m) { simPrice = parseFloat(m[1].replace(',', '.')); break; }
                }
            }

            let activationPrice: number | null = null;
            const actPats = [
                /frais\s*(?:d['\u2019e]\s*)?activation\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
                /frais\s*(?:de\s*)?mise\s*en\s*service\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
                /frais\s*(?:de\s*)?souscription\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
            ];
            for (const p of actPats) {
                const m = lower.match(p);
                if (m) { activationPrice = parseFloat(m[1].replace(',', '.')); break; }
            }

            let cancellationPrice: number | null = 0;
            if (/frais\s*(?:de\s*)?r[\u00e9e]siliation\s*(?::|de)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i.test(lower)) {
                const m = lower.match(/frais\s*(?:de\s*)?r[\u00e9e]siliation\s*(?::|de)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i);
                if (m) cancellationPrice = parseFloat(m[1].replace(',', '.'));
            }

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
                    planName: `Forfait YouPrice ${dataGb >= 1 ? dataGb + ' Go' : (dataGb * 1000) + ' Mo'} (${currentNetwork})`,
                    dataGb,
                    price,
                    calls: 'Illimités',
                    network: currentNetwork,
                    networkGeneration: gen,
                    dataEuGb: euGb,
                    simPrice,
                    activationPrice,
                    cancellationPrice
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
                    dataEuGb: plan.dataEuGb || undefined,
                    simPrice: plan.simPrice ?? undefined,
                    activationPrice: plan.activationPrice ?? undefined,
                    cancellationPrice: plan.cancellationPrice ?? undefined
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
