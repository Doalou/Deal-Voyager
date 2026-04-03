import type { ScraperConfig, ScrapedPlan } from './types';
import { extractFeesFromText } from './utils';

export const bAndYouScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 5000));

        // ─── Fermer bannière cookies ───
        try {
            const acceptBtn = await page.$(
                '#popin_tc_privacy_button_2, #didomi-notice-agree-button, button[id*="accept"]',
            );
            if (acceptBtn) {
                await acceptBtn.click();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch { }

        // ─── Scroller pour charger tout le contenu ───
        await page.evaluate(async () => {
            for (let i = 0; i < 5; i++) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(r => setTimeout(r, 800));
            }
        });

        // ─── Ouvrir la modale Mentions Légales pour extraire les frais ───
        try {
            await page.evaluate(() => {
                const triggers = Array.from(document.querySelectorAll('button, a, div[role="button"], span'))
                    .filter(el => {
                        const t = (el.textContent || '').toLowerCase().trim();
                        return (t.includes('mentions l') || t.includes('voir les d') || t.includes('afficher plus'));
                    });
                for (const btn of triggers) {
                    try { (btn as HTMLElement).click(); } catch { }
                }
            });
            await new Promise(r => setTimeout(r, 2000));
        } catch { }
        await new Promise(r => setTimeout(r, 2000));

        // ─── Extraction des frais via la fonction centralisée ───
        const pageText = await page.evaluate(() => (document.body.innerText || ''));
        const fees = extractFeesFromText(pageText);

        console.log(
            `[B&You] Frais extraits — SIM: ${fees.simPrice}€, activation: ${fees.activationPrice}€, résiliation: ${fees.cancellationPrice}€`,
        );

        // ─── Récupérer les options de forfait disponibles ───
        // B&You utilise des boutons radio pour sélectionner le volume data
        const optionTexts = await page.evaluate(() => {
            // Sélecteurs actuels : boutons avec texte data (2h 1Go, 5Go, 150Go, 200Go)
            const selectors = [
                'button.is-label-check',
                'label.radio-label',
                'label[class*="radio"]',
                'label',
            ];

            const results: string[] = [];
            for (const sel of selectors) {
                const els = document.querySelectorAll(sel);
                for (const el of Array.from(els)) {
                    const text = (el.textContent || '').trim();
                    if (/\d+\s*(Go|Mo)/i.test(text) && text.length < 50) {
                        if (!results.includes(text)) results.push(text);
                    }
                }
                if (results.length > 0) break;
            }
            return results;
        });

        const plans: ScrapedPlan[] = [];

        for (const optText of optionTexts) {
            try {
                // ─── Extraire le volume data du label ───
                const dataMatch = optText.match(/(\d{1,4})\s*(Go|Mo)/i);
                if (!dataMatch) continue;
                const rawData = parseInt(dataMatch[1], 10);
                const unit = dataMatch[2].toLowerCase();
                const dataGb = unit === 'mo' ? rawData / 1000 : rawData;

                let specificCalls = 'Illimités';
                const callMatch = optText.match(/(\d+)h/i);
                if (callMatch) specificCalls = `${callMatch[1]}h`;

                // ─── Cliquer sur l'option ───
                await page.evaluate((targetText: string) => {
                    const selectors = ['button.is-label-check', 'label.radio-label', 'label[class*="radio"]', 'label'];
                    for (const sel of selectors) {
                        const els = document.querySelectorAll(sel);
                        for (const el of Array.from(els)) {
                            if ((el.textContent || '').trim() === targetText) {
                                (el as HTMLElement).click();
                                return;
                            }
                        }
                    }
                }, optText);
                await new Promise(r => setTimeout(r, 2000));

                // ─── Lire le prix et les infos du forfait sélectionné ───
                const planData = await page.evaluate((selectedDataGb: number) => {
                    // Stratégie 1 : sticky bar "Votre sélection" en bas de page
                    const stickyBars = document.querySelectorAll(
                        '[class*="sticky"], [class*="bottom"], [class*="selection"], [class*="recap"]'
                    );
                    for (const bar of Array.from(stickyBars)) {
                        const text = (bar.textContent || '').replace(/\u00a0/g, ' ');
                        const pm = text.match(/(\d{1,3})[,.]\s*(\d{2})\s*€\s*\/?\s*mois/i);
                        if (pm) {
                            return { price: parseFloat(`${pm[1]}.${pm[2]}`) };
                        }
                    }

                    // Stratégie 2 : plus gros prix par font-size (carte bleue principale)
                    let bestPrice = 0;
                    let biggestFs = 0;
                    for (const el of Array.from(document.querySelectorAll('*'))) {
                        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                        if (text.length > 30) continue;
                        const pm = text.match(/^(\d{1,3})[,.]\s*(\d{2})\s*€?$/);
                        if (!pm) continue;
                        const fs = parseFloat(window.getComputedStyle(el).fontSize);
                        if (fs > biggestFs) {
                            biggestFs = fs;
                            bestPrice = parseFloat(`${pm[1]}.${pm[2]}`);
                        }
                    }
                    if (bestPrice > 0) return { price: bestPrice };

                    // Stratégie 3 : dernier "X,XX€/mois" dans le body
                    const bodyText = document.body.innerText;
                    const allPrices = bodyText.match(/(\d{1,3})[,.]\s*(\d{2})\s*€\s*\/?\s*mois/gi);
                    if (allPrices && allPrices.length > 0) {
                        const last = allPrices[allPrices.length - 1];
                        const m = last.match(/(\d{1,3})[,.]\s*(\d{2})/);
                        if (m) return { price: parseFloat(`${m[1]}.${m[2]}`) };
                    }

                    return { price: 0 };
                }, dataGb);

                if (planData.price <= 0 || plans.some(p => p.dataGb === dataGb)) continue;

                // ─── Détection 5G ───
                const has5G = await page.evaluate((dGb: number) => {
                    const rgx = new RegExp(`\\b${dGb}\\s*Go`, 'i');
                    // Chercher dans les éléments textuels proches du forfait
                    for (const el of Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,span,p,div,label,strong,b,img'))) {
                        if (el.tagName === 'IMG') {
                            const attrs = `${el.getAttribute('alt') || ''} ${el.getAttribute('src') || ''}`;
                            if (!/5g/i.test(attrs)) continue;
                            let p: Element | null = el.parentElement;
                            for (let d = 0; d < 8 && p; d++, p = p.parentElement) {
                                if ((p.textContent || '').length < 300 && rgx.test(p.textContent || '')) return true;
                            }
                        } else {
                            const t = (el.textContent || '').trim();
                            if (t.length < 3 || t.length > 100) continue;
                            if (rgx.test(t) && /\b5g\b/i.test(t)) return true;
                        }
                    }
                    return false;
                }, dataGb);

                // ─── Détection data EU ───
                const euGb = await page.evaluate(() => {
                    const text = document.body.innerText;
                    const m = text.match(/(\d{1,3})\s*[Gg]o\s*utilisables?\s*en\s*[Ee]urop/);
                    return m ? parseInt(m[1], 10) : 0;
                });

                const gen = has5G || /\b5g\b/i.test(optText) ? '5G' : '4G';
                const planName = `Forfait B&You ${dataGb >= 1 ? dataGb + ' Go' : dataGb * 1000 + ' Mo'}`;

                plans.push({
                    planName,
                    dataGb,
                    price: planData.price,
                    calls: specificCalls,
                    operator: 'B&You',
                    network: 'Bouygues Telecom',
                    networkGeneration: gen,
                    dataEuGb: euGb || undefined,
                    simPrice: fees.simPrice ?? undefined,
                    activationPrice: fees.activationPrice ?? undefined,
                    cancellationPrice: fees.cancellationPrice ?? undefined,
                });
            } catch (err) {
                console.warn('[B&You] Erreur sur une option:', err);
            }
        }

        // ─── Fallback textuel si aucun plan trouvé via les clics ───
        if (plans.length === 0) {
            console.log('[B&You] Fallback extraction textuelle...');
            const fallbackPlans = await page.evaluate(() => {
                const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string }[] = [];
                const bodyText = document.body.innerText;
                const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                for (let i = 0; i < lines.length; i++) {
                    const dataMatch = lines[i].match(/^(?:(\d+)h\s*)?(\d{1,4})\s*(Go|Mo)\s*$/i);
                    if (!dataMatch) continue;
                    const hoursRaw = dataMatch[1];
                    const rawData = parseInt(dataMatch[2], 10);
                    const unit = dataMatch[3].toLowerCase();
                    const dataGb = unit === 'mo' ? rawData / 1000 : rawData;
                    if (dataGb <= 0) continue;

                    let calls = hoursRaw ? `${hoursRaw}h` : 'Illimités';

                    for (let j = Math.max(0, i - 15); j < Math.min(lines.length, i + 15); j++) {
                        const cleanLine = lines[j].replace(/\u00a0/g, ' ').trim();
                        const priceMatch = cleanLine.match(/(\d{1,3})[,.]\s*(\d{2})\s*€/);
                        if (priceMatch) {
                            const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                            if (price > 0 && price < 80 && !results.some(r => r.dataGb === dataGb)) {
                                const nearbyText = lines.slice(Math.max(0, i - 5), i + 15).join(' ');
                                const gen = /\b5g\b/i.test(nearbyText) ? '5G' : '4G';
                                results.push({
                                    planName: `Forfait B&You ${dataGb >= 1 ? dataGb + ' Go' : dataGb * 1000 + ' Mo'}`,
                                    dataGb, price, calls, networkGeneration: gen,
                                });
                            }
                            break;
                        }
                    }
                }
                return results;
            });

            for (const p of fallbackPlans) {
                plans.push({
                    ...p,
                    operator: 'B&You',
                    network: 'Bouygues Telecom',
                    dataEuGb: undefined,
                    simPrice: fees.simPrice ?? undefined,
                    activationPrice: fees.activationPrice ?? undefined,
                    cancellationPrice: fees.cancellationPrice ?? undefined,
                });
            }
        }

        return plans.filter(p => p.price > 0 && p.dataGb > 0);
    } catch (error) {
        console.error('Erreur dans la collecte B&You:', error);
        return [];
    }
};
