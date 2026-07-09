import type { ScraperConfig, ScrapedPlan } from './types';
import { extractFeesFromText } from './utils';

export const lebaraScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 7000));

        try {
            const acceptBtn = await page.$('#onetrust-accept-btn-handler, button[id*="accept"], button[class*="accept"], .cc-accept');
            if (acceptBtn) await acceptBtn.click();
            await new Promise(r => setTimeout(r, 1500));
        } catch (_) { }

        for (let s = 0; s < 3; s++) {
            await page.evaluate((step) => window.scrollTo(0, (step + 1) * (document.body.scrollHeight / 3)), s);
            await new Promise(r => setTimeout(r, 1500));
        }
        await new Promise(r => setTimeout(r, 3000));

        const rawPageText = await page.evaluate(() => (document.body.innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' '));
        const pageFees = extractFeesFromText(rawPageText);
        if (pageFees.simPrice == null && /(?:e?sim|carte\s*sim)\s*(?:classique\s*)?(?:gratuite?|offerte?|sans\s+frais)/i.test(rawPageText)) {
            pageFees.simPrice = 0;
        }
        if (pageFees.cancellationPrice == null && /sans\s+engagement/i.test(rawPageText)) {
            pageFees.cancellationPrice = 0;
        }

        const plans = await page.evaluate((globalFees) => {
            const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string; dataEuGb: number; simPrice: number | null; activationPrice: number | null; cancellationPrice: number | null }[] = [];
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // Détecter si la carte SIM est gratuite (global à la page)
            let simPrice: number | null = globalFees.simPrice;
            const fullText = bodyText.toLowerCase();
            if (simPrice == null && (/sim\s*gratuit/i.test(fullText) || /carte\s*sim.*?0[,.]?0{0,2}\s*€/i.test(fullText) || /0[,.]00\s*€.*?sim/i.test(fullText) || /sim.*?offert/i.test(fullText) || /sim.*?sans\s+frais/i.test(fullText))) {
                simPrice = 0;
            } else if (simPrice == null) {
                const simPats = [
                    /carte\s*sim\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
                    /(\d+(?:[,.]\d{2})?)\s*€[^\n]{0,30}(?:carte\s*sim)/i,
                    /frais\s*(?:de\s*)?(?:livraison|envoi)\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
                ];
                for (const pat of simPats) {
                    const m = fullText.match(pat);
                    if (m) {
                        const v = parseFloat(m[1].replace(',', '.'));
                        if (v > 0 && v <= 50) { simPrice = v; break; }
                    }
                }
            }

            let activationPrice: number | null = globalFees.activationPrice;
            const actPats = [
                /frais\s*(?:d['\u2019e]\s*)?activation\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
                /frais\s*(?:de\s*)?mise\s*en\s*service\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
                /frais\s*(?:de\s*)?souscription\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i,
            ];
            if (activationPrice == null) {
                for (const p of actPats) {
                    const m = fullText.match(p);
                    if (m) { activationPrice = parseFloat(m[1].replace(',', '.')); break; }
                }
            }

            let cancellationPrice: number | null = globalFees.cancellationPrice ?? 0;
            if (/frais\s*(?:de\s*)?r[\u00e9e]siliation\s*(?::|de)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i.test(fullText)) {
                const m = fullText.match(/frais\s*(?:de\s*)?r[\u00e9e]siliation\s*(?::|de)?\s*(\d+(?:[,.]\d{2})?)\s*\u20ac/i);
                if (m) cancellationPrice = parseFloat(m[1].replace(',', '.'));
            }

            const cards = Array.from(document.querySelectorAll('.plan-card-details, [id^="expandable-plan-card-plan-box"]'));
            for (const card of cards) {
                const text = ((card as HTMLElement).innerText || '').replace(/\u00a0/g, ' ').replace(/\u202f/g, ' ');
                const dataMatch = text.match(/(\d{1,4})\s*(Go|Mo)\b/i);
                const priceMatch = text.match(/(\d{1,3})[,.](\d{2})\s*€/i);
                if (!dataMatch || !priceMatch) continue;

                const rawData = parseInt(dataMatch[1], 10);
                const unit = dataMatch[2].toLowerCase();
                const dataGb = unit === 'mo' ? rawData / 1000 : rawData;
                const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
                if (dataGb <= 0 || dataGb > 1000 || price <= 0 || price >= 100) continue;

                const euMatch = text.match(/(?:dont\s*)?(\d{1,3})\s*go\s*(?:en\s*)?(?:itin[ée]rance|roaming|depuis|en|utilisables?)[^\n.]{0,80}(?:l['’])?(?:ue|europe|dom)/i)
                    || text.match(/(?:ue|europe|dom|itin[ée]rance)[^\n\d]{0,60}(\d{1,3})\s*go/i);
                const euGb = euMatch ? parseInt(euMatch[1], 10) : 0;
                const gen = /\b5g\b/i.test(text) ? '5G' : '4G';
                const planName = `Forfait Lebara ${dataMatch[1]} ${dataMatch[2]}`;

                if (!results.some(r => r.dataGb === dataGb && r.price === price)) {
                    results.push({ planName, dataGb, price, calls: 'Illimités', networkGeneration: gen, dataEuGb: euGb, simPrice, activationPrice, cancellationPrice });
                }
            }

            if (results.length > 0) {
                return results;
            }

            for (let i = 0; i < lines.length; i++) {
                const dataMatch = lines[i].match(/(\d{1,4})\s*(Go|Mo)/i);
                if (!dataMatch) continue;
                if (/(?:itin[ée]rance|europe|ue|dom)/i.test(lines[i])) continue;

                const rawData = parseInt(dataMatch[1], 10);
                const unit = dataMatch[2].toLowerCase();
                const dataGb = unit === 'mo' ? rawData / 1000 : rawData;
                if (dataGb <= 0 || dataGb > 1000) continue;

                let price = 0;
                const calls = 'Illimités';

                for (let j = i + 1; j < Math.min(lines.length, i + 20); j++) {
                    const clean = lines[j].replace(/\u00a0/g, ' ').trim();

                    const stdMatch = clean.match(/(\d{1,3})[,.](\d{2})\s*€/);
                    if (stdMatch && price === 0) {
                        price = parseFloat(`${stdMatch[1]}.${stdMatch[2]}`);
                        continue;
                    }

                    const euroMatch = clean.match(/^(\d{1,3})€(\d{2})/);
                    if (euroMatch && price === 0) {
                        price = parseFloat(`${euroMatch[1]}.${euroMatch[2]}`);
                        continue;
                    }

                    if (/^\d{1,2}$/.test(clean) && price === 0) {
                        const nextLine = (j + 1 < lines.length) ? lines[j + 1].replace(/\u00a0/g, ' ').trim() : '';
                        const centsMatch = nextLine.match(/€\s*(\d{2})/);
                        if (centsMatch) {
                            price = parseInt(clean, 10) + parseInt(centsMatch[1], 10) / 100;
                        }
                    }

                    if (/^\d{1,4}\s*(Go|Mo)\s*$/i.test(clean) && j > i + 3) break;
                }

                if (price <= 0) continue;

                let gen = '4G';
                for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 15); j++) {
                    if (/\b5g\b/i.test(lines[j])) { gen = '5G'; break; }
                }

                let euGb = 0;
                for (let j = i; j < Math.min(lines.length, i + 20); j++) {
                    const euMatch = lines[j].match(/(?:dont\s*)?(\d{1,3})\s*[Gg]o\s*(?:en\s*)?(?:itin[ée]rance|roaming|depuis|en|utilisables?)?[^\n]{0,80}(?:l['’])?(?:europ|UE|DOM)/i);
                    if (euMatch) { euGb = parseInt(euMatch[1], 10); break; }
                    const euMatch2 = lines[j].match(/(?:europ|UE|DOM)\D*(\d{1,3})\s*[Gg]o/i);
                    if (euMatch2) { euGb = parseInt(euMatch2[1], 10); break; }
                }

                const planName = `Forfait Lebara ${dataMatch[1]} ${dataMatch[2]}`;

                if (!results.some(r => r.dataGb === dataGb && r.price === price)) {
                    results.push({ planName, dataGb, price, calls, networkGeneration: gen, dataEuGb: euGb, simPrice, activationPrice, cancellationPrice });
                }
            }

            return results;
        }, pageFees);


        return plans
            .filter(p => p.price > 0 && p.dataGb > 0)
            .map(plan => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'Lebara',
                network: 'SFR',
                networkGeneration: plan.networkGeneration || '4G',
                dataEuGb: plan.dataEuGb || undefined,
                simPrice: plan.simPrice ?? undefined,
                activationPrice: plan.activationPrice ?? undefined,
                cancellationPrice: plan.cancellationPrice ?? undefined
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Lebara:', error);
        return [];
    }
};
