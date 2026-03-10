import type { Page } from 'puppeteer';
import https from 'https';
import http from 'http';
import type { PdfFees } from './types';
import { PDFParse } from 'pdf-parse';

/**
 * Télécharge un fichier depuis une URL en suivant les redirections.
 * rejectUnauthorized: false pour gérer les certificats SSL incomplets (fréquents chez les MVNOs).
 */
function downloadBuffer(url: string, maxRedirects = 5): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        if (maxRedirects <= 0) { reject(new Error('Too many redirects')); return; }
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/pdf',
            },
            rejectUnauthorized: false,
        }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const next = new URL(res.headers.location, url).href;
                downloadBuffer(next, maxRedirects - 1).then(resolve).catch(reject);
                return;
            }
            if (!res.statusCode || res.statusCode !== 200) {
                reject(new Error(`PDF download failed: ${res.statusCode}`));
                return;
            }
            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('PDF download timeout')); });
    });
}

/**
 * Télécharge un PDF depuis une URL et en extrait le texte brut.
 */
export async function fetchPdfText(url: string): Promise<string> {
    const buffer = await downloadBuffer(url);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
}

/**
 * Réduit le texte PDF à la section pertinente pour l'opérateur donné.
 * Nécessaire pour les guides multi-produits (ex: Bouygues qui a B&You, Bbox, Clé 4G).
 */
function narrowToOperatorSection(fullText: string, operatorName: string): string {
    const lowerText = fullText.toLowerCase().replace(/\u00a0/g, ' ');

    if (/b\s*&\s*you/i.test(operatorName)) {
        const allRecap = [...lowerText.matchAll(/récapitulatif\s*contractuel/gi)];
        if (allRecap.length >= 2) {
            for (let i = 0; i < allRecap.length; i++) {
                const startIdx = allRecap[i].index!;
                const endIdx = (i + 1 < allRecap.length) ? allRecap[i + 1].index! : lowerText.length;
                const section = lowerText.substring(startIdx, endIdx);
                if (/carte\s*sim\s*seule/i.test(section) && /frais\s*(de\s*)?r[ée]siliation/i.test(section)) {
                    return section;
                }
            }
        }

        const startIdx = lowerText.indexOf('offre carte sim seule');
        if (startIdx >= 0) {
            const nextRecap = lowerText.indexOf('récapitulatif contractuel', startIdx + 100);
            const endIdx = nextRecap > startIdx ? nextRecap : Math.min(startIdx + 8000, lowerText.length);
            return lowerText.substring(startIdx, endIdx);
        }
    }

    return fullText;
}

/**
 * Extrait les frais (résiliation, activation, SIM) depuis le texte brut d'un PDF.
 * Si operatorName est fourni, tente de restreindre la recherche à la section pertinente.
 */
export function extractFeesFromPdfText(pdfText: string, operatorName?: string): PdfFees {
    const rawText = pdfText.toLowerCase().replace(/\u00a0/g, ' ');
    const text = operatorName ? narrowToOperatorSection(rawText, operatorName) : rawText;

    let cancellationPrice: number | null = null;
    const cancelPatterns = [
        /frais\s*(?:de\s*)?r[ée]siliation\s*[^€\d]{0,60}?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
        /r[ée]siliation[^€\d]{0,80}?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
        /(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)\s*[^.\n]{0,40}?(?:r[ée]siliation|r[ée]silier)/gi,
        /frais\s*(?:de\s*)?fermeture\s*[^€\d]{0,60}?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
    ];
    for (const pattern of cancelPatterns) {
        const match = pattern.exec(text);
        if (match) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (val >= 0 && val <= 100) { cancellationPrice = val; break; }
        }
    }

    let activationPrice: number | null = null;
    const activationPatterns = [
        /frais\s*(?:d[''e]\s*)?activation\s*[^€\d]{0,60}?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
        /frais\s*(?:de\s*)?mise\s*en\s*service\s*[^€\d]{0,60}?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
        /(?:souscription|ouverture\s*(?:de\s*)?ligne)\s*[^€\d]{0,60}?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
        /(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)\s*[^.\n]{0,40}?(?:activation|mise\s*en\s*service|souscription)/gi,
    ];
    for (const pattern of activationPatterns) {
        const match = pattern.exec(text);
        if (match) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (val >= 0 && val <= 100) { activationPrice = val; break; }
        }
    }

    let simPrice: number | null = null;
    if (/carte?\s*sim\s*(?:est\s*)?gratuit/i.test(text) || /sim\s*offert/i.test(text)) {
        simPrice = 0;
    } else {
        const directPatterns = [
            /carte\s*sim\s*(?:\/?\s*e?\s*sim\s*)?(?:est\s*)?(?:factur[ée]e?|co[uû]te?|pay[ée]e?)\s*(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
            /carte\s*sim\s*(?:\/?\s*e?\s*sim\s*)?[\t ]*(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)\s*\(?[^)\n]{0,30}commande/gi,
        ];
        for (const pattern of directPatterns) {
            const matches = [...text.matchAll(pattern)];
            for (const m of matches) {
                const val = parseFloat(m[1].replace(',', '.'));
                if (val > 0 && val <= 50) { simPrice = val; break; }
            }
            if (simPrice !== null) break;
        }

        if (simPrice === null) {
            const lines = text.split('\n');
            const simParagraphs: string[] = [];

            for (let i = 0; i < lines.length; i++) {
                if (/carte\s*sim/i.test(lines[i])) {
                    let paragraph = lines[i];
                    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                        const next = lines[j].trim();
                        if (/^\(/i.test(next) || /^(?:ou|et|sur)\s/i.test(next) || (!next.match(/^[A-ZÀ-Ü]/) && next.length > 5)) {
                            paragraph += ' ' + next;
                        } else { break; }
                    }
                    simParagraphs.push(paragraph);
                }
            }

            const allSimPrices: { value: number; context: string }[] = [];
            for (const para of simParagraphs) {
                const priceRegex = /(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi;
                let m: RegExpExecArray | null;
                while ((m = priceRegex.exec(para)) !== null) {
                    const val = parseFloat(m[1].replace(',', '.'));
                    if (val >= 0 && val <= 50) {
                        const start = Math.max(0, m.index - 60);
                        const end = Math.min(para.length, m.index + m[0].length + 60);
                        allSimPrices.push({ value: val, context: para.substring(start, end) });
                    }
                }
            }

            if (allSimPrices.length > 0) {
                const onlinePrice = allSimPrices.find(p =>
                    !/(en\s*)?boutique/i.test(p.context) &&
                    !/bureau\s*de\s*poste/i.test(p.context) &&
                    /(?:en\s*ligne|[\w.]+\.fr|internet|site|hors\s*promotion)/i.test(p.context)
                );
                const nonStorePrice = allSimPrices.find(p =>
                    !/(en\s*)?boutique/i.test(p.context) &&
                    !/bureau\s*de\s*poste/i.test(p.context) &&
                    p.value > 0
                );
                const anyNonStore = allSimPrices.find(p =>
                    !/(en\s*)?boutique/i.test(p.context) &&
                    !/bureau\s*de\s*poste/i.test(p.context)
                );
                simPrice = onlinePrice?.value ?? nonStorePrice?.value ?? anyNonStore?.value ?? allSimPrices[allSimPrices.length - 1].value;
            }
        }

        if (simPrice === null) {
            const fallbackPatterns = [
                /sim\s*(?:triple\s*d[ée]coupe)?\s*[^€\d]{0,40}?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
                /(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)\s*[^.\n]{0,30}?(?:carte\s*sim|sim)/gi,
            ];
            for (const pattern of fallbackPatterns) {
                const match = pattern.exec(text);
                if (match) {
                    const val = parseFloat(match[1].replace(',', '.'));
                    if (val >= 0 && val <= 50) { simPrice = val; break; }
                }
            }
        }
    }

    return { cancellationPrice, activationPrice, simPrice };
}

/**
 * Télécharge un PDF et en extrait les frais. Retourne null en cas d'erreur.
 */
export async function fetchFeesFromPdf(pdfUrl: string, operatorName: string): Promise<PdfFees | null> {
    try {
        console.log(`[${operatorName}] Téléchargement du PDF : ${pdfUrl}`);
        const pdfText = await fetchPdfText(pdfUrl);
        const fees = extractFeesFromPdfText(pdfText, operatorName);
        console.log(`[${operatorName}] Frais extraits du PDF :`, JSON.stringify(fees));
        return fees;
    } catch (error) {
        console.warn(`[${operatorName}] Impossible de lire le PDF (${pdfUrl}):`, error);
        return null;
    }
}

/**
 * Détecte le prix de la carte SIM depuis le texte visible de la page.
 * Retourne le prix en euros ou null si non détecté.
 */
export function detectSimPriceFromText(bodyText: string): number | null {
    const text = bodyText.toLowerCase().replace(/\u00a0/g, ' ');

    if (/sim\s*gratuit/i.test(text) || /sim\s*offert/i.test(text) || /carte\s*sim.*?0[,.]?0{0,2}\s*€/i.test(text)) {
        return 0;
    }

    const simPatterns = [
        /carte\s*sim\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
        /activation\s*sim\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
        /sim\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
        /(\d+(?:[,.]\d{2})?)\s*€\s*(?:.*?)(?:carte\s*sim|activation\s*sim)/i,
        /frais\s*(?:d')?activation\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
    ];

    for (const pattern of simPatterns) {
        const match = text.match(pattern);
        if (match) {
            const price = parseFloat(match[1].replace(',', '.'));
            if (price >= 0 && price <= 50) return price;
        }
    }

    return null;
}

export interface CheckoutFees {
    simPrice: number | null;
    activationPrice: number | null;
}

/**
 * Tente de détecter le prix SIM et les frais d'activation en naviguant vers le checkout/panier.
 * Cherche un bouton "Commander"/"Souscrire"/"Choisir" sur la page, clique dessus,
 * puis lit les frais depuis la page de commande.
 */
export async function detectFeesFromCheckout(page: Page, operatorName: string): Promise<CheckoutFees> {
    const result: CheckoutFees = { simPrice: null, activationPrice: null };
    try {
        console.log(`[${operatorName}] Tentative de détection des frais via checkout...`);

        const keywords = [
            'j\'en profite', 'choisir ce forfait', 'je choisis', 'je commande', 'je souscris',
            'etape suivante', 'aller au panier', 'continuer', 'souscrire', 'commander',
            'ajouter au panier', 'acheter', 'selectionner', 'choisir'
        ];

        let clicked = await page.evaluate((kws) => {
            const excludeSelectors = 'nav, header, [role="navigation"]';
            const buttons = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="submit"]'))
                .filter(el => !el.closest(excludeSelectors));

            const excludeUrlKeywords = ['guide', 'faq', 'assistance', 'blog', 'forum', 'actualite', 'news'];

            for (const kw of kws) {
                for (const el of buttons) {
                    const originalText = (el.textContent || '').trim();
                    const text = originalText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                    if (originalText.length > 60) continue;

                    const href = (el.getAttribute('href') || '').toLowerCase();
                    if (excludeUrlKeywords.some(excludeKw => href.includes(excludeKw))) {
                        continue;
                    }

                    if (kw === 'choisir' && !(text === 'choisir' || text.startsWith('choisir '))) continue;

                    if (text.includes(kw)) {
                        console.log(`[CHECKOUT DEBUG] Simulated click on element with text: '${text}', matched keyword: '${kw}'`);
                        (el as HTMLElement).click();
                        return true;
                    }
                }
            }
            return false;
        }, keywords);

        if (clicked) {
            console.log(`[${operatorName}] Bouton checkout cliqué, attente du chargement...`);
            await new Promise(r => setTimeout(r, 5000));

            // Tentative d'un deuxième clic pour les checkouts en plusieurs étapes (ex: B&You options -> panier)
            const clicked2 = await page.evaluate((kws) => {
                const excludeSelectors = 'nav, header, [role="navigation"]';
                const buttons = Array.from(document.querySelectorAll('a, button, [role="button"]'))
                    .filter(el => !el.closest(excludeSelectors));
                const excludeUrlKeywords = ['guide', 'faq', 'assistance', 'blog', 'forum', 'actualite', 'news'];
                for (const kw of kws) {
                    for (const el of buttons) {
                        const originalText = (el.textContent || '').trim();
                        const text = originalText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                        if (originalText.length > 60) continue;
                        const href = (el.getAttribute('href') || '').toLowerCase();
                        if (excludeUrlKeywords.some(excludeKw => href.includes(excludeKw))) continue;
                        if (kw === 'choisir' && !(text === 'choisir' || text.startsWith('choisir '))) continue;
                        if (text.includes(kw)) {
                            console.log(`[CHECKOUT DEBUG] Simulated second click on element: '${text}'`);
                            (el as HTMLElement).click();
                            return true;
                        }
                    }
                }
                return false;
            }, keywords);

            if (clicked2) {
                console.log(`[${operatorName}] Deuxième bouton checkout cliqué, attente...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        } else {
            // Fallback: search for checkoutUrl
            const checkoutUrl = await page.evaluate((kws) => {
                const excludeSelectors = 'nav, header, [role="navigation"]';
                const links = Array.from(document.querySelectorAll('a[href]'))
                    .filter(el => !el.closest(excludeSelectors));

                const excludeUrlKeywords = ['guide', 'faq', 'assistance', 'blog', 'forum', 'actualite', 'news', 'telephone', 'smartphone', 'mobile/'];

                for (const kw of kws) {
                    for (const el of links) {
                        const originalText = (el.textContent || '').trim();
                        const text = originalText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                        if (originalText.length > 60) continue;
                        const href = (el.getAttribute('href') || '').toLowerCase();

                        if (excludeUrlKeywords.some(excludeKw => href.includes(excludeKw))) {
                            continue;
                        }

                        if (kw === 'choisir' && !(text === 'choisir' || text.startsWith('choisir '))) continue;

                        if (text.includes(kw) && href && !href.startsWith('javascript') && !href.startsWith('#')) {
                            try {
                                const finalUrl = new URL(href, window.location.origin).href;
                                console.log(`[CHECKOUT DEBUG] Matched keyword: '${kw}', Text: '${text}', Href: '${finalUrl}'`);
                                return finalUrl;
                            } catch { }
                        }
                    }
                }
                return null;
            }, keywords);

            if (checkoutUrl) {
                console.log(`[${operatorName}] Navigation checkout : ${checkoutUrl}`);
                await page.goto(checkoutUrl, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });
                await new Promise(r => setTimeout(r, 3000));
            } else {
                console.log(`[${operatorName}] Aucun bouton de commande trouvé.`);
                return result;
            }
        }

        console.log(`[${operatorName}] Page checkout active : ${page.url()}`);

        const fees = await page.evaluate(() => {
            const bodyLines = document.body.innerText.split('\n').filter(l => l.trim().length > 0 && l.trim().length < 300);
            const bodyText = bodyLines.join(' ').toLowerCase().replace(/\u00a0/g, ' ');

            let simPrice: number | null = null;
            if (/sim\s*gratuit/i.test(bodyText) || /sim\s*offert/i.test(bodyText)) {
                simPrice = 0;
            } else {
                const simPatterns = [
                    /carte\s*sim\s*(?:[\s\S]{0,40}?)(\d+(?:[,.]\d{2})?)\s*€/i,
                    /sim\s*(?:triple|nano|micro)?\s*(?:[\s\S]{0,20}?)(\d+(?:[,.]\d{2})?)\s*€/i,
                    /(\d+(?:[,.]\d{2})?)\s*€\s*(?:[\s\S]{0,20}?)(?:carte\s*sim|sim)/i,
                    /livraison\s*(?:[\s\S]{0,30}?)(\d+(?:[,.]\d{2})?)\s*€/i,
                    /frais\s*(?:de\s*)?(?:livraison|envoi)\s*(?:[\s\S]{0,20}?)(\d+(?:[,.]\d{2})?)\s*€/i,
                ];
                for (const pat of simPatterns) {
                    const m = bodyText.match(pat);
                    if (m) {
                        const price = parseFloat(m[1].replace(',', '.'));
                        if (price >= 0 && price <= 50) { simPrice = price; break; }
                    }
                }
                if (simPrice === null) {
                    const section = bodyText.match(/(?:récapitulatif|panier|commande|détail)[\s\S]{0,500}?sim[\s\S]{0,100}?(\d+(?:[,.]\d{2})?)\s*€/i);
                    if (section) {
                        const price = parseFloat(section[1].replace(',', '.'));
                        if (price >= 0 && price <= 50) simPrice = price;
                    }
                }
            }

            let activationPrice: number | null = null;
            const actPatterns = [
                /frais\s*(?:d['\u2019e]\s*)?activation\s*(?:[\s\S]{0,30}?)(\d+(?:[,.]\d{2})?)\s*€/i,
                /frais\s*(?:de\s*)?mise\s*en\s*service\s*(?:[\s\S]{0,30}?)(\d+(?:[,.]\d{2})?)\s*€/i,
                /frais\s*(?:de\s*)?souscription\s*(?:[\s\S]{0,30}?)(\d+(?:[,.]\d{2})?)\s*€/i,
                /activation\s*(?:[\s\S]{0,30}?)(\d+(?:[,.]\d{2})?)\s*€/i,
                /(\d+(?:[,.]\d{2})?)\s*€\s*(?:[\s\S]{0,20}?)(?:activation|mise\s*en\s*service|souscription)/i,
            ];
            if (/activation\s*gratuit/i.test(bodyText) || /frais\s*(?:d['\u2019e]\s*)?activation\s*offert/i.test(bodyText)) {
                activationPrice = 0;
            } else {
                for (const pat of actPatterns) {
                    const m = bodyText.match(pat);
                    if (m) {
                        // Skip if explicitly mentioned as offered/free (e.g. B&You 48€ mis en service offerts for Fiber)
                        const context = bodyText.substring(Math.max(0, m.index! - 20), Math.min(bodyText.length, m.index! + m[0].length + 20));
                        if (/offert|gratuit/i.test(context)) {
                            console.log(`[CHECKOUT DEBUG] Fee skipped (offered/free): ${m[0]}`);
                            continue;
                        }
                        const price = parseFloat(m[1].replace(',', '.'));
                        // Maximum reasonable activation fee for a French mobile plan is around 10-15€. 
                        // If it's 48€, it's a Bbox/Fiber cross-sell.
                        if (price >= 0 && price <= 20) { activationPrice = price; break; }
                    }
                }
            }

            return { simPrice, activationPrice };
        });

        if (fees.simPrice !== null) {
            console.log(`[${operatorName}] Prix SIM détecté via checkout : ${fees.simPrice}€`);
        }
        if (fees.activationPrice !== null) {
            console.log(`[${operatorName}] Frais d'activation détectés via checkout : ${fees.activationPrice}€`);
        }
        if (fees.simPrice === null && fees.activationPrice === null) {
            console.log(`[${operatorName}] Aucun frais trouvé dans le checkout.`);
        }

        return fees;
    } catch (error) {
        console.warn(`[${operatorName}] Erreur lors de la détection via checkout:`, error);
        return result;
    }
}
