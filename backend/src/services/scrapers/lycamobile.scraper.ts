import type { ScraperConfig, ScrapedPlan } from './types';
import { extractFeesFromText } from './utils';

export const lycamobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        // ─── Anti-détection supplémentaire pour Lycamobile ───
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            // Désactiver le flag headless
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
        });
        await new Promise(r => setTimeout(r, 8000)); // Attente plus longue pour Lycamobile

        // --- Résolution active des captchas (le cas échéant) ---
        try {
            await (page as any).solveRecaptchas();
        } catch (e) {
            console.error('[Lycamobile] Exception solveRecaptchas:', e);
        }

        const tryAcceptCookies = async () => {
            try {
                const acceptBtn = await page.$('#onetrust-accept-btn-handler, #didomi-notice-agree-button, button[id*="accept"], button[class*="cookie"]');
                if (acceptBtn) {
                    await acceptBtn.click();
                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch { }
        };

        const scrapeCurrentPage = async (): Promise<ScrapedPlan[]> => {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await new Promise(r => setTimeout(r, 2000));

            const rawPageText = await page.evaluate(() => (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' '));
            const fees = extractFeesFromText(rawPageText);
            const lower = rawPageText.toLowerCase();

            if (fees.simPrice == null && /(?:sim|esim)\s*(?:offert|gratuite?)/i.test(lower)) {
                fees.simPrice = 0;
            }
            if (fees.activationPrice == null && /sans\s*engagement[^\n]{0,80}frais\s*de\s*mise\s*en\s*service/i.test(lower)) {
                fees.activationPrice = 0;
            }
            if (fees.cancellationPrice == null && /sans\s*engagement/i.test(lower)) {
                fees.cancellationPrice = 0;
            }

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
                const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

                // Pass 1: capture par lignes (très robuste pour Lyca postpaid/prepaid)
                for (var i = 0; i < lines.length; i++) {
                    var dataMatch = /(?:forfait[^\n]{0,60})?(\d{1,4})\s*(?:go|gb)\b/i.exec(lines[i]);
                    if (!dataMatch) continue;

                    var dataGb = Number.parseInt(dataMatch[1], 10);
                    if (dataGb <= 0 || dataGb > 1000) continue;

                    var price = 0;
                    for (var j = Math.max(0, i - 3); j < Math.min(lines.length, i + 10); j++) {
                        var pm = /(\d{1,2})[.,](\d{2})\s*€?/i.exec(lines[j]);
                        if (!pm) continue;
                        var p = Number.parseFloat(pm[1] + '.' + pm[2]);
                        if (p > 0 && p < 100) {
                            price = p;
                            break;
                        }
                    }
                    if (price <= 0) continue;

                    var context = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 15)).join(' ');
                    if (!/(forfait|data|par\s*mois|30\s*jours|lyca|appels|sms|acheter|voir\s*plus)/i.test(context)) {
                        continue;
                    }

                    if (dataGb > 0 && dataGb <= 1000 && price > 0 && price < 100) {
                        if (!/(?:12|24)\s*mois\s*d['']?engagement|avec\s*engagement/i.test(context)) {
                            var euGb = 0;
                            var euMatch = context.match(/(\d{1,3})\s*go\s*(?:de\s*donn[ée]es\s*d['']?itin[ée]rance\s*dans\s*l['']?ue|(?:valables?|inclus?)\s*en\s*(?:ue|europe|dom)|(?:depuis|dans)\s*l['']?ue)/i)
                                || context.match(/(?:ue|europe|dom|itin[ée]rance)[^\n\d]{0,40}(\d{1,3})\s*go/i);
                            if (euMatch) euGb = Number.parseInt(euMatch[1], 10);

                            var gen = /\b5g\b/i.test(context) ? '5G' : '4G';
                            var planName = 'Forfait Lycamobile ' + (dataGb >= 1 ? dataGb + ' Go' : (dataGb * 1000) + ' Mo');
                            if (!results.some(function (r) { return r.dataGb === dataGb && r.price === price; })) {
                                results.push({
                                    planName: planName,
                                    dataGb: dataGb,
                                    price: price,
                                    calls: 'Illimités',
                                    networkGeneration: gen,
                                    dataEuGb: euGb,
                                });
                            }
                        }
                    }
                }

                // Pass 2: regex globale sur blocs compacts (filet de sécurité)
                var blockRegex = /(\d{1,4})\s*(?:go|gb)[\s\S]{0,120}?(\d{1,2})[.,](\d{2})\s*€/gi;
                var bm;
                while ((bm = blockRegex.exec(text)) !== null) {
                    var dGb = Number.parseInt(bm[1], 10);
                    var pr = Number.parseFloat(bm[2] + '.' + bm[3]);
                    var start = Math.max(0, bm.index - 80);
                    var end = Math.min(text.length, bm.index + bm[0].length + 120);
                    var ctx = text.substring(start, end);
                    if (!/(forfait|data|par\s*mois|30\s*jours|lyca|appels|sms|acheter|voir\s*plus)/i.test(ctx)) continue;
                    
                    if (dGb > 0 && dGb <= 1000 && pr > 0 && pr < 100) {
                        if (!/(?:12|24)\s*mois\s*d['']?engagement|avec\s*engagement/i.test(ctx)) {
                            var euGb2 = 0;
                            var euMatch2 = ctx.match(/(\d{1,3})\s*go\s*(?:de\s*donn[ée]es\s*d['']?itin[ée]rance\s*dans\s*l['']?ue|(?:valables?|inclus?)\s*en\s*(?:ue|europe|dom)|(?:depuis|dans)\s*l['']?ue)/i)
                                || ctx.match(/(?:ue|europe|dom|itin[ée]rance)[^\n\d]{0,40}(\d{1,3})\s*go/i);
                            if (euMatch2) euGb2 = Number.parseInt(euMatch2[1], 10);

                            var gen2 = /\b5g\b/i.test(ctx) ? '5G' : '4G';
                            var planName2 = 'Forfait Lycamobile ' + (dGb >= 1 ? dGb + ' Go' : (dGb * 1000) + ' Mo');
                            if (!results.some(function (r) { return r.dataGb === dGb && r.price === pr; })) {
                                results.push({
                                    planName: planName2,
                                    dataGb: dGb,
                                    price: pr,
                                    calls: 'Illimités',
                                    networkGeneration: gen2,
                                    dataEuGb: euGb2,
                                });
                            }
                        }
                    }
                }

                return results;
            });

            return extracted.map((plan) => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'Lycamobile',
                network: 'Bouygues Telecom',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
                simPrice: fees.simPrice ?? undefined,
                activationPrice: fees.activationPrice ?? undefined,
                cancellationPrice: fees.cancellationPrice ?? undefined,
            }));
        };

        const visited = new Set<string>();
        const urlsToTry = [
            page.url(),
            'https://www.lycamobile.fr/abo/fr/bundles/sim-only-deals/',
            'https://www.lycamobile.fr/fr/bundles/forfait-prepaye#forfaits',
        ];

        const merged: ScrapedPlan[] = [];
        for (const targetUrl of urlsToTry) {
            if (!targetUrl || visited.has(targetUrl)) continue;
            visited.add(targetUrl);

            try {
                if (page.url() !== targetUrl) {
                    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                    await new Promise(r => setTimeout(r, 2500));
                }
            } catch {
                continue;
            }

            await tryAcceptCookies();
            const chunk = await scrapeCurrentPage();
            for (const plan of chunk) {
                if (!merged.some((m) => m.dataGb === plan.dataGb && m.price === plan.price)) {
                    merged.push(plan);
                }
            }
        }

        return merged.filter((p) => p.price > 0 && p.dataGb > 0);
    } catch (error) {
        console.error('Erreur dans la collecte Lycamobile:', error);
        return [];
    }
};
