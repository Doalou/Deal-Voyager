import type { ScraperConfig, ScrapedPlan } from './types';
import { extractFeesFromText } from './utils';

export const laPosteMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));

        // ─── Fermer cookie banner ───
        try {
            const acceptBtn = await page.$('#didomi-notice-agree-button, button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler');
            if (acceptBtn) await acceptBtn.click();
            await new Promise(r => setTimeout(r, 1500));
        } catch (_) { }

        // ─── Scroller pour tout charger ───
        await page.evaluate(async () => {
            for (let i = 0; i < 4; i++) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(r => setTimeout(r, 800));
            }
        });
        await new Promise(r => setTimeout(r, 3000));

        // ─── Ouvrir les mentions légales si présentes ───
        try {
            await page.evaluate(() => {
                const triggers = Array.from(document.querySelectorAll('button, a, span, div[role="button"]'));
                for (const el of triggers) {
                    const t = (el.textContent || '').toLowerCase().trim();
                    if (el.tagName !== 'A' && (t.includes('mentions l') || t.includes('informations l') || t.includes('conditions g') || t.includes('voir les d'))) {
                        try { (el as HTMLElement).click(); } catch { }
                    }
                }
            });
            await new Promise(r => setTimeout(r, 2000));
        } catch { }

        // ─── Extraction frais via helper centralisé ───
        const pageText = await page.evaluate(() => (document.body.innerText || ''));
        const fees = extractFeesFromText(pageText);
        console.log(`[La Poste Mobile] Frais extraits - SIM: ${fees.simPrice}€, activation: ${fees.activationPrice}€, résiliation: ${fees.cancellationPrice}€`);

        // ─── Extraction des forfaits ───
        const plans = await page.evaluate(() => {
            var results: {
                planName: string; dataGb: number; price: number; calls: string;
                networkGeneration: string; dataEuGb: number;
            }[] = [];

            var bodyText = (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
            var lines = bodyText.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

            for (var i = 0; i < lines.length; i++) {
                // Chercher les lignes avec un volume data standalone : "100 Mo", "130 Go", "250 Go"
                var dataMatch = lines[i].match(/^(\d{1,4})\s*(Go|Mo)\s*$/i);
                if (!dataMatch) continue;

                var rawData = parseInt(dataMatch[1], 10);
                var unit = dataMatch[2].toLowerCase();
                var dataGb = unit === 'mo' ? rawData / 1000 : rawData;
                if (dataGb <= 0 || dataGb > 1000) continue;

                // Chercher le prix dans les lignes environnantes
                var price = 0;
                var promoPrice = 0;

                for (var j = i + 1; j < Math.min(lines.length, i + 25); j++) {
                    var clean = lines[j].replace(/\s+/g, ' ').trim();

                    // Le prix après promo : "puis XX€XX" ou "puis XX,XX€"
                    var afterPromo = clean.match(/puis\s+(\d{1,3})[€,.](\d{2})/i);
                    if (afterPromo) {
                        price = parseFloat(afterPromo[1] + '.' + afterPromo[2]);
                        break;
                    }

                    // Prix standalone : "XX€XX" ou "XX,XX€" ou "XX,XX €/mois"
                    if (promoPrice === 0) {
                        var pm1 = clean.match(/^(\d{1,3})€(\d{2})/);
                        if (pm1) {
                            promoPrice = parseFloat(pm1[1] + '.' + pm1[2]);
                            continue;
                        }
                        var pm2 = clean.match(/^(\d{1,3})[,.](\d{2})\s*€/);
                        if (pm2) {
                            promoPrice = parseFloat(pm2[1] + '.' + pm2[2]);
                            continue;
                        }
                    }

                    // Stopper si on tombe sur un autre volume data
                    if (/^\d{1,4}\s*(Go|Mo)\s*$/i.test(clean) && j > i + 3) break;
                }

                var finalPrice = price > 0 ? price : promoPrice;
                if (finalPrice <= 0 || finalPrice >= 100) continue;

                // Détection 5G
                var gen = '4G';
                for (var k = Math.max(0, i - 5); k < Math.min(lines.length, i + 25); k++) {
                    if (/\b5g\b/i.test(lines[k])) { gen = '5G'; break; }
                }

                // Détection data EU
                var euGb = 0;
                for (var m = i; m < Math.min(lines.length, i + 20); m++) {
                    var euMatch = lines[m].match(/(\d{1,3})\s*Go\s*(?:depuis|en|utilisables?|inclus)?\s*(?:l['']?)?(?:europ|UE|DOM)/i);
                    if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                    var euMatch2 = lines[m].match(/(?:europ|UE|DOM)\D*(\d{1,3})\s*Go/i);
                    if (euMatch2) { euGb = parseInt(euMatch2[1], 10); break; }
                }

                var planName = 'Forfait La Poste Mobile ' + dataMatch[1] + ' ' + dataMatch[2];
                if (!results.some(function(r) { return r.dataGb === dataGb && r.price === finalPrice; })) {
                    results.push({
                        planName: planName,
                        dataGb: dataGb,
                        price: finalPrice,
                        calls: 'Illimités',
                        networkGeneration: gen,
                        dataEuGb: euGb,
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
                operator: 'La Poste Mobile',
                network: 'Bouygues Telecom',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
                simPrice: fees.simPrice ?? undefined,
                activationPrice: fees.activationPrice ?? undefined,
                cancellationPrice: fees.cancellationPrice ?? undefined,
            }));
    } catch (error) {
        console.error('Erreur dans la collecte La Poste Mobile:', error);
        return [];
    }
};
