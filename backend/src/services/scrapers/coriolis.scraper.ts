import type { ScraperConfig } from './types';

export const coriolisScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    console.log('Extraction des données de la page Coriolis...');
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
            const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string }[] = [];
            const bodyText = document.body.innerText;
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

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
                        // Only check the plan line itself and 1 line after for explicit "5G"
                        const cardText = lines.slice(i, Math.min(lines.length, i + 2)).join(' ');
                        const gen = /\b5g\b/i.test(cardText) ? '5G' : '4G';

                        results.push({
                            planName: `Coriolis ${planName} ${dataGb} Go`,
                            dataGb,
                            price,
                            calls: 'Illimités',
                            networkGeneration: gen
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
                        // Only check the plan name and 2 lines around data for explicit "5G"
                        const cardText = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 2)).join(' ');
                        const gen = /\b5g\b/i.test(cardText) ? '5G' : '4G';

                        results.push({
                            planName: planName ? `Coriolis ${planName} ${dataGb} Go` : `Coriolis ${dataGb} Go`,
                            dataGb,
                            price,
                            calls: 'Illimités',
                            networkGeneration: gen
                        });
                    }
                }
            }

            return results;
        });

        console.log(`[Coriolis] Plans extraits :`, JSON.stringify(plans));
        for (const p of plans) {
            console.log(`[Coriolis] Trouvé : ${p.planName} — ${p.dataGb} Go à ${p.price}€/mois (${p.networkGeneration})`);
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
                networkGeneration: plan.networkGeneration
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Coriolis:', error);
        return [];
    }
};
