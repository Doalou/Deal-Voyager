import type { ScraperConfig, ScrapedPlan } from './types';
import { extractFeesFromText } from './utils';

/**
 * France Telephone (Bleutel) - Scraper WooCommerce API-first + cross-ref DOM.
 *
 * La page WooCommerce affiche le NOM + PRIX mais pas le DATA.
 * Le footer a des liens "Forfait X Go" vers les memes produits.
 * On croise les deux pour obtenir les forfaits complets.
 */
export const franceTelephoneScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
    try {
        await new Promise(r => setTimeout(r, 3000));

        // ─── Extraction frais mobile-only (anti offres fixes Bleufix) ───
        const pageText = await page.evaluate(() => {
            const lines = (document.body.innerText || '')
                .replace(/\u00a0/g, ' ')
                .replace(/\u202f/g, ' ')
                .split('\n')
                .map((l) => l.trim())
                .filter((l) => l.length > 0 && l.length < 260);

            const kept: string[] = [];
            for (const line of lines) {
                const lower = line.toLowerCase();
                if (/bleufix|forfait\s*fixe|t[ée]l[ée]phone\s*fixe|fixe\s+devient\s+mobile/i.test(lower)) continue;
                if (/forfait\s+mobile|bleutel|sans\s+engagement|sans\s+frais|sim|esim|activation|mise\s+en\s+service|r[ée]siliation/i.test(lower)) {
                    kept.push(line);
                }
            }
            return kept.join('\n');
        });
        const fees = extractFeesFromText(pageText);

        // Dynamique: si le site indique "sans frais" et qu'aucun montant mobile n'est trouvé,
        // on retient 0 pour éviter qu'un fallback checkout récupère des frais d'offre fixe.
        const lowerFeesText = pageText.toLowerCase();
        if (fees.activationPrice == null && /sans\s+frais/i.test(lowerFeesText)) {
            fees.activationPrice = 0;
        }
        if (fees.cancellationPrice == null && /sans\s+engagement|sans\s+frais/i.test(lowerFeesText)) {
            fees.cancellationPrice = 0;
        }

        console.log(`[France Telephone] Frais extraits - SIM: ${fees.simPrice}€, activation: ${fees.activationPrice}€, résiliation: ${fees.cancellationPrice}€`);

        // ─── STRATEGIE 1 : API WooCommerce Store ───
        let apiPlans: ScrapedPlan[] = [];
        try {
            const pageOrigin = new URL(page.url()).origin;

            const endpoints = [
                '/wp-json/wc/store/v1/products?per_page=100',
                '/wp-json/wc/store/products?per_page=100',
                '/wp-json/wc/v3/products?per_page=100',
            ];

            let products: any[] | null = null;

            for (const endpoint of endpoints) {
                const apiUrl = pageOrigin + endpoint;
                const resp = await page.evaluate(async (url: string) => {
                    try {
                        const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
                        if (!r.ok) return null;
                        return await r.json();
                    } catch { return null; }
                }, apiUrl);
                if (Array.isArray(resp) && resp.length > 0) {
                    products = resp;
                    console.log('[France Telephone] API endpoint ' + endpoint + ' : ' + products!.length + ' produits');
                    break;
                }
            }

            if (Array.isArray(products) && products.length > 0) {
                for (const product of products) {
                    const name = (product.name || '').replace(/<[^>]*>/g, '').trim();
                    const desc = ((product.description || '') + ' ' + (product.short_description || '')).replace(/<[^>]*>/g, '').toLowerCase();

                    if (!/forfait|mobile|bleutel/i.test(name + ' ' + desc)) continue;
                    if (/fixe|bleufix|telephone\s*fixe/i.test(name)) continue;

                    const dataMatch = (name + ' ' + desc).match(/(\d{1,4})\s*(Go|Mo)/i);
                    if (!dataMatch) continue;
                    const rawData = parseInt(dataMatch[1], 10);
                    const dataGb = dataMatch[2].toLowerCase() === 'mo' ? rawData / 1000 : rawData;
                    if (dataGb <= 0 || dataGb > 1000) continue;

                    let price = 0;
                    if (product.prices) {
                        const rawPrice = product.prices.price || product.prices.regular_price;
                        if (rawPrice) price = parseInt(rawPrice, 10) / 100;
                    }
                    if (price <= 0 || price >= 100) continue;

                    for (const network of ['Orange', 'Bouygues Telecom']) {
                        apiPlans.push({
                            planName: name + ' (' + network + ')',
                            dataGb,
                            price,
                            calls: 'Illimités',
                            operator: 'France Telephone',
                            network,
                            networkGeneration: '4G',
                            simPrice: fees.simPrice ?? undefined,
                            activationPrice: fees.activationPrice ?? undefined,
                            cancellationPrice: fees.cancellationPrice ?? undefined,
                        });
                    }
                }
            }
        } catch (apiErr) {
            console.warn('[France Telephone] API WooCommerce indisponible, fallback DOM...', apiErr);
        }

        if (apiPlans.length > 0) {
            console.log('[France Telephone] ' + apiPlans.length + ' offres extraites via API');
            return apiPlans;
        }

        // ─── STRATEGIE 2 : Cross-reference DOM (nav links + product cards) ───
        console.log('[France Telephone] Fallback extraction DOM cross-ref...');

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));

        const domPlans = await page.evaluate(() => {
            var results: {
                planName: string; dataGb: number; price: number;
            }[] = [];

            // Etape A : mapping slug -> dataGb depuis les liens de navigation
            var slugToData: Record<string, number> = {};
            var allLinks = document.querySelectorAll('a[href*="/product/forfait-mobile-"]');
            for (var i = 0; i < allLinks.length; i++) {
                var a = allLinks[i] as HTMLAnchorElement;
                var href = a.getAttribute('href') || '';
                var text = (a.textContent || '').trim();
                var slugMatch = href.match(/\/product\/forfait-mobile-([^\/]+)/);
                var dataMatch = text.match(/(\d{1,4})\s*Go/i);
                if (slugMatch && dataMatch) {
                    slugToData[slugMatch[1].replace(/\/$/, '')] = parseInt(dataMatch[1], 10);
                }
            }

            // Etape B : cartes produit WooCommerce
            var cards = document.querySelectorAll('li.product, .products > .product, ul.products > li');
            if (cards.length === 0) {
                cards = document.querySelectorAll('.product, article.product, [class*="product-type-simple"]');
            }

            for (var c = 0; c < cards.length; c++) {
                var card = cards[c];
                var cardText = (card.textContent || '').replace(/\u00a0/g, ' ').trim();
                if (cardText.length < 5 || cardText.length > 3000) continue;
                if (/fixe|bleufix/i.test(cardText)) continue;

                var productLink = card.querySelector('a[href*="/product/forfait-mobile-"]') as HTMLAnchorElement;
                var slug = '';
                if (productLink) {
                    var sMatch = (productLink.getAttribute('href') || '').match(/\/product\/forfait-mobile-([^\/]+)/);
                    if (sMatch) slug = sMatch[1].replace(/\/$/, '');
                }

                var priceEl = card.querySelector('.price .amount, span.amount, .price, ins .amount');
                var priceText = priceEl ? (priceEl.textContent || '') : cardText;
                var priceMatch = priceText.match(/(\d{1,3})[,.](\d{2})\s*\u20ac/);
                if (!priceMatch) priceMatch = priceText.match(/(\d{1,3})\s*\u20ac/);
                if (!priceMatch) continue;
                var price = priceMatch[2]
                    ? parseFloat(priceMatch[1] + '.' + priceMatch[2])
                    : parseInt(priceMatch[1], 10);
                if (price <= 0 || price >= 100) continue;

                var titleEl = card.querySelector('h2, h3, h4, .woocommerce-loop-product__title, [class*="title"]');
                var planName = titleEl ? (titleEl.textContent || '').trim() : '';

                var dataGb = 0;
                if (slug && slugToData[slug]) {
                    dataGb = slugToData[slug];
                } else {
                    var cardDataMatch = cardText.match(/(\d{1,4})\s*(Go|Mo)/i);
                    if (cardDataMatch) {
                        var raw = parseInt(cardDataMatch[1], 10);
                        dataGb = cardDataMatch[2].toLowerCase() === 'mo' ? raw / 1000 : raw;
                    }
                }

                if (dataGb <= 0) continue;

                if (!planName) {
                    planName = 'Bleutel ' + (dataGb >= 1 ? dataGb + ' Go' : (dataGb * 1000) + ' Mo');
                }

                if (!results.some(function(r) { return r.dataGb === dataGb && r.price === price; })) {
                    results.push({ planName: planName, dataGb: dataGb, price: price });
                }
            }

            return results;
        });

        // Duplication multi-réseau
        var finalPlans: ScrapedPlan[] = [];
        for (var plan of domPlans) {
            for (var network of ['Orange', 'Bouygues Telecom']) {
                finalPlans.push({
                    planName: plan.planName + ' (' + network + ')',
                    dataGb: plan.dataGb,
                    price: plan.price,
                    calls: 'Illimités',
                    operator: 'France Telephone',
                    network: network,
                    networkGeneration: '4G',
                    simPrice: fees.simPrice ?? undefined,
                    activationPrice: fees.activationPrice ?? undefined,
                    cancellationPrice: fees.cancellationPrice ?? undefined,
                });
            }
        }

        return finalPlans;
    } catch (error) {
        console.error('Erreur dans la collecte France Telephone:', error);
        return [];
    }
};
