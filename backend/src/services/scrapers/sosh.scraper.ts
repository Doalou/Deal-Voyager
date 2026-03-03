import type { ScraperConfig, ScrapedPlan } from './types';

export const soshScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    console.log('Extraction des données de la page Sosh (nouvelle URL)…');
    try {
        // Redirection vers la nouvelle boutique Sosh
        await page.goto("https://shop.sosh.fr/mobile/forfaits-mobiles", { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 7000));

        // Fermer bannière cookies
        try {
            const acceptBtn = await page.$('button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler, #didomi-notice-agree-button');
            if (acceptBtn) await acceptBtn.click();
            await new Promise(r => setTimeout(r, 1500));
        } catch (e) { }

        // Scroll pour forcer le chargement de toute la page
        try {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        } catch (e: any) {
            console.log("[Sosh] Erreur ignorable au scroll:", e.message);
        }
        await new Promise(r => setTimeout(r, 2000));

        let plans: any = null;
        let retries = 0;
        while (retries < 3) {
            try {
                plans = await page.evaluate(() => {
                    const results: { planName: string; dataGb: number; price: number; calls: string }[] = [];
                    let bodyText = "";
                    try {
                        bodyText = document.body.innerText || "";
                    } catch (e) { }
                    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                    // Rechercher les blocs qui commencent par "Forfait"
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].startsWith("Forfait ") && !lines[i].includes("Voyage")) { // On ignore le Forfait Voyage Sosh très spécifique si besoin, mais on peut le prendre. Prenons "Forfait "

                            const nameLine = lines[i];

                            // Extraire les GB du nom
                            const dataMatch = nameLine.match(/(\d{1,4})\s*(Go|Mo)/i);
                            if (!dataMatch) continue;

                            const rawData = parseInt(dataMatch[1], 10);
                            const unit = dataMatch[2].toLowerCase();
                            const dataGb = unit === 'mo' ? rawData / 1000 : rawData;

                            if (dataGb <= 0 || dataGb > 1000) continue;

                            // Chercher le prix dans les 3-4 lignes suivantes
                            let price = 0;
                            let calls = "Illimités"; // Par défaut

                            for (let j = i + 1; j < Math.min(lines.length, i + 15); j++) {
                                const cleanLine = lines[j].replace(/\u00a0/g, ' ').trim();

                                // Détecter un prix
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
                                } else if (cleanLine.match(/appels.*illimit/i) || cleanLine.match(/SMS\/MMS illimit/i)) {
                                    if (calls === "Illimités" && cleanLine.match(/appels.*illimit/i)) {
                                        calls = "Illimités";
                                    }
                                }
                            }

                            if (price > 0 && !results.some(r => r.dataGb === dataGb && r.price === price)) {
                                results.push({
                                    planName: nameLine,
                                    dataGb,
                                    price,
                                    calls
                                });
                            }
                        }
                    }

                    return { results, debugText: bodyText };
                });
                break; // Le script d'évaluation a réussi
            } catch (err: any) {
                if (err.message && err.message.includes('Execution context was destroyed')) {
                    retries++;
                    console.log(`[Sosh] Contexte détruit, attente et nouvelle tentative (${retries}/3)...`);
                    await new Promise(r => setTimeout(r, 4000));
                } else {
                    throw err;
                }
            }
        }

        if (!plans) {
            console.log("[Sosh] Impossible de lire la page après plusieurs tentatives.");
            return [];
        }

        console.log(`[Sosh] Plans extraits :`, JSON.stringify(plans.results));
        console.log("SOSH DEBUG LENGTH PROD:", plans.debugText.length);
        if (plans.debugText.length < 500) {
            console.log("SOSH DEBUG TEXT (trop court):", plans.debugText);
        }

        return plans.results
            .filter((p: any) => p.price > 0 && p.dataGb > 0)
            .map((plan: any) => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'Sosh',
                network: 'Orange'
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Sosh:', error);
        return [];
    }
};
