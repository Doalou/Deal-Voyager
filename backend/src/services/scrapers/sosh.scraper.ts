import type { ScraperConfig, ScrapedPlan } from './types';

export const soshScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    console.log('Extraction des données de la page Sosh…');
    try {
        // Attendre le chargement complet (Sosh est une SPA lente)
        await new Promise(r => setTimeout(r, 7000));

        // Fermer bannière cookies
        try {
            const acceptBtn = await page.$('button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler, #didomi-notice-agree-button');
            if (acceptBtn) await acceptBtn.click();
            await new Promise(r => setTimeout(r, 1500));
        } catch (e) { }

        // Scroller pour charger le contenu lazy
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await new Promise(r => setTimeout(r, 1500));
        }

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number }[] = [];
            const bodyText = document.body.innerText;
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // DEBUG
            console.log('[Sosh Debug] Total lignes:', lines.length);
            console.log('[Sosh Debug] Premières lignes:', JSON.stringify(lines.slice(0, 150)));

            // Stratégie 1 : chercher les patterns "X Go" isolés et trouver le prix associé
            for (let i = 0; i < lines.length; i++) {
                // Chercher une mention de données (formulations Sosh variées)
                const dataMatch = lines[i].match(/(\d{1,4})\s*(Go|Mo)/i);
                if (!dataMatch) continue;

                const rawData = parseInt(dataMatch[1], 10);
                const unit = dataMatch[2].toLowerCase();
                const dataGb = unit === 'mo' ? rawData / 1000 : rawData;

                if (dataGb <= 0 || dataGb > 1000) continue;
                // Ignorer les mentions de roaming (ex: "15 Go en Europe")
                if (/europe|roaming|dom|étranger/i.test(lines[i])) continue;

                // Chercher un prix dans les lignes autour
                let price = 0;
                for (let j = Math.max(0, i - 10); j < Math.min(lines.length, i + 10); j++) {
                    const cleanLine = lines[j].replace(/\u00a0/g, ' ').trim();

                    // "XX,XX€" ou "XX,XX €/mois"
                    let priceMatch = cleanLine.match(/(\d{1,3})[,.](\d{2})\s*€/);
                    if (!priceMatch) {
                        // "XX€XX"
                        priceMatch = cleanLine.match(/(\d{1,3})\s*€\s*(\d{2})/);
                    }
                    if (!priceMatch) {
                        // Prix entier "X€"
                        const intMatch = cleanLine.match(/^(\d{1,2})\s*€/);
                        if (intMatch) {
                            const p = parseInt(intMatch[1], 10);
                            if (p > 0 && p < 80) { price = p; break; }
                        }
                        continue;
                    }

                    const euros = parseInt(priceMatch[1], 10);
                    const cents = priceMatch[2] ? parseInt(priceMatch[2], 10) : 0;
                    const candidate = euros + cents / 100;

                    if (candidate > 0 && candidate < 80) {
                        if (price === 0 || candidate < price) {
                            price = candidate;
                        }
                    }
                }

                if (price > 0 && !results.some(r => r.dataGb === dataGb)) {
                    results.push({
                        planName: `Forfait Sosh ${dataGb} Go`,
                        dataGb,
                        price
                    });
                }
            }

            // Stratégie 2 (fallback) : DOM spatial — trouver les éléments "Go" et le prix le plus proche visuellement
            if (results.length === 0) {
                const allEls = document.querySelectorAll('*');
                const dataElements: { dataGb: number; rect: DOMRect }[] = [];

                for (const el of Array.from(allEls)) {
                    const text = (el.textContent || '').trim();
                    if (text.length > 25) continue;
                    const m = text.match(/^(\d{1,4})\s*(Go|Mo)$/i);
                    if (m) {
                        const val = parseInt(m[1], 10);
                        const u = m[2].toLowerCase();
                        const gb = u === 'mo' ? val / 1000 : val;
                        if (gb > 0 && gb <= 1000) {
                            dataElements.push({ dataGb: gb, rect: el.getBoundingClientRect() });
                        }
                    }
                }

                for (const de of dataElements) {
                    let bestPrice = 0;
                    let bestDist = Infinity;

                    for (const el of Array.from(allEls)) {
                        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                        if (text.length > 30) continue;
                        const pm = text.match(/^(\d{1,3})[,.](\d{2})\s*€?$/);
                        if (!pm) continue;
                        const p = parseFloat(`${pm[1]}.${pm[2]}`);
                        if (p <= 0 || p >= 80) continue;

                        const rect = el.getBoundingClientRect();
                        const dist = Math.sqrt(Math.pow(rect.x - de.rect.x, 2) + Math.pow(rect.y - de.rect.y, 2));
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestPrice = p;
                        }
                    }

                    if (bestPrice > 0 && !results.some(r => r.dataGb === de.dataGb)) {
                        results.push({
                            planName: `Forfait Sosh ${de.dataGb} Go`,
                            dataGb: de.dataGb,
                            price: bestPrice
                        });
                    }
                }
            }

            return results;
        });

        console.log(`[Sosh] Plans extraits :`, JSON.stringify(plans));
        for (const p of plans) {
            console.log(`[Sosh] Trouvé : ${p.dataGb} Go à ${p.price}€/mois`);
        }

        return plans
            .filter(p => p.price > 0 && p.dataGb > 0)
            .map(plan => ({
                ...plan,
                operator: 'Sosh',
                network: 'Orange'
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Sosh:', error);
        return [];
    }
};
