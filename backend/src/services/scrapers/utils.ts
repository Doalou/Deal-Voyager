import type { Page } from 'playwright';
import { load } from 'cheerio';
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
    const rawText = pdfText
        .toLowerCase()
        .replace(/[\u00a0\u202f]/g, ' ')
        .replace(/[\u2018\u2019]/g, "'");
    const text = operatorName ? narrowToOperatorSection(rawText, operatorName) : rawText;

    let cancellationPrice: number | null = null;
    if (/(?:sans\s+frais\s+de\s+r[ée]siliation|r[ée]siliation\s+gratuite?)/i.test(text)) cancellationPrice = 0;
    const cancelPatterns = [
        /frais\s*(?:de\s*)?r[ée]siliation\s*[^€\d\n]{0,40}(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
        /frais\s*(?:de\s*)?fermeture\s*[^€\d\n]{0,40}(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
    ];
    for (const pattern of cancelPatterns) {
        const match = pattern.exec(text);
        if (match) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (val >= 0 && val <= 20) { cancellationPrice = val; break; }
        }
    }

    let activationPrice: number | null = null;
    const activationPatterns = [
        /frais\s*(?:d[''e]\s*)?activation\s*[^€\d\n]{0,40}(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
        /frais\s*(?:de\s*)?mise\s*en\s*service\s*[^€\d\n]{0,40}(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
        /frais\s*(?:de\s*)?souscription\s*[^€\d\n]{0,40}(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
    ];
    for (const pattern of activationPatterns) {
        const match = pattern.exec(text);
        if (match) {
            const val = parseFloat(match[1].replace(',', '.'));
            if (val >= 0 && val <= 20) { activationPrice = val; break; }
        }
    }

    let simPrice: number | null = null;
    if (/carte?\s*sim\s*(?:est\s*)?gratuit/i.test(text) || /sim\s*offert/i.test(text)) {
        simPrice = 0;
    } else {
        const directPatterns = [
            /(?:carte\s*)?sim\s*(?:\/?\s*e?\s*sim\s*)?(?:est\s*)?(?:factur[ée]e?|co[uû]te?|pay[ée]e?|au\s+prix\s+de|[:àa])\s*(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
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

    if (simPrice != null && simPrice > 0 && !/(?:prix|frais|co[uû]t)?\s*(?:de\s+la\s+)?(?:carte\s*)?sim(?:\s*\/\s*e?sim)?\s*(?:est\s*)?(?:factur[ée]e?|co[uû]te?|pay[ée]e?|au\s+prix\s+de|[:àa])\s*\d+(?:[,.]\d{1,2})?\s*(?:€|euros?)/i.test(text)) {
        simPrice = null;
    }

    return { cancellationPrice, activationPrice, simPrice };
}

/**
 * Interface pour les frais extraits d'une page web.
 */
export interface PageFees {
    simPrice: number | null;
    activationPrice: number | null;
    cancellationPrice: number | null;
}

export function extractVisibleTextFromHtml(html: string): string {
    const $ = load(html);
    $('script, style, noscript, template, [hidden], [aria-hidden="true"], [style*="display:none"], [style*="display: none"]').remove();
    $('br').replaceWith('\n');
    $('h1, h2, h3, h4, h5, h6, p, li, article, section, button, a, label, td, th').each((_, element) => {
        $(element).prepend('\n').append('\n');
    });
    return $('body').text()
        .replace(/\u00a0|\u202f/g, ' ')
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
}

/**
 * Extrait les frais (SIM, activation, résiliation) depuis le texte brut d'une page web.
 * Fonction centralisée utilisée par tous les scrapers pour éviter la duplication.
 *
 * Plafonds anti-faux-positifs :
 *  - SIM : 0-30€
 *  - Activation : 0-20€ (évite les frais Fibre ~48€)
 *  - Résiliation : 0-20€ (évite les frais Fibre ~69€)
 */
export function extractFeesFromText(rawText: string): PageFees {
    // Normalisation unicode complète
    const text = rawText
        .replace(/[\u00a0\u202f]/g, ' ')  // espaces insécables
        .replace(/\u2019/g, "'")  // right single quote → apostrophe
        .replace(/\u2018/g, "'")  // left single quote → apostrophe
        .replace(/\u20ac/g, '€')  // euro sign
        .replace(/\u2013/g, '-')  // en-dash
        .replace(/\u2014/g, '-')  // em-dash
        .toLowerCase();

    let simPrice: number | null = null;
    let activationPrice: number | null = null;
    let cancellationPrice: number | null = null;

    // ─── SIM price ───
    if (/(?:carte\s*)?(?:sim(?:\s*\/\s*e?sim)?|e-?sim)[^.;\n]{0,50}(?:gratuite?s?|offerte?s?|incluse?s?)/i.test(text)) {
        simPrice = 0;
    } else {
        const simPatterns = [
            /(?:prix|frais|co[uû]t)?\s*(?:de\s+la\s+)?(?:carte\s*)?(?:sim(?:\s*\/\s*e?sim)?|e-?sim)\s*(?:est\s*)?(?:factur[ée]e?|co[uû]te?|pay[ée]e?|au\s+prix\s+de|[:àa])\s*(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
            /(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)[^.;\n]{0,40}(?:pour\s+)?(?:la\s+)?(?:carte\s*)?(?:sim|e-?sim)\b/gi,
        ];
        for (const pat of simPatterns) {
            let m;
            while ((m = pat.exec(text)) !== null) {
                const val = parseFloat(m[1].replace(',', '.'));
                if (val >= 0 && val <= 30) { simPrice = val; break; }
            }
            if (simPrice !== null) break;
        }
    }

    // ─── Activation price ───
    if (/(?:aucuns?\s+|sans\s+)?frais\s*(?:d['e]\s*)?activation\s*(?:sont\s*)?(?:gratuits?|offerts?)/i.test(text) ||
        /activation\s*(?:gratuite?|offerte?)/i.test(text)) {
        activationPrice = 0;
    } else {
        const actPatterns = [
            /frais\s*d['e]\s*activation\s*(?:[àa:]\s*)?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
            /frais\s*(?:de\s*)?mise\s*en\s*service\s*(?:[àa:]\s*)?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
            /frais\s*(?:de\s*)?souscription\s*(?:[àa:]\s*)?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
            /activation\s*(?:[àa:]\s*)?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
        ];
        for (const pat of actPatterns) {
            let m;
            while ((m = pat.exec(text)) !== null) {
                const val = parseFloat(m[1].replace(',', '.'));
                // Plafonné à 20€ pour éviter les frais Fibre/Bbox (48€)
                if (val >= 0 && val <= 20) { activationPrice = val; break; }
            }
            if (activationPrice !== null) break;
        }
    }

    // ─── Cancellation price ───
    if (/sans\s*engagement/i.test(text) || /r[ée]siliation\s*(?:gratuit|offert)/i.test(text)) {
        cancellationPrice = 0;
    }
    // Même si "sans engagement" est trouvé, on cherche quand même un prix explicite
    // qui l'emporterait (ex: "sans engagement, frais de résiliation : 5€")
    const cancelPatterns = [
        /frais\s*(?:de\s*)?r[ée]siliation\s*(?:[àa:]\s*)?(\d+(?:[,.]\d{1,2})?)\s*(?:€|euros?)/gi,
    ];
    for (const pat of cancelPatterns) {
        let m;
        while ((m = pat.exec(text)) !== null) {
            const val = parseFloat(m[1].replace(',', '.'));
            // Plafonné à 20€ pour éviter les frais Fibre (69€)
            if (val >= 0 && val <= 20) { cancellationPrice = val; break; }
        }
        if (cancellationPrice !== null && cancellationPrice > 0) break;
    }

    return { simPrice, activationPrice, cancellationPrice };
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

export async function fetchFeesFromWebPage(url: string, operatorName: string): Promise<PageFees | null> {
    try {
        console.log(`[${operatorName}] Lecture de la page tarifaire : ${url}`);
        const response = await fetch(url, {
            headers: { 'accept-language': 'fr-FR,fr;q=0.9', 'user-agent': 'Mozilla/5.0 Deal-Voyager/2.3.2' },
            signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const fees = extractFeesFromText(extractVisibleTextFromHtml(await response.text()));
        console.log(`[${operatorName}] Frais extraits de la page tarifaire :`, JSON.stringify(fees));
        return fees;
    } catch (error) {
        console.warn(`[${operatorName}] Impossible de lire la page tarifaire (${url}):`, error);
        return null;
    }
}

const CHECKOUT_LABEL_PATTERN = /(?:j['’]?en\s+profite|souscri|command|ajouter\s+au\s+panier|acheter|sélectionner)/i;
const CHECKOUT_URL_EXCLUSION_PATTERN = /(?:auth|login|connexion|account|(?:^|[./_-])client(?:[./_-]|$)|espace[-_/]?client|assistance|faq|forum|blog|actualit|smartphone|telephone|choisir[-_/]son[-_/]forfait)/i;

export function extractCheckoutCandidateUrls(
    pageUrl: string,
    links: readonly { href: string; text: string }[],
): string[] {
    const candidates = new Set<string>();
    for (const link of links) {
        if (!CHECKOUT_LABEL_PATTERN.test(link.text) || CHECKOUT_URL_EXCLUSION_PATTERN.test(link.href)) continue;
        try {
            const url = new URL(link.href, pageUrl);
            if (!/^https?:$/.test(url.protocol)) continue;
            candidates.add(url.href);
        } catch { }
    }
    return [...candidates];
}

export function extractTariffPdfUrl(
    pageUrl: string,
    links: readonly { href: string; text: string }[],
): string | null {
    for (const link of links) {
        if (!/(?:brochure|guide|tarif|prix|r[ée]capitulatif\s+contractuel|contract[-_ ]?summary|conditions?\s+g[ée]n[ée]rales?|cgs)/i.test(`${link.text} ${link.href}`)) continue;
        try {
            const url = new URL(link.href, pageUrl);
            if (/\.pdf(?:$|[?#])/i.test(url.href)) return url.href;
        } catch { }
    }
    return null;
}

/**
 * Extrait uniquement les frais explicitement libellés dans un panier.
 * En particulier, "activation SIM : 10 €" désigne généralement le prix de
 * la carte et ne doit pas être dupliqué dans les frais d'activation.
 */
export function extractCheckoutFeesFromText(rawText: string): CheckoutFees {
    const text = rawText
        .replace(/[\u00a0\u202f]/g, ' ')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\s+/g, ' ')
        .toLowerCase();

    const readPrice = (patterns: RegExp[], maximum: number): number | null => {
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (!match) continue;
            const price = Number.parseFloat(match[1].replace(',', '.'));
            if (Number.isFinite(price) && price >= 0 && price <= maximum) return price;
        }
        return null;
    };

    let simPrice = /(?:carte\s*)?sim[^.;]{0,35}(?:gratuite?|offerte?|incluse?)/i.test(text) ? 0 : readPrice([
        /(?:frais\s*(?:de\s*)?|co[uû]t\s*(?:de\s*)?)?carte\s*sim\b(?:(?!frais|activation)[^€\d]){0,40}(\d+(?:[,.]\d{1,2})?)\s*€/i,
        /activation\s+(?:de\s+la\s+)?sim\b[^€\d]{0,30}(\d+(?:[,.]\d{1,2})?)\s*€/i,
        /frais\s*(?:de\s*)?(?:livraison|envoi)\b[^€\d]{0,30}(\d+(?:[,.]\d{1,2})?)\s*€/i,
    ], 50);

    const activationIsFree = /(?:frais\s*(?:d['e]\s*)?activation|frais\s*(?:de\s*)?(?:mise\s*en\s*service|souscription))\s*(?:sont\s*)?(?:gratuits?|offerts?)/i.test(text);
    const activationPrice = activationIsFree ? 0 : readPrice([
        /frais\s*(?:d['e]\s*)?activation\b(?!\s+(?:de\s+la\s+)?sim\b)[^€\d]{0,30}(\d+(?:[,.]\d{1,2})?)\s*€/i,
        /frais\s*(?:de\s*)?mise\s*en\s*service\b[^€\d]{0,30}(\d+(?:[,.]\d{1,2})?)\s*€/i,
        /frais\s*(?:de\s*)?souscription\b[^€\d]{0,30}(\d+(?:[,.]\d{1,2})?)\s*€/i,
    ], 20);

    return { simPrice, activationPrice };
}

/**
 * Tente de détecter le prix SIM et les frais d'activation en naviguant vers le checkout/panier.
 * Cherche un bouton "Commander"/"Souscrire"/"Choisir" sur la page, clique dessus,
 * puis lit les frais depuis la page de commande.
 */
export async function detectFeesFromCheckout(
    page: Page,
    operatorName: string,
    candidateUrls: readonly string[] = [],
): Promise<CheckoutFees> {
    const result: CheckoutFees = { simPrice: null, activationPrice: null };
    try {
        console.log(`[${operatorName}] Tentative de détection des frais via checkout...`);

        if (candidateUrls.length > 0) {
            for (const candidateUrl of candidateUrls.slice(0, 4)) {
                console.log(`[${operatorName}] Ouverture du lien de souscription détecté : ${candidateUrl}`);
                await page.goto(candidateUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => undefined);
                await new Promise(r => setTimeout(r, 2500));
                const candidateText = await page.evaluate(() => document.body?.innerText ?? '');
                const candidateFees = extractCheckoutFeesFromText(candidateText);
                result.simPrice ??= candidateFees.simPrice;
                result.activationPrice ??= candidateFees.activationPrice;
                if (result.simPrice !== null && result.activationPrice !== null) break;
            }
        }

        const keywords = [
            'j\'en profite', 'choisir ce forfait', 'je choisis', 'je commande', 'je souscris',
            'etape suivante', 'aller au panier', 'continuer', 'souscrire', 'commander',
            'ajouter au panier', 'acheter', 'selectionner', 'choisir'
        ];

        let clicked = await page.evaluate((kws) => {
            const excludeSelectors = 'nav, header, [role="navigation"]';
            const buttons = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="submit"]'))
                .filter(el => !el.closest(excludeSelectors));

            const excludeUrlKeywords = ['guide', 'faq', 'assistance', 'blog', 'forum', 'actualite', 'news', 'auth', 'login', 'connexion', 'account', 'espace-client'];

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
                const excludeUrlKeywords = ['guide', 'faq', 'assistance', 'blog', 'forum', 'actualite', 'news', 'auth', 'login', 'connexion', 'account', 'espace-client'];
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

                const excludeUrlKeywords = ['guide', 'faq', 'assistance', 'blog', 'forum', 'actualite', 'news', 'telephone', 'smartphone', 'mobile/', 'auth', 'login', 'connexion', 'account', 'espace-client'];

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
                await page.goto(checkoutUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => { });
                await new Promise(r => setTimeout(r, 3000));
            } else {
                console.log(`[${operatorName}] Aucun bouton de commande trouvé.`);
                return result;
            }
        }

        console.log(`[${operatorName}] Page checkout active : ${page.url()}`);

        const checkoutText = await page.evaluate(() => document.body?.innerText ?? '');
        const fees = extractCheckoutFeesFromText(checkoutText);
        fees.simPrice ??= result.simPrice;
        fees.activationPrice ??= result.activationPrice;

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
