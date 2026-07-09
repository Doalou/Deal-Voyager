import type { ScraperConfig, ScrapedPlan } from './types';
import { extractFeesFromText } from './utils';

export const nordnetScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
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

        // ─── Scroller tout ───
        await page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(r => setTimeout(r, 800));
            }
        });
        await new Promise(r => setTimeout(r, 2000));

        // ─── Extraction frais via helper centralisé sur texte mobile (anti box/fibre) ───
        const feesText = await page.evaluate(() => {
            const lines = (document.body.innerText || '')
                .replace(/\u00a0/g, ' ')
                .replace(/\u202f/g, ' ')
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0);

            const mobileLines = lines.filter((line) => {
                const lower = line.toLowerCase();
                if (/fibre|adsl|satellite|4gfix|internet\s*radio|box/i.test(lower)) return false;
                return /mobile|forfait|sim|sans engagement|go|appel|sms/i.test(lower);
            });
            return mobileLines.join('\n');
        });
        const fees = extractFeesFromText(feesText);
        console.log(`[Nordnet] Frais extraits - SIM: ${fees.simPrice}€, activation: ${fees.activationPrice}€, résiliation: ${fees.cancellationPrice}€`);

        const plans: ScrapedPlan[] = [];

        // ─── Passage 1: clic sur onglets data (structure actuelle du site) ───
        const tabTexts = await page.evaluate(() => {
            const out: string[] = [];
            const clickables = Array.from(document.querySelectorAll('button, a, [role="tab"], [role="button"]'));
            for (const el of clickables) {
                const raw = (el.textContent || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ').replace(/\s+/g, ' ').trim();
                if (/^\d{1,3}\s*go(?:\s*4g(?:\/5g)?|\s*5g)?$/i.test(raw) && !out.includes(raw)) {
                    out.push(raw);
                }
            }
            if (out.length === 0) {
                const body = (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
                const m = body.match(/\b\d{1,3}\s*go\b/gi) || [];
                for (const x of m) {
                    const clean = x.replace(/\s+/g, ' ').trim();
                    if (!out.includes(clean)) out.push(clean);
                }
            }
            return out;
        });

        for (const tabText of tabTexts) {
            try {
                // Extraire la data depuis le texte de l'onglet (ex: "1 Go", "30 Go 4G", "150 Go 4G/5G")
                const tabDataMatch = /(\d{1,3})\s*go/i.exec(tabText);
                if (!tabDataMatch) continue;
                const tabDataGb = Number.parseInt(tabDataMatch[1], 10);

                // Cliquer sur l'onglet
                await page.evaluate((target: string) => {
                    const clickables = Array.from(document.querySelectorAll('[role="tab"], button, a, [role="button"], li'));
                    const normalizedTarget = target.replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                    for (const el of clickables) {
                        const t = (el.textContent || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
                        if (t === normalizedTarget || t.startsWith(normalizedTarget)) {
                            (el as HTMLElement).click();
                            return;
                        }
                    }
                }, tabText);
                await new Promise(r => setTimeout(r, 1300));

                // Lire le prix depuis le panel actif (pas le body entier)
                const parsed = await page.evaluate(() => {
                    // Stratégie 1: chercher le tabpanel visible
                    var panelText = '';
                    var panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
                    for (var p = 0; p < panels.length; p++) {
                        var panel = panels[p] as HTMLElement;
                        // Le panel actif est celui qui n'est pas caché
                        if (panel.getAttribute('aria-hidden') === 'true') continue;
                        if (panel.getAttribute('hidden') !== null) continue;
                        var style = window.getComputedStyle(panel);
                        if (style.display === 'none' || style.visibility === 'hidden') continue;
                        panelText = (panel.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
                        break;
                    }
                    
                    // Fallback: si pas de tabpanel trouvé, utiliser le selected tab's content
                    if (!panelText) {
                        var selectedTab = document.querySelector('[role="tab"][aria-selected="true"]');
                        if (selectedTab) {
                            // Le tabpanel est souvent référencé via aria-controls
                            var controls = selectedTab.getAttribute('aria-controls');
                            if (controls) {
                                var targetPanel = document.getElementById(controls);
                                if (targetPanel) {
                                    panelText = (targetPanel.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
                                }
                            }
                        }
                    }
                    
                    // Dernier fallback: section .active ou élément principal visible
                    if (!panelText) {
                        var activeSection = document.querySelector('.active[class*="panel"], .active[class*="tab"], section.active, div.active');
                        if (activeSection) {
                            panelText = ((activeSection as HTMLElement).innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
                        }
                    }
                    
                    // Fallback ultime: tout le body (ancien comportement)
                    if (!panelText) {
                        panelText = (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
                    }

                    // Chercher le prix dans les formats Nordnet: "XX€XX par mois" ou "XX€XX/mois"
                    var priceMatches = panelText.match(/(\d{1,2})\s*€\s*(\d{2})\s*(?:par\s*mois|\/\s*mois)/gi) || [];
                    var price = 0;
                    for (var i = 0; i < priceMatches.length; i++) {
                        var m = priceMatches[i].match(/(\d{1,2})\s*€\s*(\d{2})/);
                        if (m) {
                            var val = Number.parseFloat(m[1] + '.' + m[2]);
                            if (val > 0 && val < 100) { price = val; break; }
                        }
                    }

                    // Fallback: "XX,XX€/mois"
                    if (price === 0) {
                        var fm = /(\d{1,2})[,.](\d{2})\s*€\s*(?:\/?\s*mois|par\s*mois)/i.exec(panelText);
                        if (fm) price = Number.parseFloat(fm[1] + '.' + fm[2]);
                    }

                    var gen = /\b5g\b/i.test(panelText) ? '5G' : '4G';
                    var euGb = 0;
                    var euMatch = /(\d{1,3})\s*go[^\n]{0,60}(?:europe|drom|ue)/i.exec(panelText)
                        || /(?:europe|drom|ue)[^\n\d]{0,40}(\d{1,3})\s*go/i.exec(panelText);
                    if (euMatch) euGb = Number.parseInt(euMatch[1], 10);

                    return { price: price, gen: gen, euGb: euGb };
                });

                if (parsed.price <= 0) continue;
                if (!plans.some(p => p.dataGb === tabDataGb && p.price === parsed.price)) {
                    const gen5g = /5g/i.test(tabText) ? '5G' : parsed.gen;
                    plans.push({
                        planName: `Nordnet ${tabDataGb} Go`,
                        dataGb: tabDataGb,
                        price: parsed.price,
                        calls: 'Illimités',
                        operator: 'Nordnet',
                        network: 'Orange',
                        networkGeneration: gen5g,
                        dataEuGb: parsed.euGb || undefined,
                        simPrice: fees.simPrice ?? undefined,
                        activationPrice: fees.activationPrice ?? undefined,
                        cancellationPrice: fees.cancellationPrice ?? undefined,
                    });
                }
            } catch {
                // no-op
            }
        }

        // ─── Passage 2: extraction textuelle globale robuste ───
        if (plans.length === 0) {
            const fallbackPlans = await page.evaluate(() => {
                const results: { dataGb: number; price: number; gen: string; euGb: number }[] = [];
                const text = (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');

                const blockRegex = /(\d{1,3})\s*go\s*(4g(?:\/5g)?|5g)?[\s\S]{0,260}?pour\s*(\d{1,2})\s*€\s*(\d{2})\s*par\s*mois/gi;
                let m;
                while ((m = blockRegex.exec(text)) !== null) {
                    const dataGb = Number.parseInt(m[1], 10);
                    const price = Number.parseFloat(`${m[3]}.${m[4]}`);
                    if (dataGb <= 0 || dataGb > 1000 || price <= 0 || price >= 100) continue;

                    const context = text.substring(Math.max(0, m.index - 120), Math.min(text.length, m.index + m[0].length + 120));
                    if (/fibre|adsl|satellite|4gfix|internet\s*radio/i.test(context)) continue;

                    const gen = /\b5g\b/i.test(context) ? '5G' : ((m[2] || '').toLowerCase().includes('5g') ? '5G' : '4G');
                    let euGb = 0;
                    const euMatch = /(\d{1,3})\s*go[^\n]{0,60}(?:europe|drom|ue)/i.exec(context)
                        || /(?:europe|drom|ue)[^\n\d]{0,40}(\d{1,3})\s*go/i.exec(context);
                    if (euMatch) euGb = Number.parseInt(euMatch[1], 10);

                    if (!results.some(r => r.dataGb === dataGb && r.price === price)) {
                        results.push({ dataGb, price, gen, euGb });
                    }
                }

                return results;
            });

            for (const p of fallbackPlans) {
                plans.push({
                    planName: `Nordnet ${p.dataGb} Go`,
                    dataGb: p.dataGb,
                    price: p.price,
                    calls: 'Illimités',
                    operator: 'Nordnet',
                    network: 'Orange',
                    networkGeneration: p.gen,
                    dataEuGb: p.euGb || undefined,
                    simPrice: fees.simPrice ?? undefined,
                    activationPrice: fees.activationPrice ?? undefined,
                    cancellationPrice: fees.cancellationPrice ?? undefined,
                });
            }
        }

        return plans.filter(p => p.price > 0 && p.dataGb > 0);
    } catch (error) {
        console.error('Erreur dans la collecte Nordnet:', error);
        return [];
    }
};
