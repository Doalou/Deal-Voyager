import type { ScraperConfig } from './types';
import { extractFeesFromText } from './utils';

export const telecoopScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
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
        console.log(`[TeleCoop] Frais extraits - SIM: ${fees.simPrice}€, activation: ${fees.activationPrice}€, résiliation: ${fees.cancellationPrice}€`);

        // ─── Extraction des forfaits ───
        const plans = await page.evaluate(() => {
            const results: {
                planName: string; dataGb: number; price: number; calls: string;
                networkGeneration: string; dataEuGb: number;
            }[] = [];

            const bodyText = (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
            const lower = bodyText.toLowerCase();

            let euGb = 0;
            const euMatch = /(\d{1,3})\s*go\s*(?:inclus|(?:en|depuis)\s*(?:ue|dom|angleterre))/i.exec(bodyText)
                || /dont\s*(\d{1,3})\s*go\s*en\s*(?:ue|dom|angleterre)/i.exec(bodyText);
            if (euMatch) euGb = Number.parseInt(euMatch[1], 10);

            // ─── Forfait Sobriété ───
            const sobrieteBlock = /forfait\s+sobri[ée]t[ée][\s\S]{0,500}/i.exec(bodyText)?.[0] || '';
            if (sobrieteBlock) {
                const priceMatch = /(\d{1,2})\s*€\s*\/?\.?\s*mois/i.exec(sobrieteBlock)
                    || /(\d{1,2})\s*€/i.exec(sobrieteBlock);
                const dataMatch = /(\d{1,4})\s*(mo|go)\s*(?:inclus)?/i.exec(sobrieteBlock);

                if (priceMatch && dataMatch) {
                    const raw = Number.parseInt(dataMatch[1], 10);
                    const dataGb = dataMatch[2].toLowerCase() === 'mo' ? raw / 1000 : raw;
                    const price = Number.parseInt(priceMatch[1], 10);
                    if (price > 0 && price < 100 && dataGb > 0 && dataGb <= 500) {
                        results.push({
                            planName: 'Forfait Sobriété',
                            dataGb,
                            price,
                            calls: 'Illimités',
                            networkGeneration: '4G',
                            dataEuGb: euGb,
                        });
                    }
                }
            }

            // ─── Forfait Engagé (paliers) ───
            const engagedBlock = /forfait\s+engag[ée][\s\S]{0,1200}/i.exec(bodyText)?.[0] || bodyText;
            const tierRegex = /(\d{1,2})\s*€\s*:\s*jusqu['’]?\s*[àa]\s*(\d{1,3})\s*go/i;
            const tierRegexGlobal = new RegExp(tierRegex.source, 'gi');
            let tm;
            while ((tm = tierRegexGlobal.exec(engagedBlock)) !== null) {
                const price = Number.parseInt(tm[1], 10);
                const dataGb = Number.parseInt(tm[2], 10);
                if (price > 0 && price < 100 && dataGb > 0 && dataGb <= 500) {
                    const planName = `Forfait Engagé ${dataGb} Go`;
                    if (!results.some(r => r.planName === planName && r.price === price)) {
                        results.push({
                            planName,
                            dataGb,
                            price,
                            calls: 'Illimités',
                            networkGeneration: '4G',
                            dataEuGb: euGb,
                        });
                    }
                }
            }

            // Fallback: "Max 20€/mois 80Go inclus"
            if (!results.some(r => /forfait engagé/i.test(r.planName))) {
                const fallback = /max\s*(\d{1,2})\s*€\s*\/?\s*mois\s*(\d{1,3})\s*go\s*inclus/i.exec(lower);
                if (fallback) {
                    const price = Number.parseInt(fallback[1], 10);
                    const dataGb = Number.parseInt(fallback[2], 10);
                    if (price > 0 && dataGb > 0) {
                        results.push({
                            planName: `Forfait Engagé ${dataGb} Go`,
                            dataGb,
                            price,
                            calls: 'Illimités',
                            networkGeneration: '4G',
                            dataEuGb: euGb,
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
                operator: 'TeleCoop',
                network: 'Orange',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
                simPrice: fees.simPrice ?? undefined,
                activationPrice: fees.activationPrice ?? undefined,
                cancellationPrice: fees.cancellationPrice ?? undefined,
            }));
    } catch (error) {
        console.error('Erreur dans la collecte TeleCoop:', error);
        return [];
    }
};
