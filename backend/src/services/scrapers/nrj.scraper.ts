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
            const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string; dataEuGb: number; simPrice: number | null; activationPrice: number | null; cancellationPrice: number | null }[] = [];
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            let activationPrice: number | null = null;
            const lowerBody = bodyText.toLowerCase();
            const actPats = [
                /frais\s*(?:d['\u2019e]\s*)?activation\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
                /frais\s*(?:de\s*)?mise\s*en\s*service\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
                /frais\s*(?:de\s*)?souscription\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
            ];
            for (const p of actPats) {
                const m = lowerBody.match(p);
                if (m) { activationPrice = parseFloat(m[1].replace(',', '.')); break; }
            }

            let cancellationPrice: number | null = null;
            const cancelPats = [
                /frais\s*(?:de\s*)?r[\u00e9e]siliation\s*(?::|de)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
                /r[ée]siliation\s*gratuit/i,
            ];
            for (const cp of cancelPats) {
                if (cp.source.includes('gratuit') && cp.test(lowerBody)) {
                    cancellationPrice = 0; break;
                }
                const m = lowerBody.match(cp);
                if (m && m[1]) { cancellationPrice = parseFloat(m[1].replace(',', '.')); break; }
            }

            for (let i = 0; i < lines.length; i++) {
                let rawData = 0;
                let unit = '';
                let dataLineIdx = i;
                let isUnlimited = false;

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

                // Case 3: "Illimité" / "illimitée" / "Unlimited" plan
                if (!dataMatch && rawData === 0) {
                    const lower = lines[i].toLowerCase();
                    if (/^illimit[ée]/i.test(lines[i]) || /^série\s+spéciale\s+illimit/i.test(lines[i])) {
                        isUnlimited = true;
                        // Use a sentinel value for unlimited
                        rawData = -1;
                        unit = 'Go';
                        dataLineIdx = i;
                    }
                }

                if (rawData === 0) continue;
                const dataGb = isUnlimited ? -1 : (unit.toLowerCase() === 'mo' ? rawData / 1000 : rawData);
                if (!isUnlimited && (dataGb <= 0 || dataGb > 1000)) continue;

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
                    if (/^illimit[ée]/i.test(clean) && j > dataLineIdx + 3) break;
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

                // Détecter le prix de la carte SIM dans les lignes proches
                let simPrice: number | null = null;
                for (let j = Math.max(0, dataLineIdx - 10); j < Math.min(lines.length, dataLineIdx + 25); j++) {
                    const simMatch = lines[j].match(/carte\s*sim\s*(?:à|a|:)?\s*(\d+)\s*€/i);
                    if (simMatch) { simPrice = parseInt(simMatch[1], 10); break; }
                    const simMatch2 = lines[j].match(/(\d+)\s*€.*?carte\s*sim/i);
                    if (simMatch2) { simPrice = parseInt(simMatch2[1], 10); break; }
                    const livrMatch = lines[j].match(/frais\s*(?:de\s*)?(?:livraison|envoi)\s*(?::|à)?\s*(\d+(?:[,.]\d{2})?)\s*€/i);
                    if (livrMatch) { simPrice = parseFloat(livrMatch[1].replace(',', '.')); break; }
                    if (/sim\s*gratuit|sim\s*offert/i.test(lines[j])) { simPrice = 0; break; }
                }

                const displayData = isUnlimited ? 'Illimité' : `${rawData} ${unit}`;
                const planName = `Forfait NRJ Mobile ${displayData}`;
                // For unlimited plans, use a very high dataGb for sorting/comparison
                const finalDataGb = isUnlimited ? 9999 : dataGb;

                if (!results.some(r => r.dataGb === finalDataGb && r.price === price)) {
                    results.push({ planName, dataGb: finalDataGb, price, calls, networkGeneration: gen, dataEuGb: euGb, simPrice, activationPrice, cancellationPrice });
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
                simPrice: plan.simPrice ?? undefined,
                activationPrice: plan.activationPrice ?? undefined,
                cancellationPrice: plan.cancellationPrice ?? undefined
            }));
    } catch (error) {
        console.error('Erreur dans la collecte NRJ Mobile:', error);
        return [];
    }
};
