import type { ScraperConfig, ScrapedPlan } from './types';
import { extractFeesFromText } from './utils';

export const akeoScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));

        // ─── Fermer cookie banner ───
        try {
            const btn = await page.$('button[id*="accept"], [class*="cookie"] button, #didomi-notice-agree-button');
            if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 1000)); }
        } catch { }

        // ─── Scroller pour tout charger ───
        await page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(r => setTimeout(r, 800));
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        // ─── Extraction frais via helper centralisé ───
        const pageText = await page.evaluate(() => (document.body.innerText || ''));
        const fees = extractFeesFromText(pageText);
        console.log(`[Akeo] Frais extraits — SIM: ${fees.simPrice}€, activation: ${fees.activationPrice}€, résiliation: ${fees.cancellationPrice}€`);

        // ─── Extraction des forfaits ───
        // Akeo affiche 4 gammes : INFINITY (350Go), ULTRA (200Go), MAXI (10Go), MINI (2Go)
        // Chaque gamme a : prix Orange et prix Bouygues
        // Deux types de prix : "Engagement 12 mois" et "ou XX,XX€/mois" (sans engagement)
        // On ne prend QUE le prix sans engagement (le "ou XX,XX€/mois")
        const plans = await page.evaluate(() => {
            const results: {
                planName: string; dataGb: number; price: number; calls: string;
                networkGeneration: string; dataEuGb: number; network: string;
            }[] = [];

            const bodyText = (document.body.innerText || '').replace(/\u00a0/g, ' ');

            // Découper en sections par forfait
            const sections = bodyText.split(/\n(?=INFINITY|ULTRA|MAXI|MINI)/);

            for (const section of sections) {
                const trimmed = section.trim();
                if (trimmed.length < 20) continue;

                // Identifier la gamme
                let planBaseName = '';
                if (/^INFINITY/i.test(trimmed)) planBaseName = 'INFINITY';
                else if (/^ULTRA/i.test(trimmed)) planBaseName = 'ULTRA';
                else if (/^MAXI/i.test(trimmed)) planBaseName = 'MAXI';
                else if (/^MINI/i.test(trimmed)) planBaseName = 'MINI';
                else continue;

                // Data EU
                let dataEuGb = 0;
                const euMatch = trimmed.match(/(\d+)\s*Go.*?(?:Europe|UE|DOM|Suisse|Andorre)/i);
                if (euMatch) dataEuGb = parseInt(euMatch[1], 10);

                // Détection d'appels
                let calls = 'Illimités';
                if (planBaseName === 'MINI') calls = '10h';

                // Extraire les data volumes pour Orange et Bouygues
                const orangeDataMatch = trimmed.match(/ORANGE\s*(\d{1,4})\s*Go/i);
                const bouyguesDataMatch = trimmed.match(/BOUYGUES\s*(?:TELECOM\s*)?(\d{1,4})\s*Go/i);

                // Extraire les prix SANS engagement
                // Format 1: "ou XX,XX€/mois" ou "ou XX,XX €"
                // Format 2: "XX € XX / mois" (prix splitté sur la page)
                // Format 3: "XX,XX € / mois en cas de ré-engagement"
                const noEngagementPrices: number[] = [];

                // Pattern "ou XX,XX€" ou "ou XX,XX €"
                const noEngRegex1 = /ou\s+(\d{1,2})[,.](\d{2})\s*€/gi;
                let nem1;
                while ((nem1 = noEngRegex1.exec(trimmed)) !== null) {
                    const p = parseFloat(`${nem1[1]}.${nem1[2]}`);
                    if (p > 0 && p < 100 && !noEngagementPrices.includes(p)) {
                        noEngagementPrices.push(p);
                    }
                }

                // Pattern "XX,XX € / mois" (sans "engagement 12 mois" dans le contexte immédiat)
                // ET "XX € XX / mois" (format splitté)
                if (noEngagementPrices.length === 0) {
                    const splitPriceRegex = /(\d{1,2})\s*€\s*(\d{2})\s*(?:\/\s*mois)?/gi;
                    let sp;
                    while ((sp = splitPriceRegex.exec(trimmed)) !== null) {
                        const p = parseFloat(`${sp[1]}.${sp[2]}`);
                        if (p > 0 && p < 100 && !noEngagementPrices.includes(p)) {
                            noEngagementPrices.push(p);
                        }
                    }
                }

                // Si on a trouvé des prix "engagement 12 mois" ET des prix sans engagement,
                // les prix sans engagement sont les plus chers → on les veut
                // Free/Akeo affiche: prix engagement (petit) puis "ou XX,XX€" (grand)
                // Si on a trouvé plus de 2 prix par réseau, on prend les 2 plus chers
                if (noEngagementPrices.length > 2) {
                    noEngagementPrices.sort((a, b) => b - a);
                    noEngagementPrices.length = 2;
                }

                // Akeo liste Orange d'abord, puis Bouygues → les prix sans engagement suivent le même ordre
                if (orangeDataMatch && noEngagementPrices.length >= 1) {
                    const orangeData = parseInt(orangeDataMatch[1], 10);
                    const orangePrice = noEngagementPrices[0];
                    if (orangePrice > 0 && orangeData > 0) {
                        results.push({
                            planName: `AKEO ${planBaseName}`,
                            dataGb: orangeData,
                            price: orangePrice,
                            calls,
                            networkGeneration: '4G',
                            dataEuGb,
                            network: 'Orange',
                        });
                    }
                }

                if (bouyguesDataMatch && noEngagementPrices.length >= 2) {
                    const bouyguesData = parseInt(bouyguesDataMatch[1], 10);
                    const bouyguesPrice = noEngagementPrices[1];
                    if (bouyguesPrice > 0 && bouyguesData > 0) {
                        results.push({
                            planName: `AKEO ${planBaseName}`,
                            dataGb: bouyguesData,
                            price: bouyguesPrice,
                            calls,
                            networkGeneration: '4G',
                            dataEuGb,
                            network: 'Bouygues Telecom',
                        });
                    }
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
                operator: 'Akeo Telecom',
                network: plan.network,
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
                simPrice: fees.simPrice ?? undefined,
                activationPrice: fees.activationPrice ?? undefined,
                cancellationPrice: fees.cancellationPrice ?? undefined,
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Akeo Telecom:', error);
        return [];
    }
};
