import type { ScraperConfig } from './types';

export const youPriceScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 3000));
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));

        const plans = await page.evaluate(() => {
            const results: { planName: string; dataGb: number; price: number; calls: string; network: string; networkGeneration: string }[] = [];

            const allText = document.body.innerText;
            const lines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            let currentNetwork = 'Orange / SFR';
            let currentGeneration = '4G';
            let currentData = 0;
            let currentPrice = -1;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const lowerLine = line.toLowerCase();

                if (lowerLine.includes('réseau orange')) currentNetwork = 'Orange';
                else if (lowerLine.includes('réseau sfr')) currentNetwork = 'SFR';
                else if (lowerLine.includes('réseau bouygues')) currentNetwork = 'Bouygues';

                if (/\b5g\b/i.test(line)) currentGeneration = '5G';
                else if (/\b4g\b/i.test(line) && !/\b5g\b/i.test(line)) currentGeneration = '4G';

                // Cas 1: Ligne complète "XXGo à YY,YY€/mois"
                // On s'appuie uniquement sur ce format "Titre" pour éviter d'aspirer la "Data EU" ou "Data DOM" par erreur.
                const fullMatch = lowerLine.match(/^(\d{1,3})\s*go\s*à\s*(\d{1,2})[,\.](\d{2})€/);
                if (fullMatch) {
                    currentData = parseInt(fullMatch[1], 10);
                    currentPrice = parseFloat(`${fullMatch[2]}.${fullMatch[3]}`);

                    results.push({
                        planName: `Forfait YouPrice ${currentData} Go (${currentNetwork})`,
                        dataGb: currentData,
                        price: currentPrice,
                        calls: 'Illimités',
                        network: currentNetwork,
                        networkGeneration: currentGeneration
                    });

                    currentData = 0; currentPrice = -1;
                    continue;
                }
            }

            return results;
        });

        // Nettoyage et déduplication
        const uniquePlans = [];
        const seen = new Set();

        for (const plan of plans) {
            const key = `${plan.network}-${plan.dataGb}-${plan.price}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniquePlans.push({
                    planName: plan.planName.charAt(0).toUpperCase() + plan.planName.slice(1),
                    dataGb: plan.dataGb,
                    price: plan.price,
                    calls: plan.calls,
                    operator: 'YouPrice',
                    network: plan.network || 'Orange / SFR',
                    networkGeneration: plan.networkGeneration || '4G'
                });
            }
        }

        for (const p of uniquePlans) {
        }

        return uniquePlans;
    } catch (error) {
        console.error('Erreur dans la collecte YouPrice:', error);
        return [];
    }
};
