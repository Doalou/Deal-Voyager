import type { ScraperConfig, ScrapedPlan } from './types';

export const freeMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string; dataEuGb: number }[] = [];
            const bodyText = document.body.innerText;
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);


            // Identifier les blocs de forfait par titres
            const planBlocks: { startIdx: number; name: string }[] = [];
            for (let i = 0; i < lines.length; i++) {
                if (/^(Forfait|Série)\s/i.test(lines[i]) && lines[i].length < 40) {
                    planBlocks.push({ startIdx: i, name: lines[i] });
                }
            }


            for (const block of planBlocks) {
                let dataGb = 0;
                let price = -1;
                let calls = "Illimités"; // Par défaut

                for (let j = block.startIdx; j < Math.min(block.startIdx + 40, lines.length); j++) {
                    // Stopper si on rencontre un autre bloc
                    if (j > block.startIdx + 2 && /^(Forfait|Série)\s/i.test(lines[j]) && lines[j].length < 40) {
                        break;
                    }

                    // Chercher la data
                    if (dataGb === 0) {
                        const dataMatch = lines[j].match(/(\d{1,4})\s*(Go|Mo)/i);
                        if (dataMatch) {
                            const val = parseInt(dataMatch[1], 10);
                            const unit = dataMatch[2].toLowerCase();
                            dataGb = unit === 'mo' ? val / 1000 : val;
                        }
                    }

                    // Chercher le prix — APPROCHE FLEXIBLE
                    // Le prix peut être affiché de PLUSIEURS façons possibles par innerText:
                    //
                    // Cas 1: "9" seul sur une ligne, suivi de "€99" sur la suivante
                    // Cas 2: "19" seul, suivi de "€99"
                    // Cas 3: "2" seul, suivi de "€" seul
                    // Cas 4: "9,99€/mois" tout en un
                    // Cas 5: "9€99" sur une même ligne
                    // Cas 6: "9" suivi de "€ 99" (avec espace)
                    // Cas 7: les centimes/€ contiennent des espaces insécables (\u00a0)

                    if (price < 0) {
                        // Ignorer les options et les prix abonnés
                        if (/booster|abonné|avantage|pop/i.test(lines[j])) {
                            continue;
                        }

                        // Nettoyer la ligne de tout espace insécable
                        const cleanLine = lines[j].replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
                        const cleanNext = j + 1 < lines.length ? lines[j + 1].replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() : '';

                        // Cas combiné sur une ligne (doit être EXACTEMENT le prix, ex: "9,99€" ou "9,99 €/mois", pas au milieu d'une phrase)
                        const inlineMatch = cleanLine.match(/^(\d{1,3})[,€.](\d{2})\s*€?\s*\/?m?o?i?s?$/);
                        if (inlineMatch) {
                            price = parseFloat(`${inlineMatch[1]}.${inlineMatch[2]}`);
                            continue;
                        }

                        // Nombre seul sur la ligne (1-2 digits)
                        if (/^\d{1,2}$/.test(cleanLine)) {
                            const euros = parseInt(cleanLine, 10);

                            // La ligne suivante contient les centimes
                            // "€99" ou "€ 99" ou "€"
                            const centsMatch = cleanNext.match(/€\s*(\d{2})/);
                            if (centsMatch) {
                                price = euros + parseInt(centsMatch[1], 10) / 100;
                                continue;
                            }
                            // Juste "€" (prix entier)
                            if (/^€$/.test(cleanNext) || /^€\s*$/.test(cleanNext)) {
                                price = euros;
                                continue;
                            }
                        }
                    }

                    // Chercher les appels
                    const text = lines[j].toLowerCase();
                    if (text.match(/(\d+)h\s*d*['’]*appels/i) || text.match(/appels\s*(\d+)h/i)) {
                        const m = text.match(/(\d+)h/i);
                        if (m) calls = `${m[1]}h`;
                    } else if (text.match(/appels.*illimit/i) && calls === "Illimités") {
                        // On garde Illimités seulement si on n'a pas mis un 2h plus tôt
                        calls = "Illimités";
                    }
                }

                const gen = /\b5g\b/i.test(block.name) ? '5G' : '4G';

                // Extract EU/DOM data from block
                let euGb = 0;
                for (let j = block.startIdx; j < Math.min(block.startIdx + 40, lines.length); j++) {
                    if (j > block.startIdx + 2 && /^(Forfait|Série)\s/i.test(lines[j]) && lines[j].length < 40) break;
                    const euMatch = lines[j].match(/(\d{1,3})\s*[Gg]o.*?(?:europ|UE|DOM)/i);
                    if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                    const euMatch2 = lines[j].match(/(?:europ|UE|DOM).*?(\d{1,3})\s*[Gg]o/i);
                    if (euMatch2) { euGb = parseInt(euMatch2[1], 10); break; }
                }

                if (dataGb > 0 && price >= 0 && price < 100) {
                    if (!results.some(r => r.dataGb === dataGb && r.price === price)) {
                        results.push({ planName: block.name, dataGb, price, calls, networkGeneration: gen, dataEuGb: euGb });
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
                operator: 'Free Mobile',
                network: 'Free Mobile',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Free Mobile:', error);
        return [];
    }
};
