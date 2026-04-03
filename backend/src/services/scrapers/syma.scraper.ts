import type { ScraperConfig, ScrapedPlan } from "./types";
import { extractFeesFromText } from "./utils";

export const symaMobileScrapeLogic: ScraperConfig["scrapeFunction"] = async (
  page,
) => {
  try {
    await new Promise((r) => setTimeout(r, 6000));

    // Accept Cookies
    try {
      const acceptBtn = await page.$(
        '#didomi-notice-agree-button, button[id*="accept"], button[class*="accept"], #onetrust-accept-btn-handler, .cc-accept',
      );
      if (acceptBtn) await acceptBtn.click();
      await new Promise((r) => setTimeout(r, 1500));
    } catch (_) {}

    // Scroll pour charger toutes les images et layouts
    for (let s = 0; s < 3; s++) {
      await page.evaluate(
        (step) =>
          window.scrollTo(0, (step + 1) * (document.body.scrollHeight / 3)),
        s,
      );
      await new Promise((r) => setTimeout(r, 2000));
    }
    await new Promise((r) => setTimeout(r, 3000));

    const plans = await page.evaluate(() => {
      const planMap = new Map<string, any>();

      // Les éléments forfaits_top_list_item contiennent les infos de base
      const items = document.querySelectorAll(
        '.forfaits_top_list_item, .forfait-card, [class*="offre_"]',
      );

      for (const item of Array.from(items)) {
        const idProduct =
          item.getAttribute("data-id_product") ||
          item.getAttribute("data-product-id") ||
          Math.random().toString();

        if (!planMap.has(idProduct)) {
          planMap.set(idProduct, {
            id_product: idProduct,
            name: "",
            dataGb: 0,
            price: 0,
            is5G: false,
            euGb: 0,
            activationPrice: null,
          });
        }
        const p = planMap.get(idProduct);

        // Name
        const planNameEl = item.querySelector(".nickname_main");
        if (planNameEl && planNameEl.textContent) {
          p.name = planNameEl.textContent.trim();
        }

        // Data GB
        const dataValEl = item.querySelector(".value_for_renewable");
        if (dataValEl && dataValEl.textContent) {
          const m = dataValEl.textContent.match(/(\d{2,4})\s*Go/i);
          if (m) {
            p.dataGb = parseInt(m[1], 10);
          } else {
            const m2 = dataValEl.textContent.match(/(\d{2,4})/);
            if (m2) p.dataGb = parseInt(m2[1], 10);
          }
        }

        // Price
        const priceAttr = item.getAttribute("data-price");
        if (priceAttr && parseFloat(priceAttr) > 0) {
          p.price = parseFloat(priceAttr);
        } else {
          // fallbacks price
          const priceMainEl = item.querySelector(".price_main");
          const priceCentsEl = item.querySelector(".price_cents");
          if (priceMainEl && priceCentsEl) {
            const rawPrice =
              priceMainEl.textContent!.trim() +
              "." +
              priceCentsEl.textContent!.replace(/[^\d]/g, "");
            p.price = parseFloat(rawPrice);
          }
        }

        // 5G
        const genEl = item.querySelector(".forfaits_top_list_item_title_5G");
        const has5gClass =
          item.classList.contains("_is_5G") ||
          item.innerHTML.toLowerCase().includes("5g");
        if (genEl || has5gClass) {
          p.is5G = true;
        }

        // EU Data from detail item
        const detailEl = document.querySelector(
          `.forfait_detail_element_wrapper[data-id_product="${idProduct}"]`,
        );
        if (detailEl) {
          const detailText = detailEl.textContent || "";
          const euMatch = detailText.match(/(\d{1,3})\s*Go.*?(europ|ue|dom)/i);
          if (euMatch) {
            const val = parseInt(euMatch[1], 10);
            // On sécurise pour ne pas prendre la data principale
            if (val > 0 && (p.dataGb === 0 || val < p.dataGb)) {
              p.euGb = val;
            }
          }
        }
      }

      // Si des plans manquent le EU Data ou le name, on peut chercher globalement par fallback
      const finalPlans = Array.from(planMap.values()).filter(
        (p) => p.price > 0,
      );

      // Fallback EU Data parsing from big comparison table
      finalPlans.forEach((p) => {
        if (p.euGb === 0 && p.dataGb > 0) {
          const allText = document.body.innerText;
          const lines = allText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`${p.dataGb} Go`)) {
              for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
                const euM = lines[j].match(/^(\d{1,3})\s*Go$/);
                if (euM && parseInt(euM[1]) < p.dataGb) {
                  p.euGb = parseInt(euM[1]);
                  break;
                }
              }
              if (p.euGb > 0) break;
            }
          }
        }
      });

      return finalPlans.map((p: any) => ({
        planName:
          `Forfait Syma Mobile ` +
          (p.name
            ? `le ${p.name}`
            : `${p.dataGb >= 1 ? p.dataGb + " Go" : p.dataGb * 1000 + " Mo"}`),
        dataGb: p.dataGb,
        price: p.price,
        calls: "Illimités",
        networkGeneration: p.is5G ? "5G" : "4G",
        dataEuGb: p.euGb,
        simPrice: null,
        activationPrice: null,
        cancellationPrice: null,
      }));
    });

    // Extraction des frais dans un texte ciblé mobile (on exclut options/recharges et footer marketing)
    const feesText = await page.evaluate(() => {
      const lines = (document.body.innerText || "")
        .replace(/\u00a0/g, " ")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && l.length < 260);

      const kept: string[] = [];
      for (const line of lines) {
        const lower = line.toLowerCase();
        if (/ajouter\s*\d+\s*€|retirer|options|recharge|international/i.test(lower)) {
          continue;
        }
        if (
          /sim|esim|frais|activation|mise en service|resiliation|résiliation|sans engagement|brochure tarifaire|recapitulatif contractuel|récapitulatif contractuel/i.test(
            lower,
          )
        ) {
          kept.push(line);
        }
      }

      return kept.join("\n");
    });

    const fees = extractFeesFromText(feesText);

    // Filtrer les forfaits non valides (ex: dataGb inexistant)
    const validPlans = plans.filter((p: any) => p.dataGb > 0 && p.price > 0);

    console.log(
      `[Syma Mobile] Plans trouvés et validés : ${validPlans.length}`,
    );

    if (validPlans.length === 0) {
      const debugText = await page.evaluate(() => {
        const text = document.body.innerText || "";
        return text
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .slice(0, 60)
          .join("\n");
      });
      console.log(`[Syma Mobile] DEBUG — Premiers 60 lignes:\n${debugText}`);
    }

    return validPlans.map((plan: any) => ({
      ...plan,
      operator: "Syma Mobile",
      network: "SFR",
      simPrice: fees.simPrice ?? undefined,
      activationPrice: fees.activationPrice ?? undefined,
      cancellationPrice: fees.cancellationPrice ?? undefined,
    }));
  } catch (error) {
    console.error("Erreur dans la collecte Syma Mobile:", error);
    return [];
  }
};
