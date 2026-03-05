import type { ScraperConfig, ScrapedPlan } from './types';

export const bAndYouScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    console.log('Extraction des données de la page B&You…');
    try {
        await new Promise(r => setTimeout(r, 5000));

        // Fermer bannière cookies
        try {
            const acceptBtn = await page.$('#popin_tc_privacy_button_2, #didomi-notice-agree-button, button[id*="accept"]');
            if (acceptBtn) {
                await acceptBtn.click();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) { }

        // Scroller pour charger tout le contenu
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 3000));

        const plans: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string }[] = [];

        // Stratégie B&You : la page utilise un configurateur dynamique avec des .radio-label
        // Il faut cliquer sur chaque option et lire le prix dans le bandeau "Votre sélection" en bas de page

        // 1. Récupérer tous les labels cliquables contenant un volume de data
        const radioLabels = await page.$$('label.radio-label, label[class*="radio"]');

        // Si pas de labels radio, essayer une approche plus large
        let labels = radioLabels;
        if (labels.length === 0) {
            const allLabels = await page.$$('label');
            for (const l of allLabels) {
                const text = await l.evaluate((e: Element) => (e.textContent || '').trim());
                if (/\d+\s*(Go|Mo)/i.test(text) && text.length < 50) {
                    labels.push(l);
                }
            }
        }

        // Extraire les textes de chaque label pour pouvoir les re-sélectionner
        const labelInfos: { text: string; index: number }[] = [];
        for (let i = 0; i < labels.length; i++) {
            try {
                const text = await labels[i].evaluate((e: Element) => (e.textContent || '').trim());
                if (/\d+\s*(Go|Mo)/i.test(text)) {
                    labelInfos.push({ text, index: i });
                }
            } catch (e) { }
        }

        console.log(`[B&You] ${labelInfos.length} options de forfait trouvées`);

        for (const info of labelInfos) {
            try {
                // Re-récupérer les labels à chaque itération (le DOM peut changer)
                const currentLabels = await page.$$('label.radio-label, label[class*="radio"], label');

                // Trouver le bon label
                let targetLabel = null;
                for (const l of currentLabels) {
                    const text = await l.evaluate((e: Element) => (e.textContent || '').trim());
                    if (text === info.text) {
                        targetLabel = l;
                        break;
                    }
                }

                if (!targetLabel) continue;

                // Extraire le volume de data du label
                const dataMatch = info.text.match(/(\d{1,4})\s*(Go|Mo)/i);
                if (!dataMatch) continue;
                const rawData = parseInt(dataMatch[1], 10);
                const unit = dataMatch[2].toLowerCase();
                const dataGb = unit === 'mo' ? rawData / 1000 : rawData;

                let specificCalls = "Illimités";
                const explicitCallMatch = info.text.match(/(\d+)h/i);
                if (explicitCallMatch) {
                    specificCalls = `${explicitCallMatch[1]}h`;
                }

                // Cliquer sur le label pour sélectionner ce forfait
                await targetLabel.evaluate((el: any) => el.click()).catch(async (e: any) => {
                    console.log("[B&You] Fallback click puppeteer:", e.message);
                    await targetLabel.click();
                });
                await new Promise(r => setTimeout(r, 2000));

                // Lire le prix depuis le bandeau "Votre sélection" en bas OU depuis le DOM
                const priceData = await page.evaluate(() => {
                    // Stratégie 1 : bandeau de sélection en bas de page
                    const bottomBar = document.querySelector('[class*="sticky"], [class*="bottom"], [class*="selection"], [class*="recap"], [class*="footer"]');
                    if (bottomBar) {
                        const text = (bottomBar.textContent || '').replace(/\u00a0/g, ' ');
                        const priceMatch = text.match(/(\d{1,3})[,.](\d{2})\s*€\s*\/?\s*mois/i);
                        if (priceMatch) {
                            return { bestPrice: parseFloat(`${priceMatch[1]}.${priceMatch[2]}`), calls: "Illimités" };
                        }
                    }

                    // Stratégie 2 : chercher le plus gros prix affiché (font-size le plus élevé)
                    let bestPrice = 0;
                    let biggestFontSize = 0;
                    const allEls = document.querySelectorAll('*');
                    for (const el of Array.from(allEls)) {
                        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                        if (text.length > 30) continue;
                        const priceMatch = text.match(/^(\d{1,3})[,.](\d{2})\s*€?$/);
                        if (!priceMatch) continue;
                        const fs = parseFloat(window.getComputedStyle(el).fontSize);
                        if (fs > biggestFontSize) {
                            biggestFontSize = fs;
                            bestPrice = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                        }
                    }

                    // Stratégie 3 : chercher le premier "X,XX€/mois" visible sur la page
                    if (bestPrice === 0) {
                        const bodyText = document.body.innerText;
                        const allPrices = bodyText.match(/(\d{1,3})[,.](\d{2})\s*€\s*\/?\s*mois/gi);
                        if (allPrices && allPrices.length > 0) {
                            // Prendre le dernier prix trouvé (souvent le prix actuel sélectionné)
                            const last = allPrices[allPrices.length - 1];
                            const m = last.match(/(\d{1,3})[,.](\d{2})/);
                            if (m) {
                                bestPrice = parseFloat(`${m[1]}.${m[2]}`);
                            }
                        }
                    }

                    // Extraire les appels s'il y a une limite spécifique affichée
                    let foundCalls = "Illimités";
                    const pageText = document.body.innerText.toLowerCase();
                    if (pageText.match(/(\d+)h\s*d*['’]*appels/i)) {
                        const m = pageText.match(/(\d+)h\s*d*['’]*appels/i);
                        if (m) foundCalls = `${m[1]}h`;
                    }

                    return { bestPrice, calls: foundCalls };
                });

                let finalCalls = "Illimités";
                if (specificCalls !== "Illimités") {
                    finalCalls = specificCalls;
                } else if (priceData && priceData.calls !== "Illimités") {
                    finalCalls = priceData.calls;
                }

                const gen = /5g/i.test(info.text) ? '5G' : '4G';

                if (priceData && typeof priceData === 'object' && 'bestPrice' in priceData && priceData.bestPrice > 0 && !plans.some(p => p.dataGb === dataGb)) {
                    const planName = `Forfait B&You ${dataGb >= 1 ? dataGb + ' Go' : (dataGb * 1000) + ' Mo'}`;
                    plans.push({ planName, dataGb, price: priceData.bestPrice, calls: finalCalls, networkGeneration: gen });
                    console.log(`[B&You] Trouvé : ${planName} à ${priceData.bestPrice}€/mois (${gen})`);
                }
            } catch (err) {
                console.warn('[B&You] Erreur sur une option:', err);
            }
        }

        // Fallback global si rien n'a été trouvé via les clics
        if (plans.length === 0) {
            console.log('[B&You] Fallback: extraction texte brut...');
            const fallbackPlans = await page.evaluate(() => {
                const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string }[] = [];
                const bodyText = document.body.innerText;
                const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                for (let i = 0; i < lines.length; i++) {
                    const dataMatch = lines[i].match(/^(?:(\d+)h\s*)?(\d{1,4})\s*(Go|Mo)\s*$/i);
                    if (!dataMatch) continue;
                    const hoursRaw = dataMatch[1];
                    const rawData = parseInt(dataMatch[2], 10);
                    const unit = dataMatch[3].toLowerCase();
                    const dataGb = unit === 'mo' ? rawData / 1000 : rawData;
                    if (dataGb <= 0) continue;

                    let fallbackExplicitCalls = "Illimités";
                    if (hoursRaw) {
                        fallbackExplicitCalls = `${hoursRaw}h`;
                    }

                    // Chercher un prix dans les 15 lignes autour
                    for (let j = Math.max(0, i - 15); j < Math.min(lines.length, i + 15); j++) {
                        const cleanLine = lines[j].replace(/\u00a0/g, ' ').trim();
                        const priceMatch = cleanLine.match(/(\d{1,3})[,.](\d{2})\s*€/);
                        if (priceMatch) {
                            const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                            if (price > 0 && price < 80 && !results.some(r => r.dataGb === dataGb)) {

                                // Scan pour les appels sur ces lignes
                                let calls = fallbackExplicitCalls;
                                if (calls === "Illimités") {
                                    for (let k = Math.max(0, i - 5); k < Math.min(lines.length, i + 10); k++) {
                                        const m = lines[k].match(/(\d+)h\s*d*['’]*appels/i);
                                        if (m) calls = `${m[1]}h`;
                                    }
                                }

                                const nearbyText = lines.slice(Math.max(0, i - 5), i + 5).join(' ');
                                const fbGen = /5g/i.test(nearbyText) ? '5G' : '4G';

                                results.push({
                                    planName: `Forfait B&You ${dataGb >= 1 ? dataGb + ' Go' : (dataGb * 1000) + ' Mo'}`,
                                    dataGb,
                                    price,
                                    calls,
                                    networkGeneration: fbGen
                                });
                            }
                            break;
                        }
                    }
                }
                return results;
            });

            for (const p of fallbackPlans) {
                plans.push({ ...p, networkGeneration: p.networkGeneration || '4G' });
                console.log(`[B&You] Trouvé (fallback) : ${p.planName} à ${p.price}€/mois (${p.networkGeneration || '4G'})`);
            }
        }

        console.log(`[B&You] Plans finaux :`, JSON.stringify(plans));
        return plans
            .filter(p => p.price > 0 && p.dataGb > 0)
            .map(plan => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'B&You',
                network: 'Bouygues Telecom',
                networkGeneration: plan.networkGeneration
            }));
    } catch (error) {
        console.error('Erreur dans la collecte B&You:', error);
        return [];
    }
};
