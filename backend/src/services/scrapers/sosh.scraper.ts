import type { ScraperConfig, ScrapedPlan } from './types';
import { extractFeesFromText } from './utils';

export const soshScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));

        // Fermer bannière cookies
        try {
            const acceptBtn = await page.$('button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler, #didomi-notice-agree-button');
            if (acceptBtn) {
                await acceptBtn.click();
            } else {
                await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                    const rejectButton = buttons.find((el) =>
                        /continuer\s+sans\s+accepter/i.test((el.textContent || '').trim())
                    );
                    if (rejectButton) {
                        (rejectButton as HTMLElement).click();
                    }
                }).catch(() => { });
            }
            await new Promise(r => setTimeout(r, 1500));
        } catch (e) { }

        // Scroll pour forcer le chargement de toute la page
        try {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        } catch (e: any) { }
        await new Promise(r => setTimeout(r, 2000));

        const rawPageText = await page.evaluate(() => (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ')).catch(() => '');
        const pageFees = extractFeesFromText(rawPageText);
        if (pageFees.cancellationPrice == null && /sans\s+engagement/i.test(rawPageText)) {
            pageFees.cancellationPrice = 0;
        }

        let plans: any = null;
        let retries = 0;
        while (retries < 3) {
            try {
                plans = await page.evaluate((globalFees) => {
                    const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string; dataEuGb: number; simPrice: number | null; activationPrice: number | null; cancellationPrice: number | null }[] = [];
                    let bodyText = "";
                    try {
                        bodyText = document.body.innerText || "";
                    } catch (e) { }
                    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                    // Détection globale du prix SIM
                    let simPrice: number | null = globalFees.simPrice;
                    const lowerBody = bodyText.toLowerCase();
                    if (simPrice == null && (/sim\s*gratuit/i.test(lowerBody) || /sim\s*offert/i.test(lowerBody))) {
                        simPrice = 0;
                    } else if (simPrice == null) {
                        const simPatterns = [
                            /carte\s*sim\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                            /activation\s*sim\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                            /(\d+(?:[,.]\d{2})?)\s*€[^\n]{0,30}(?:carte\s*sim|activation\s*sim)/i,
                            /frais\s*(?:de\s*)?(?:livraison|envoi)\s*(?::|à)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                        ];
                        for (const p of simPatterns) {
                            const m = lowerBody.match(p);
                            if (m) { simPrice = parseFloat(m[1].replace(',', '.')); break; }
                        }
                    }

                    // Détection frais d'activation (distincts du prix SIM)
                    let activationPrice: number | null = globalFees.activationPrice;
                    const actPatterns = [
                        /frais\s*(?:d[''e]\s*)?activation\s*(?::|à)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                        /frais\s*(?:de\s*)?mise\s*en\s*service\s*(?::|à)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                        /frais\s*(?:de\s*)?souscription\s*(?::|à)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                        /(\d+(?:[,.]\d{2})?)\s*€[^\n]{0,30}(?:frais\s*(?:d[''e]\s*)?activation)/i,
                    ];
                    if (activationPrice == null) {
                        for (const p of actPatterns) {
                            const m = lowerBody.match(p);
                            if (m) { activationPrice = parseFloat(m[1].replace(',', '.')); break; }
                        }
                    }

                    // Détection frais de résiliation
                    let cancellationPrice: number | null = globalFees.cancellationPrice ?? 0; // 0 par défaut (sans engagement)
                    if (/frais\s*(?:de\s*)?r[ée]siliation\s*(?::|de)?\s*(\d+(?:[,.]\d{2})?)\s*€/i.test(lowerBody)) {
                        const m = lowerBody.match(/frais\s*(?:de\s*)?r[ée]siliation\s*(?::|de)?\s*(\d+(?:[,.]\d{2})?)\s*€/i);
                        if (m) cancellationPrice = parseFloat(m[1].replace(',', '.'));
                    } else if (/sans\s*engagement/i.test(lowerBody) || /r[ée]siliation\s*gratuit/i.test(lowerBody)) {
                        cancellationPrice = 0;
                    }

                    const cardNodes = Array.from(document.querySelectorAll('#mobile-offers .col-12.col-md-6.col-lg-4, #mobile-offers .bg-white.content'));
                    for (const card of cardNodes) {
                        const cardText = ((card as HTMLElement).innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
                        if (!/sélectionner|voir le détail/i.test(cardText)) continue;

                        const cardLines = cardText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                        const nameLine = cardLines.find(l => /^Forfait\s/i.test(l) && l.length <= 80);
                        if (!nameLine) continue;

                        const dataMatch = nameLine.match(/(\d{1,4})\s*(Go|Mo)/i)
                            || cardText.match(/(\d{1,4})\s*(Go|Mo)\s*(?:depuis\s+la\s+France|bloqué)/i);
                        const priceMatch = cardText.match(/(\d{1,3})[,.](\d{2})\s*€\s*(?:par\s+mois|\/\s*mois)?/i);
                        if (!dataMatch || !priceMatch) continue;

                        const rawData = parseInt(dataMatch[1], 10);
                        const unit = dataMatch[2].toLowerCase();
                        const dataGb = unit === 'mo' ? rawData / 1000 : rawData;
                        const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                        if (dataGb <= 0 || dataGb > 1000 || price <= 0 || price >= 100) continue;

                        const callMatch = cardText.match(/(\d+)h\s*d['’]appels/i);
                        const calls = callMatch ? `${callMatch[1]}h` : 'Illimités';
                        const gen = /\b5g\b/i.test(nameLine) ? '5G' : '4G';
                        const euMatch = cardText.match(/(\d{1,3})\s*go\s*depuis\s*(?:l['’])?(?:europe|ue|dom)/i)
                            || cardText.match(/(\d{1,3})\s*go\s*depuis\s*(?:[\d\s]+)?\s*destinations/i)
                            || cardText.match(/(\d{1,3})\s*go\s*bloqu[ée]?\s*[\s\S]{0,80}depuis\s+la\s+france\s+et\s+l['’]europe/i);
                        const dataEuGb = euMatch ? parseInt(euMatch[1], 10) : 0;

                        if (!results.some(r => r.dataGb === dataGb && r.price === price)) {
                            results.push({
                                planName: nameLine,
                                dataGb,
                                price,
                                calls,
                                networkGeneration: gen,
                                dataEuGb,
                                simPrice,
                                activationPrice,
                                cancellationPrice
                            });
                        }
                    }

                    if (results.length > 0) {
                        return { results, debugText: bodyText };
                    }

                    // Rechercher les blocs qui commencent par "Forfait"
                    for (let i = 0; i < lines.length; i++) {
                        if (!/^Forfait\s/i.test(lines[i])) continue;
                        // Ignorer les doublons ou lignes trop longues
                        if (lines[i].length > 60) continue;

                        const nameLine = lines[i];

                        // Extraire les GB du nom (ex: "Forfait Voyage 200Go 5G", "Forfait 100Go", "Forfait 5Go")
                        const dataMatch = nameLine.match(/(\d{1,4})\s*(Go|Mo)/i);
                        if (!dataMatch) continue;

                        const rawData = parseInt(dataMatch[1], 10);
                        const unit = dataMatch[2].toLowerCase();
                        const dataGb = unit === 'mo' ? rawData / 1000 : rawData;

                        if (dataGb <= 0 || dataGb > 1000) continue;

                        // Chercher le prix dans les lignes suivantes
                        let price = 0;
                        let calls = "Illimités"; // Par défaut

                        for (let j = i + 1; j < Math.min(lines.length, i + 20); j++) {
                            const cleanLine = lines[j].replace(/\u00a0/g, ' ').trim();

                            // Si on rencontre un autre bloc "Forfait", arrêter
                            if (/^Forfait\s/i.test(cleanLine) && j > i + 2) break;

                            // Détecter un prix : "15,99€/mois" ou "10,99€" ou "6,99€/mois"
                            if (price === 0) {
                                const priceMatch = cleanLine.match(/(\d{1,3})[,.](\d{2})\s*€/);
                                if (priceMatch) {
                                    price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                                }
                            }

                            // Détecter les heures d'appels spécifiques
                            const callMatch = cleanLine.match(/(\d+)h\s*d'appels/i);
                            if (callMatch) {
                                calls = `${callMatch[1]}h`;
                            }
                        }

                        const gen = /\b5g\b/i.test(nameLine) ? '5G' : '4G';

                        // Extract EU/DOM data from nearby lines
                        // Format: "40Go depuis 135 destinations*", "20Go depuis l'Europe.", "5Go depuis l'Europe."
                        let euGb = 0;
                        for (let j = i + 1; j < Math.min(lines.length, i + 20); j++) {
                            if (/^Forfait\s/i.test(lines[j]) && j > i + 2) break;
                            let euMatch = lines[j].match(/(\d{1,3})\s*[Gg]o\s*depuis\s*(?:l['’])?(?:Europ|UE|DOM)/i);
                            if (!euMatch) {
                                euMatch = lines[j].match(/(\d{1,3})\s*[Gg]o\s*depuis\s*(?:[\d\s]+)?\s*destinations/i);
                            }
                            if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                        }

                        if (price > 0 && !results.some(r => r.dataGb === dataGb && r.price === price)) {
                            results.push({
                                planName: nameLine,
                                dataGb,
                                price,
                                calls,
                                networkGeneration: gen,
                                dataEuGb: euGb,
                                simPrice,
                                activationPrice,
                                cancellationPrice
                            });
                        }
                    }

                    return { results, debugText: bodyText };
                }, pageFees);
                break; // Le script d'évaluation a réussi
            } catch (err: any) {
                if (err.message && err.message.includes('Execution context was destroyed')) {
                    retries++;
                    await new Promise(r => setTimeout(r, 4000));
                } else {
                    throw err;
                }
            }
        }

        if (!plans) {
            return [];
        }

        return plans.results
            .filter((p: any) => p.price > 0 && p.dataGb > 0)
            .map((plan: any) => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'Sosh',
                network: 'Orange',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
                simPrice: plan.simPrice ?? undefined,
                activationPrice: plan.activationPrice ?? undefined,
                cancellationPrice: plan.cancellationPrice ?? undefined
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Sosh:', error);
        return [];
    }
};
