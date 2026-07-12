import type { ScraperConfig, ScrapedPlan } from './types';
import { extractFeesFromText } from './utils';

export function discoverFreePlanUrls(
    pageUrl: string,
    links: readonly { href: string; text: string }[],
) {
    const currentUrl = new URL(pageUrl);
    const found = new Set<string>();

    for (const link of links) {
        const text = link.text.replace(/\s+/g, ' ').trim();
        if (!/forfait|série/i.test(`${link.href} ${text}`)) continue;
        try {
            const url = new URL(link.href, currentUrl);
            if (url.origin !== currentUrl.origin || url.href === currentUrl.href) continue;
            found.add(url.href);
        } catch { }
    }

    return [...found];
}

export const freeMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));

        // ─── Fermer cookie banner si présent ───
        try {
            const btn = await page.$('button[id*="accept"], #didomi-notice-agree-button, [class*="cookie"] button');
            if (btn) { await btn.click(); await new Promise(r => setTimeout(r, 1000)); }
        } catch { }

        // ─── Scroller pour charger tout ───
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
        console.log(`[Free Mobile] Frais extraits - SIM: ${fees.simPrice}€, activation: ${fees.activationPrice}€, résiliation: ${fees.cancellationPrice}€`);

        const plans: ScrapedPlan[] = [];

        // ─── Découverte dynamique de toutes les pages forfait ───
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]')).map(link => ({
                href: link.getAttribute('href') || '',
                text: link.textContent || '',
            }));
        });
        const planUrls = discoverFreePlanUrls(page.url(), links);
        console.log(`[Free Mobile] ${planUrls.length} fiche(s) forfait découverte(s): ${planUrls.join(', ')}`);

        for (const planUrl of planUrls) {
            try {
                await page.goto(planUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 3000));

                // ─── Scroller la page du forfait ───
                await page.evaluate(async () => {
                    for (var i = 0; i < 3; i++) {
                        window.scrollTo(0, document.body.scrollHeight);
                        await new Promise(function(r) { setTimeout(r, 500); });
                    }
                });
                await new Promise(r => setTimeout(r, 1500));

                // ─── Extraire le forfait depuis cette page dédiée ───
                var planData = await page.evaluate(function() {
                    var bodyText = (document.body.innerText || '')
                        .replace(/\u00a0/g, ' ')
                        .replace(/\u202f/g, ' ');
                    var lines = bodyText.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

                    var planName = '';
                    var dataGb = 0;
                    var price = -1;
                    var calls = 'Illimités';
                    var gen = '4G';
                    var euGb = 0;

                    // Chercher le nom du forfait dans le titre (h1 ou premier "Forfait/Série")
                    var titleEl = document.querySelector('h1');
                    if (titleEl) {
                        planName = (titleEl.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
                    }
                    if (!planName) {
                        for (var i = 0; i < Math.min(lines.length, 20); i++) {
                            if (/^(Forfait|Série)\s/i.test(lines[i]) && lines[i].length < 50) {
                                planName = lines[i];
                                break;
                            }
                        }
                    }
                    if (!planName) return null;

                    // Ignorer les boosters/options dans le nom
                    if (/option\s*booster/i.test(planName)) {
                        planName = planName.replace(/\s*\+\s*option\s*booster/i, '').trim();
                    }

                    // ─── Chercher les infos dans les 60 premières lignes ───
                    for (var j = 0; j < Math.min(lines.length, 60); j++) {
                        var cl = lines[j].replace(/\s+/g, ' ').trim();
                        var nl = j + 1 < lines.length ? lines[j + 1].replace(/\s+/g, ' ').trim() : '';

                        // Data illimitée
                        if (dataGb === 0 && /^(?:internet\s+)?illimit[ée]?\b/i.test(cl)) {
                            dataGb = 9999;
                        }

                        // Data en Go/Mo
                        if (dataGb === 0) {
                            var dm = cl.match(/^(\d{1,4})\s*(Go|Mo)$/i);
                            if (dm) {
                                var v = parseInt(dm[1], 10);
                                dataGb = dm[2].toLowerCase() === 'mo' ? v / 1000 : v;
                            }
                            if (dataGb === 0) {
                                var idm = cl.match(/(\d{1,4})\s*(Go|Mo)\s*en\s*(?:5G|4G)/i);
                                if (idm) {
                                    var v2 = parseInt(idm[1], 10);
                                    dataGb = idm[2].toLowerCase() === 'mo' ? v2 / 1000 : v2;
                                }
                            }
                        }

                        // Prix
                        if (price < 0) {
                            if (/booster|abonné|avantage|freebox|pop/i.test(cl)) continue;

                            var im = cl.match(/^(\d{1,3})[,€.](\d{2})\s*€?\s*\/?m?o?i?s?$/);
                            if (im) {
                                price = parseFloat(im[1] + '.' + im[2]);
                                continue;
                            }

                            if (/^\d{1,2}$/.test(cl)) {
                                var cm = nl.match(/€\s*(\d{2})/);
                                if (cm) {
                                    price = parseInt(cl, 10) + parseInt(cm[1], 10) / 100;
                                    continue;
                                }
                                if (/^€\s*$/.test(nl) || nl === '€') {
                                    price = parseInt(cl, 10);
                                    continue;
                                }
                            }
                        }

                        // Réseau
                        if (/\b5g\+?\b/i.test(cl)) gen = '5G';

                        // Appels
                        var callM = cl.match(/(\d+)h\s*d?'?appels?/i);
                        if (callM) calls = callM[1] + 'h';

                        // Data EU
                        var euM = cl.match(/(\d{1,3})\s*(?:Go).*?(?:europ|UE|DOM|destination)/i);
                        if (euM && euGb === 0) euGb = parseInt(euM[1], 10);
                        if (/illimit[ée].*destination/i.test(cl) && dataGb === 9999) {
                            euGb = 9999;
                        }
                    }

                    // 5G depuis le nom
                    if (/5g/i.test(planName)) gen = '5G';

                    if (price >= 0 && price < 100 && dataGb > 0) {
                        return {
                            planName: planName,
                            dataGb: dataGb,
                            price: price,
                            calls: calls,
                            networkGeneration: gen,
                            dataEuGb: euGb,
                        };
                    }
                    return null;
                });

                if (planData && !plans.some(function(x) { return x.planName === planData!.planName && x.price === planData!.price; })) {
                    plans.push({
                        planName: planData.planName,
                        dataGb: planData.dataGb,
                        price: planData.price,
                        calls: planData.calls,
                        operator: 'Free Mobile',
                        network: 'Free Mobile',
                        networkGeneration: planData.networkGeneration || '4G',
                        dataEuGb: planData.dataEuGb || undefined,
                        simPrice: fees.simPrice ?? undefined,
                        activationPrice: fees.activationPrice ?? undefined,
                        cancellationPrice: fees.cancellationPrice ?? undefined,
                    });
                    console.log(`[Free Mobile] Forfait détecté: ${planData.planName} - ${planData.dataGb}Go - ${planData.price}€`);
                }
            } catch (err) {
                console.warn(`[Free Mobile] Erreur sur ${planUrl}:`, err);
            }
        }

        console.log(`[Free Mobile] ${plans.length} forfait(s) détecté(s)`);
        return plans.filter(p => p.price > 0 && p.dataGb > 0);
    } catch (error) {
        console.error('Erreur dans la collecte Free Mobile:', error);
        return [];
    }
};
