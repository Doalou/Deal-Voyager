import type { ScraperConfig, ScrapedPlan } from './types';

export const symaMobileScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    console.log('Extraction des données de la page Syma Mobile…');
    try {
        await new Promise(r => setTimeout(r, 8000));

        try {
            const acceptBtn = await page.$('#didomi-notice-agree-button, button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler, .cc-accept');
            if (acceptBtn) await acceptBtn.click();
            await new Promise(r => setTimeout(r, 1500));
        } catch (_) { }

        // SPA: scroll and wait for JS rendering
        for (let s = 0; s < 3; s++) {
            await page.evaluate((step) => window.scrollTo(0, (step + 1) * (document.body.scrollHeight / 3)), s);
            await new Promise(r => setTimeout(r, 2000));
        }
        await new Promise(r => setTimeout(r, 3000));

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number; calls: string; networkGeneration: string }[] = [];
            const bodyText = document.body.innerText || '';
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            for (let i = 0; i < lines.length; i++) {
                const dataMatch = lines[i].match(/(\d{1,4})\s*(Go|Mo)/i);
                if (!dataMatch) continue;

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
                    if (/5g/i.test(lines[j])) { gen = '5G'; break; }
                }

                const planName = `Forfait Syma Mobile ${dataMatch[1]} ${dataMatch[2]}`;

                if (!results.some(r => r.dataGb === dataGb && r.price === price)) {
                    results.push({ planName, dataGb, price, calls, networkGeneration: gen });
                }
            }

            return results;
        });

        console.log(`[Syma Mobile] Plans extraits :`, JSON.stringify(plans));

        return plans
            .filter(p => p.price > 0 && p.dataGb > 0)
            .map(plan => ({
                planName: plan.planName,
                dataGb: plan.dataGb,
                price: plan.price,
                calls: plan.calls,
                operator: 'Syma Mobile',
                network: 'SFR',
                networkGeneration: plan.networkGeneration || '4G',
            }));
    } catch (error) {
        console.error('Erreur dans la collecte Syma Mobile:', error);
        return [];
    }
};
