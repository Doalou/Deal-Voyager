import type { ScraperConfig, ScrapedPlan } from './types';

export const regloMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        // DataDome nécessite un temps de chargement plus long pour valider la session
        await new Promise(r => setTimeout(r, 10000));

        try {
            const acceptBtn = await page.$('#didomi-notice-agree-button, button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler, .cc-accept, [id*="cookie"] button');
            if (acceptBtn) await acceptBtn.click();
            await new Promise(r => setTimeout(r, 1500));
        } catch (_) { }

        try {
            const links = await page.$$('a, button, span');
            for (const link of links) {
                const text = await link.evaluate((e: Element) => (e.textContent || '').toLowerCase().trim());
                if (text.includes('continuer sans accepter') || text.includes('tout refuser') || text.includes('refuser')) {
                    await link.click();
                    await new Promise(r => setTimeout(r, 1500));
                    break;
                }
            }
        } catch (_) { }

        // Vérifier si DataDome a redirigé vers une page de blocage
        const currentUrl = page.url();
        if (currentUrl.includes('navigateur-non-supporte') || currentUrl.includes('captcha')) {
            console.warn('[Réglo Mobile] Bloqué par DataDome, page de captcha/blocage détectée.');
            return [];
        }

        // Scroll progressif pour déclencher le lazy-loading
        for (let s = 0; s < 4; s++) {
            await page.evaluate((step) => window.scrollTo(0, (step + 1) * (document.body.scrollHeight / 4)), s);
            await new Promise(r => setTimeout(r, 1500));
        }
        await new Promise(r => setTimeout(r, 3000));

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string; dataEuGb: number; simPrice: number | null; activationPrice: number | null; cancellationPrice: number | null }[] = [];
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const lower = bodyText.toLowerCase();
            const seenKeys = new Set<string>();

            // --- Détection globale des frais ---
            let activationPrice: number | null = null;
            const actPats = [
                /frais\s*(?:d['''\u2019e]\s*)?activation\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{1,2})?)\s*€/i,
                /frais\s*(?:de\s*)?mise\s*en\s*service\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{1,2})?)\s*€/i,
            ];
            for (const p of actPats) {
                const m = lower.match(p);
                if (m) { activationPrice = parseFloat(m[1].replace(',', '.')); break; }
            }

            let cancellationPrice: number | null = null;
            const cancelMatch = lower.match(/frais\s*(?:de\s*)?r[ée]siliation\s*(?::|de)?\s*(\d+(?:[,.]\d{2})?)\s*€/i);
            if (cancelMatch) cancellationPrice = parseFloat(cancelMatch[1].replace(',', '.'));
            if (/r[ée]siliation\s*gratuit/i.test(lower) || /sans\s*frais\s*(?:de\s*)?r[ée]siliation/i.test(lower)) cancellationPrice = 0;

            let simPrice: number | null = null;
            if (/sim\s*gratuit/i.test(lower) || /sim\s*offert/i.test(lower)) {
                simPrice = 0;
            } else {
                const sps = [
                    /carte\s*sim\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                    /sim\s*(?:à|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                    /co[ûu]t\s*(?:unique)?\s*(?::)?\s*sim\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                    /(\d+(?:[,.]\d{2})?)\s*€[^\n]{0,30}(?:carte\s*sim|sim)/i,
                    /frais\s*(?:de\s*)?(?:livraison|envoi)\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
                ];
                for (const pat of sps) {
                    const m = lower.match(pat);
                    if (m) { simPrice = parseFloat(m[1].replace(',', '.')); break; }
                }
            }

            /**
             * Parse un prix depuis une ligne. Gère les formats :
             * "5€80", "5 €80", "5€,80", "5,80€", "5.80€", "5,80 €/mois"
             */
            function parsePrice(line: string): number {
                const cl = line.replace(/\u00a0/g, ' ').trim();

                // "X€XX" ou "X €XX" ou "X€,XX" (format Réglo Mobile spécifique)
                const pm1 = cl.match(/(\d{1,3})\s*€\s*,?\s*(\d{2})/);
                if (pm1) {
                    const v = parseFloat(`${pm1[1]}.${pm1[2]}`);
                    if (v > 0 && v < 50) return v;
                }
                // "X,XX€" ou "X.XX€"
                const pm2 = cl.match(/(\d{1,3})[,.](\d{2})\s*€/);
                if (pm2) {
                    const v = parseFloat(`${pm2[1]}.${pm2[2]}`);
                    if (v > 0 && v < 50) return v;
                }
                // Nombre seul puis "€XX" sur la même ligne : "5 €80/mois"
                const pm3 = cl.match(/(\d{1,3})\s*€(\d{2})\s*(?:\/|\s*mois)/i);
                if (pm3) {
                    const v = parseFloat(`${pm3[1]}.${pm3[2]}`);
                    if (v > 0 && v < 50) return v;
                }
                return 0;
            }

            const ignoredLabels = /^(illimité|illimités|souscrire|commander|comparer|choisir|voir|options?|non|oui|forfait|bloqué|sans\s*engagement|réseau|internet|appels?|sms|mms|suivant|fermer|pdf|5g|4g|connexion|valider|paiement|modifier|détail|en\s*savoir|plus)/i;

            // --- Stratégie 1 : prix mensuel comme ancre ---
            for (let i = 0; i < lines.length; i++) {
                const price = parsePrice(lines[i]);
                if (price <= 0) continue;

                // Confirmer que c'est un prix mensuel
                const contextLines = lines.slice(i, Math.min(lines.length, i + 4)).join(' ').toLowerCase();
                const priceLine = lines[i].toLowerCase();
                const isMonthly = /\/\s*mois|par\s*mois|€.*mois/i.test(contextLines) || /€\s*,?\s*\d{2}\s*\/?\s*mois/i.test(priceLine);

                if (!isMonthly) {
                    let hasNearbyData = false;
                    for (let k = Math.max(0, i - 6); k < Math.min(lines.length, i + 8); k++) {
                        if (/\d{2,4}\s*Go/i.test(lines[k].trim())) { hasNearbyData = true; break; }
                    }
                    if (!hasNearbyData) continue;
                }

                // Chercher le volume data
                let dataGb = 0;
                for (let j = Math.max(0, i - 6); j < Math.min(lines.length, i + 8); j++) {
                    const dm = lines[j].trim().match(/(\d{1,4})\s*(Go|Mo)/i);
                    if (dm) {
                        const raw = parseInt(dm[1], 10);
                        const gb = dm[2].toLowerCase() === 'mo' ? raw / 1000 : raw;
                        if (gb >= 0.5 && gb <= 2000) { dataGb = gb; break; }
                    }
                }
                if (dataGb <= 0) continue;

                const key = `${dataGb}-${price}`;
                if (seenKeys.has(key)) continue;
                seenKeys.add(key);

                // 5G / 4G
                let gen = '4G';
                for (let j = Math.max(0, i - 6); j < Math.min(lines.length, i + 8); j++) {
                    if (/\b5g\b/i.test(lines[j])) { gen = '5G'; break; }
                }

                // Label dynamique
                let planLabel = '';
                for (let j = Math.max(0, i - 6); j < i; j++) {
                    const candidate = lines[j].trim();
                    if (candidate.length < 2 || candidate.length > 30) continue;
                    if (ignoredLabels.test(candidate)) continue;
                    if (/^\d/.test(candidate)) continue;
                    if (/€|go\b|mois|mo\b/i.test(candidate)) continue;
                    if (/^(--|—|#|\*|•)/.test(candidate)) continue;
                    planLabel = candidate;
                }

                // Data EU
                let euGb = 0;
                const dataGbRound = Math.round(dataGb);
                for (let j = 0; j < lines.length; j++) {
                    if (!new RegExp(`${dataGbRound}\\s*Go`, 'i').test(lines[j])) continue;
                    for (let k = j; k < Math.min(lines.length, j + 10); k++) {
                        const euMatch = lines[k].match(/(\d{1,3})\s*Go.*?(?:UE|DOM|union|europ|roaming)/i);
                        if (euMatch) {
                            const eu = parseInt(euMatch[1], 10);
                            if (eu > 0 && eu < dataGb) { euGb = eu; break; }
                        }
                        const euMatch2 = lines[k].match(/(?:UE|DOM|union|europ|roaming).*?(\d{1,3})\s*Go/i);
                        if (euMatch2) {
                            const eu = parseInt(euMatch2[1], 10);
                            if (eu > 0 && eu < dataGb) { euGb = eu; break; }
                        }
                    }
                    if (euGb > 0) break;
                }

                const displayData = dataGb >= 1 ? `${dataGbRound} Go` : `${Math.round(dataGb * 1000)} Mo`;
                const displayName = planLabel
                    ? `Forfait Réglo Mobile ${planLabel} ${displayData}`
                    : `Forfait Réglo Mobile ${displayData}`;

                results.push({
                    planName: displayName,
                    dataGb,
                    price,
                    calls: 'Illimités',
                    networkGeneration: gen,
                    dataEuGb: euGb,
                    simPrice,
                    activationPrice,
                    cancellationPrice,
                });
            }

            // --- Stratégie 2 (fallback) : ancre par volume data ---
            if (results.length === 0) {
                for (let i = 0; i < lines.length; i++) {
                    const dm = lines[i].trim().match(/(\d{1,4})\s*(Go|Mo)/i);
                    if (!dm) continue;
                    const raw = parseInt(dm[1], 10);
                    const gb = dm[2].toLowerCase() === 'mo' ? raw / 1000 : raw;
                    if (gb < 0.5 || gb > 2000) continue;

                    let price = 0;
                    let gen = '4G';
                    for (let j = Math.max(0, i - 10); j < Math.min(lines.length, i + 10); j++) {
                        if (price === 0) price = parsePrice(lines[j]);
                        if (/\b5g\b/i.test(lines[j])) gen = '5G';
                    }

                    if (price <= 0) continue;
                    const key = `${gb}-${price}`;
                    if (seenKeys.has(key)) continue;
                    seenKeys.add(key);

                    const displayData = gb >= 1 ? `${Math.round(gb)} Go` : `${Math.round(gb * 1000)} Mo`;
                    results.push({
                        planName: `Forfait Réglo Mobile ${displayData}`,
                        dataGb: gb,
                        price,
                        calls: 'Illimités',
                        networkGeneration: gen,
                        dataEuGb: 0,
                        simPrice,
                        activationPrice,
                        cancellationPrice,
                    });
                }
            }

            return results;
        });

        if (plans.length === 0) {
            console.warn('[Réglo Mobile] Aucun forfait détecté — possible blocage DataDome ou changement de structure.');
        }

        return plans
            .filter(p => p.price > 0 && p.dataGb > 0)
            .map(plan => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'Réglo Mobile',
                network: 'SFR',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
                simPrice: plan.simPrice ?? undefined,
                activationPrice: plan.activationPrice ?? undefined,
                cancellationPrice: plan.cancellationPrice ?? undefined
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Réglo Mobile:', error);
        return [];
    }
};
