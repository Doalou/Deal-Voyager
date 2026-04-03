import type { ScraperConfig } from './types';

export const chezSwitchScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));

        // Fermer cookie banner
        try {
            const btn = await page.$('button[id*="accept"], [class*="cookie"] button, #didomi-notice-agree-button');
            if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 1000)); }
        } catch { }

        // Cliquer sur "Voir tous nos forfaits" si present
        try {
            const voirTous = await page.$('a[href*="forfait"], button:has-text("Voir tous")');
            if (voirTous) { await voirTous.click(); await new Promise(r => setTimeout(r, 2000)); }
        } catch { }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 3000));

        const plans = await page.evaluate(() => {
            const results: {
                planName: string; dataGb: number; price: number; calls: string;
                networkGeneration: string; dataEuGb: number;
            }[] = [];

            const bodyText = (document.body.innerText || '').replace(/\u00a0/g, ' ');

            // Chez Switch a des forfaits nommes SWITCH XGO avec prix fixe
            // Pattern dans le texte : "SWITCH 2GO\n2Go" + "X,XX euro/MOIS"
            // Ou "XXX GO - X,XX euro/MOIS"

            // Strategie 1 : chercher les blocs "SWITCH XGO" avec data et prix
            const switchRegex = /(?:SWITCH|FORFAIT|A\s*PARTIR\s*DE)\s+(\d+)\s*GO.*?(\d{1,3})\s*Go.*?Internet\s*:\s*(\d{1,3})\s*Go/gis;
            let sm;
            while ((sm = switchRegex.exec(bodyText)) !== null) {
                const dataGb = parseInt(sm[3] || sm[1], 10);
                if (dataGb > 0 && dataGb <= 1000) {
                    const nearText = bodyText.substring(Math.max(0, sm.index - 200), sm.index + sm[0].length + 200);
                    const priceMatch = nearText.match(/(\d{1,3})[\.,\u20ac€](\d{2})\s*(?:\u20ac|€)?/);
                    if (priceMatch) {
                        const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                        if (price > 0 && price < 100) {
                            const gen = /5g/i.test(nearText) ? '5G' : '4G';
                            if (!results.some(r => r.dataGb === dataGb)) {
                                results.push({
                                    planName: `Switch ${dataGb} Go`,
                                    dataGb,
                                    price,
                                    calls: dataGb <= 5 ? '2h' : 'Illimités',
                                    networkGeneration: gen,
                                    dataEuGb: 0,
                                });
                            }
                        }
                    }
                }
            }

            // Strategie 2 : chercher pattern "XXX GO - X,XX euro/MOIS" (slider header)
            const headerRegex = /(\d{1,3})\s*GO\s*[-\u2013\s]*(\d{1,3})[\.,\u20ac€](\d{2})\s*(?:\u20ac|€)?\s*(?:\/\s*MOIS)?/gi;
            let hm;
            while ((hm = headerRegex.exec(bodyText)) !== null) {
                const dataGb = parseInt(hm[1], 10);
                const price = parseFloat(`${hm[2]}.${hm[3]}`);
                if (dataGb > 0 && price > 0 && price < 100) {
                    if (!results.some(r => r.dataGb === dataGb)) {
                        results.push({
                            planName: `Switch ${dataGb} Go`,
                            dataGb,
                            price,
                            calls: 'Illimités',
                            networkGeneration: '4G',
                            dataEuGb: 0,
                        });
                    }
                }
            }

            // Strategie 3 : fallback textuel generique
            const lines = bodyText.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
            for (let i = 0; i < lines.length; i++) {
                const dataMatch = lines[i].match(/^(\d{1,4})\s*(Go|Mo)$/i) || lines[i].match(/(?:Forfait|Switch)\s*(\d{1,4})\s*(Go|Mo)/i) || lines[i].match(/(\d{1,4})\s*GIGA/i);
                if (!dataMatch) continue;
                const rawData = parseInt(dataMatch[1], 10);
                const unit = (dataMatch[2] || '').toLowerCase();
                const dataGb = (unit === 'mo') ? rawData / 1000 : rawData;
                if (dataGb <= 0 || dataGb > 1000) continue;

                let price = 0;
                for (let j = Math.max(0, i - 10); j < Math.min(lines.length, i + 15); j++) {
                    const priceLine = lines[j].match(/(\d{1,3})[\.,\u20ac€](\d{2})\s*(?:\u20ac|€)?/);
                    if (priceLine) {
                        const testPrice = parseFloat(`${priceLine[1]}.${priceLine[2]}`);
                        // On évite les prix improbables pour des forfaits
                        if (testPrice > 0 && testPrice < 100) {
                            price = testPrice;
                            break;
                        }
                    }
                }

                if (price > 0 && price < 100 && !results.some(function(r) { return r.dataGb === dataGb; })) {
                    let gen = '4G';
                    const contextText = lines.slice(Math.max(0, i - 10), Math.min(lines.length, i + 10)).join(' ');
                    if (/\b5g\b/i.test(contextText)) {
                        gen = '5G';
                    }
                    results.push({
                        planName: `Switch ${dataGb >= 1 ? dataGb + ' Go' : (dataGb * 1000) + ' Mo'}`,
                        dataGb,
                        price,
                        calls: 'Illimités',
                        networkGeneration: gen,
                        dataEuGb: 0,
                    });
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
                operator: 'Chez Switch',
                network: 'SFR',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Chez Switch:', error);
        return [];
    }
};
