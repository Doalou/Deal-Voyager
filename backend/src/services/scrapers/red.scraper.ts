import type { ScraperConfig, ScrapedPlan } from './types';

export const redScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));

        // Fermer bannière cookies
        try {
            const acceptBtn = await page.$('#didomi-notice-agree-button');
            if (acceptBtn) {
                await acceptBtn.click();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) { }

        const plans: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string; dataEuGb: number }[] = [];

        // RED utilise des labels avec des IDs préfixés "datanat"
        let labels = await page.$$('label[id^="datanat"]');

        // Fallback : chercher tous les labels contenant "Go"
        if (labels.length === 0) {
            const allLabels = await page.$$('label');
            for (const l of allLabels) {
                const text = await l.evaluate((e: Element) => (e.textContent || '').trim());
                if (/\d+\s*Go/i.test(text)) labels.push(l);
            }
        }

        // Récupérer les IDs des labels pour éviter les ElementHandles détachés
        const labelIds = await Promise.all(
            labels.map(l => l.evaluate((e: Element) => e.id))
        );
        const validLabels = labelIds.filter(id => id);


        for (const labelId of validLabels) {
            try {
                // Re-récupérer l'élément pour éviter "Node is detached from document"
                const label = await page.$(`#${labelId}`);
                if (!label) continue;

                const labelText = await label.evaluate((e: Element) => (e.textContent || '').trim());
                const dataMatch = labelText.match(/(\d{1,4})\s*(Go|Mo)/i);
                if (!dataMatch) continue;

                const rawData = parseInt(dataMatch[1], 10);
                const unit = dataMatch[2].toLowerCase();
                const dataGb = unit === 'mo' ? rawData / 1000 : rawData;

                // Cliquer via le DOM
                await page.evaluate((id: string) => document.getElementById(id)?.click(), labelId);
                await new Promise(r => setTimeout(r, 2500));

                // STRATÉGIE : trouver l'élément avec le PLUS GRAND font-size 
                // qui contient un prix (c'est le prix principal affiché en gros)
                const price = await page.evaluate((selectedDataGb: number) => {
                    let bestPrice = 0;
                    let biggestFontSize = 0;

                    const allElements = document.querySelectorAll('*');
                    for (const el of Array.from(allElements)) {
                        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();

                        // Ne considérer que les éléments courts (< 30 chars)
                        // qui contiennent un nombre suivi de € ou ,
                        if (text.length > 30) continue;

                        const priceMatch = text.match(/^(\d{1,3})[,.](\d{2})\s*€?$/);
                        if (!priceMatch) continue;

                        const computedStyle = window.getComputedStyle(el);
                        const fontSize = parseFloat(computedStyle.fontSize);

                        if (fontSize > biggestFontSize) {
                            biggestFontSize = fontSize;
                            bestPrice = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                        }
                    }

                    // Fallback: chercher dans un contexte plus large
                    if (bestPrice === 0) {
                        for (const el of Array.from(allElements)) {
                            const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                            if (text.length > 50) continue;
                            const m = text.match(/(\d{1,3})[,.](\d{2})\s*€\s*\/?\s*mois/);
                            if (m) {
                                const fs = parseFloat(window.getComputedStyle(el).fontSize);
                                if (fs > biggestFontSize) {
                                    biggestFontSize = fs;
                                    bestPrice = parseFloat(`${m[1]}.${m[2]}`);
                                }
                            }
                        }
                    }


                    // Extraire les appels sur la page visible
                    let foundCalls = "Illimités";
                    const pageText = document.body.innerText.toLowerCase();
                    if (pageText.match(/(\d+)h\s*d*'*appels/i)) {
                        const m = pageText.match(/(\d+)h\s*d*'*appels/i);
                        if (m) foundCalls = `${m[1]}h`;
                    }

                    const visibleText = document.body.innerText;
                    let has5G = false;
                    const rgx5g = new RegExp(`\\b${selectedDataGb}\\s*Go`, 'i');
                    for (const el of Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,span,p,div,label,a,li,strong,b'))) {
                        const t = (el.textContent || '').trim();
                        if (t.length < 3 || t.length > 100) continue;
                        if (rgx5g.test(t) && /\b5g\b/i.test(t)) { has5G = true; break; }
                    }
                    if (!has5G) {
                        for (const img of Array.from(document.querySelectorAll('img'))) {
                            const attrs = `${img.getAttribute('alt') || ''} ${img.getAttribute('src') || ''}`;
                            if (!/5g/i.test(attrs)) continue;
                            let p: Element | null = img.parentElement;
                            for (let d = 0; d < 8 && p; d++, p = p.parentElement) {
                                if ((p.textContent || '').length < 300 && rgx5g.test(p.textContent || '')) { has5G = true; break; }
                            }
                            if (has5G) break;
                        }
                    }

                    // Extract EU/DOM data
                    let euGb = 0;
                    const euMatch = visibleText.match(/(\d{1,3})\s*[Gg]o.*?(?:europ|UE|DOM)/i)
                        || visibleText.match(/(?:europ|UE|DOM).*?(\d{1,3})\s*[Gg]o/i);
                    if (euMatch) euGb = parseInt(euMatch[1], 10);

                    return { bestPrice, calls: foundCalls, has5G, euGb };
                }, dataGb);

                const gen = (price.has5G || /\b5g\b/i.test(labelText)) ? '5G' : '4G';

                if (price.bestPrice > 0 && !plans.some(p => p.dataGb === dataGb)) {
                    plans.push({ planName: `${dataGb} Go`, dataGb, price: price.bestPrice, calls: price.calls, networkGeneration: gen, dataEuGb: price.euGb || 0 });
                }
            } catch (err) {
                console.warn('[RED] Erreur:', err);
            }
        }

        return plans
            .filter(p => p.price > 0 && p.dataGb > 0)
            .map(plan => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'RED by SFR',
                network: 'SFR',
                networkGeneration: plan.networkGeneration,
                dataEuGb: plan.dataEuGb || undefined
            }));
    } catch (error) {
        console.error('Erreur dans la collecte RED by SFR:', error);
        return [];
    }
};
