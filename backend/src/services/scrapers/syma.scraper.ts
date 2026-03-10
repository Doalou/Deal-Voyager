import type { ScraperConfig, ScrapedPlan } from "./types";

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

      items.forEach((item) => {
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

        // Frais d'activation
        const fraisAmountEl = item.querySelector(
          "#frais_amount, .frais_amount",
        );
        if (fraisAmountEl && fraisAmountEl.textContent) {
          p.activationPrice = parseFloat(
            fraisAmountEl.textContent.replace(/[^\d,.]/g, "").replace(",", "."),
          );
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
      });

      // Si des plan manquent le EU Data ou le name, on peut chercher globalement par fallback
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

      const bodyLines = document.body.innerText
        .split("\n")
        .filter((l) => l.trim().length > 0 && l.trim().length < 300);
      const bodyText = bodyLines.join(" ").toLowerCase();
      let globalActivation: number | null = null;
      const actMatch = bodyText.match(
        /frais\s*d['\u2019]?\s*activation\s*(?::|\u00e0)?\s*(\d+(?:[,.]\d{1,2})?)\s*€/i,
      );
      if (actMatch)
        globalActivation = parseFloat(actMatch[1].replace(",", "."));

      let globalSim: number | null = null;
      if (/sim\s*gratuit/i.test(bodyText) || /sim\s*offert/i.test(bodyText)) {
        globalSim = 0;
      } else {
        const sps = [
          /carte\s*sim\s*(?:à|a|:)?\s*(\d+(?:[,.]\d{2})?)\s*€/i,
          /(\d+(?:[,.]\d{2})?)\s*€[^\n]{0,30}(?:carte\s*sim)/i,
        ];
        for (const pat of sps) {
          const m = bodyText.match(pat);
          if (m) {
            globalSim = parseFloat(m[1].replace(",", "."));
            break;
          }
        }
      }

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
        simPrice: globalSim,
        activationPrice: p.activationPrice ?? globalActivation,
        cancellationPrice: null, // sans engagement, pas de frais de résiliation affichés
      }));
    });

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
    }));
  } catch (error) {
    console.error("Erreur dans la collecte Syma Mobile:", error);
    return [];
  }
};
