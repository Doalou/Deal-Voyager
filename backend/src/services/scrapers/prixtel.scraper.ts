import type { ScraperConfig } from './types';
import { extractFeesFromText } from './utils';

export const prixtelScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));

        // ─── Fermer bannière cookies ───
        try {
            const acceptBtn = await page.$('#onetrust-accept-btn-handler, button[id*="accept"], #didomi-notice-agree-button, [class*="cookie"] button');
            if (acceptBtn) {
                await acceptBtn.click();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch { }

        // ─── Scroller pour tout charger ───
        await page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(r => setTimeout(r, 800));
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        // ─── Extraction frais via helper centralisé (la suite est complétée par checkout/PDF dans scraper.service.ts) ───
        const pageText = await page.evaluate(() => (document.body.innerText || ''));
        const fees = extractFeesFromText(pageText);
        console.log(`[Prixtel] Frais extraits - SIM: ${fees.simPrice}€, activation: ${fees.activationPrice}€, résiliation: ${fees.cancellationPrice}€`);

        // ─── Récupération dynamique des pages de forfait (Le petit, Le grand, Oxygène, Le géant) ───
        const offerLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/forfait-mobile/forfait-"]')) as HTMLAnchorElement[];
            const out: string[] = [];
            for (const a of links) {
                const href = a.getAttribute('href') || '';
                if (!href) continue;
                const abs = new URL(href, window.location.origin).href;
                if (!/forfait-mobile\/forfait-/i.test(abs)) continue;
                if (!out.includes(abs)) out.push(abs);
            }
            return out;
        });

        const linksToVisit = [...new Set(offerLinks)];

        const plans: {
            planName: string;
            dataGb: number;
            price: number;
            calls: string;
            networkGeneration: string;
            dataEuGb: number;
        }[] = [];

        for (const link of linksToVisit) {
            try {
                await page.goto(link, { waitUntil: 'networkidle2', timeout: 60000 });
                await new Promise(r => setTimeout(r, 2200));

                const extracted = await page.evaluate(() => {
                    const results: {
                        planName: string;
                        dataGb: number;
                        price: number;
                        calls: string;
                        networkGeneration: string;
                        dataEuGb: number;
                    }[] = [];

                    const text = (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
                    const lower = text.toLowerCase();

                    const nameMatch = /(le\s+petit|le\s+grand|le\s+g[ée]ant|oxyg[eè]ne)/i.exec(text);
                    const baseName = nameMatch ? nameMatch[1].replace(/\s+/g, ' ').trim() : 'Prixtel';

                    let dataEuGb = 0;
                    const euMatch = /(\d{1,3})\s*go\s*(?:depuis|dans)\s*l['’]?ue\/?dom/i.exec(text)
                        || /(\d{1,3})\s*go\/mois[^\n]{0,60}(?:ue|dom)/i.exec(text)
                        || /(?:ue|dom)[^\n\d]{0,40}(\d{1,3})\s*go/i.exec(text);
                    if (euMatch) dataEuGb = Number.parseInt(euMatch[1], 10);

                    const networkGeneration = /\b5g\b/i.test(lower) ? '5G' : '4G';

                    const tiers: { dataGb: number; price: number }[] = [];

                    // Pattern explicite FAQ: "Moins de 30 Go ... 4,99€" + "Entre 30 et 50 Go ..."
                    const lessRegex = /moins\s+de\s+(\d{1,4})\s*go[^€]{0,120}?(\d{1,2})[,.](\d{2})\s*€/gi;
                    let lm;
                    while ((lm = lessRegex.exec(text)) !== null) {
                        const dataGb = Number.parseInt(lm[1], 10);
                        const price = Number.parseFloat(`${lm[2]}.${lm[3]}`);
                        if (dataGb > 0 && dataGb <= 1000 && price > 0 && price < 100) {
                            tiers.push({ dataGb, price });
                        }
                    }

                    const betweenRegex = /entre\s+(\d{1,4})\s*go\s+et\s+(\d{1,4})\s*go[^€]{0,120}?(\d{1,2})[,.](\d{2})\s*€/gi;
                    let bm;
                    while ((bm = betweenRegex.exec(text)) !== null) {
                        const upperGb = Number.parseInt(bm[2], 10);
                        const price = Number.parseFloat(`${bm[3]}.${bm[4]}`);
                        if (upperGb > 0 && upperGb <= 1000 && price > 0 && price < 100) {
                            tiers.push({ dataGb: upperGb, price });
                        }
                    }

                    // Pattern visuel du bloc "Vous payez ce que vous consommez"
                    if (tiers.length === 0) {
                        const idx = lower.indexOf('vous payez ce que vous consommez');
                        if (idx >= 0) {
                            const segment = text.slice(idx, idx + 1400);
                            const dataVals: number[] = [];
                            const priceVals: number[] = [];

                            const dRegex = /(\d{1,4})\s*go/gi;
                            let dm;
                            while ((dm = dRegex.exec(segment)) !== null) {
                                const d = Number.parseInt(dm[1], 10);
                                if (d > 0 && d <= 1000 && !dataVals.includes(d)) dataVals.push(d);
                            }

                            const pRegex = /(\d{1,2})[,.](\d{2})\s*€/gi;
                            let pm;
                            while ((pm = pRegex.exec(segment)) !== null) {
                                const p = Number.parseFloat(`${pm[1]}.${pm[2]}`);
                                if (p > 0 && p < 100) priceVals.push(p);
                            }

                            const count = Math.min(dataVals.length, priceVals.length);
                            for (let i = 0; i < count; i++) {
                                tiers.push({ dataGb: dataVals[i], price: priceVals[i] });
                            }
                        }
                    }

                    // Filet de sécurité: plage "De X à Y Go" + "A partir de Z,ZZ€"
                    if (tiers.length === 0) {
                        const rangeMatch = /de\s+(\d{1,4})\s*[àa]\s*(\d{1,4})\s*go/i.exec(text);
                        const startPrice = /[àa]\s*partir\s*de\s*(\d{1,2})[,.](\d{2})\s*€/i.exec(text);
                        if (rangeMatch && startPrice) {
                            const upperGb = Number.parseInt(rangeMatch[2], 10);
                            const price = Number.parseFloat(`${startPrice[1]}.${startPrice[2]}`);
                            if (upperGb > 0 && upperGb <= 1000 && price > 0 && price < 100) {
                                tiers.push({ dataGb: upperGb, price });
                            }
                        }
                    }

                    for (const t of tiers) {
                        const planName = `${baseName} ${t.dataGb} Go`;
                        if (!results.some(r => r.planName.toLowerCase() === planName.toLowerCase() && r.price === t.price)) {
                            results.push({
                                planName,
                                dataGb: t.dataGb,
                                price: t.price,
                                calls: 'Illimités',
                                networkGeneration,
                                dataEuGb,
                            });
                        }
                    }

                    return results;
                });

                for (const p of extracted) {
                    if (!plans.some((x) => x.planName.toLowerCase() === p.planName.toLowerCase() && x.price === p.price && x.dataGb === p.dataGb)) {
                        plans.push(p);
                    }
                }
            } catch (e) {
                console.warn('[Prixtel] Impossible de parser la page de forfait:', link, e);
            }
        }

        // Fallback purement dynamique sur la page liste si les liens détail ne sont pas disponibles
        if (plans.length === 0) {
            const listFallback = await page.evaluate(() => {
                const out: {
                    planName: string;
                    dataGb: number;
                    price: number;
                    calls: string;
                    networkGeneration: string;
                    dataEuGb: number;
                }[] = [];

                const text = (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
                const cardRegex = /(Le\s+petit|Le\s+grand|Le\s+g[ée]ant|Oxyg[eè]ne)[\s\S]{0,220}?([àa]\s*partir\s*de\s*)?(\d{1,2})[,.](\d{2})\s*€[\s\S]{0,180}?De\s*(\d{1,4})\s*[àa]\s*(\d{1,4})\s*Go[\s\S]{0,120}?(\d{1,3})\s*Go\s*(?:en|depuis)\s*(?:UE|DOM)/gi;
                let m;
                while ((m = cardRegex.exec(text)) !== null) {
                    const baseName = m[1].replace(/\s+/g, ' ').trim();
                    const price = Number.parseFloat(`${m[3]}.${m[4]}`);
                    const maxGb = Number.parseInt(m[6], 10);
                    const euGb = Number.parseInt(m[7], 10);
                    const gen = /5g/i.test(m[0]) ? '5G' : '4G';
                    if (price > 0 && price < 100 && maxGb > 0 && maxGb <= 1000) {
                        out.push({
                            planName: `${baseName} ${maxGb} Go`,
                            dataGb: maxGb,
                            price,
                            calls: 'Illimités',
                            networkGeneration: gen,
                            dataEuGb: euGb,
                        });
                    }
                }
                return out;
            });

            for (const p of listFallback) {
                if (!plans.some((x) => x.planName.toLowerCase() === p.planName.toLowerCase() && x.price === p.price && x.dataGb === p.dataGb)) {
                    plans.push(p);
                }
            }
        }

        return plans
            .filter(p => p.price > 0 && p.dataGb > 0)
            .map(plan => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'Prixtel',
                network: 'Orange',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
                simPrice: fees.simPrice ?? undefined,
                activationPrice: fees.activationPrice ?? undefined,
                cancellationPrice: fees.cancellationPrice ?? undefined,
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Prixtel:', error);
        return [];
    }
};
