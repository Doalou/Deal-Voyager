import type { ScraperConfig } from "./types";
import { extractFeesFromText } from './utils';

export const coriolisScrapeLogic: ScraperConfig["scrapeFunction"] = async (
  page,
) => {
  try {
    await new Promise((r) => setTimeout(r, 5000));

    try {
      const acceptBtn = await page.$(
        '#didomi-notice-agree-button, button[id*="accept"], #onetrust-accept-btn-handler',
      );
      if (acceptBtn) {
        await acceptBtn.click();
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {}

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 2000));

    // ─── Extraction frais via helper centralisé ───
    const pageText = await page.evaluate(() => (document.body.innerText || ''));
    const fees = extractFeesFromText(pageText);
    console.log(`[Coriolis] Frais extraits — SIM: ${fees.simPrice}€, activation: ${fees.activationPrice}€, résiliation: ${fees.cancellationPrice}€`);

    const plans = await page.evaluate(() => {
      const results: {
        planName: string;
        dataGb: number;
        price: number;
        calls: string;
        networkGeneration: string;
        dataEuGb: number;
      }[] = [];
      const bodyText = document.body.innerText;
      const lines = bodyText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // detect5G logic is inlined at each call site below to avoid
      // esbuild __name helper injection inside page.evaluate()

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match "Le [Nom] [optional offerte] XXX Go X€XX par mois" or split across lines
        // Pattern 1: single line "Le Basic 30 Go 4€99par mois"
        const singleLineMatch = line.match(
          /^(Le\s+\w+).*?(\d{1,4})\s*Go\s*(\d{1,3})€(\d{2})/i,
        );
        if (singleLineMatch) {
          const planName = singleLineMatch[1].trim();
          const dataGb = parseInt(singleLineMatch[2], 10);
          const price = parseFloat(
            `${singleLineMatch[3]}.${singleLineMatch[4]}`,
          );

          if (
            dataGb > 0 &&
            price > 0 &&
            price < 80 &&
            !results.some((r) => r.dataGb === dataGb)
          ) {
            let gen = "4G";
            for (
              let k = Math.max(0, i - 5);
              k < Math.min(lines.length, i + 30);
              k++
            ) {
              if (/\b5g\b/i.test(lines[k])) {
                gen = "5G";
                break;
              }
            }
            if (gen === "4G") {
              const rgx = new RegExp(`\\b${dataGb}\\s*Go`, "i");
              for (const el of Array.from(
                document.querySelectorAll(
                  "h1,h2,h3,h4,h5,span,p,div,label,a,li,strong,b",
                ),
              )) {
                const t = (el.textContent || "").trim();
                if (t.length < 3 || t.length > 100) continue;
                if (rgx.test(t) && /\b5g\b/i.test(t)) {
                  gen = "5G";
                  break;
                }
              }
            }
            if (gen === "4G") {
              const rgx = new RegExp(`\\b${dataGb}\\s*Go`, "i");
              for (const img of Array.from(document.querySelectorAll("img"))) {
                if (
                  !/5g/i.test(
                    `${img.getAttribute("alt") || ""} ${img.getAttribute("src") || ""}`,
                  )
                )
                  continue;
                let p: Element | null = img.parentElement;
                for (let d = 0; d < 8 && p; d++, p = p.parentElement) {
                  if (
                    (p.textContent || "").length < 300 &&
                    rgx.test(p.textContent || "")
                  ) {
                    gen = "5G";
                    break;
                  }
                }
                if (gen === "5G") break;
              }
            }

            let euGb = 0;
            for (let j = i; j < Math.min(lines.length, i + 20); j++) {
              const euMatch = lines[j].match(
                /\+?\s*(\d{1,3})\s*[Gg]o\s*(?:depuis|en|utilisables?)?\s*(?:l')?(?:europ|UE|DOM)/i,
              );
              if (euMatch) {
                euGb = parseInt(euMatch[1], 10);
                break;
              }
              const euMatch2 = lines[j].match(
                /(?:europ|UE|DOM)\D*(\d{1,3})\s*[Gg]o/i,
              );
              if (euMatch2) {
                euGb = parseInt(euMatch2[1], 10);
                break;
              }
            }

            results.push({
              planName: `Coriolis ${planName} ${dataGb >= 1 ? dataGb + " Go" : dataGb * 1000 + " Mo"}`,
              dataGb,
              price,
              calls: "Illimités",
              networkGeneration: gen,
              dataEuGb: euGb,
            });
          }
          continue;
        }

        // Pattern 2: data on one line, price on another
        const dataMatch = line.match(/^(\d{1,4})\s*Go$/i);
        if (dataMatch) {
          const dataGb = parseInt(dataMatch[1], 10);
          if (dataGb <= 0 || dataGb > 1000) continue;

          let planName = "";
          for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
            if (/^Le\s+\w+/i.test(lines[j]) || /^Forfait\s+/i.test(lines[j])) {
              planName = lines[j].replace(/offerte/i, "").trim();
              break;
            }
          }
          if (!planName) continue; // Ignore loose GB data without a valid plan name above

          let price = 0;
          for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
            const priceMatch = lines[j].match(/(\d{1,3})€(\d{2})/);
            if (priceMatch) {
              price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
              break;
            }
            const priceMatch2 = lines[j].match(/(\d{1,3})[,.](\d{2})\s*€/);
            if (priceMatch2) {
              price = parseFloat(`${priceMatch2[1]}.${priceMatch2[2]}`);
              break;
            }
          }

          if (
            price > 0 &&
            price < 80 &&
            !results.some((r) => r.dataGb === dataGb)
          ) {
            let gen = "4G";
            for (
              let k = Math.max(0, i - 5);
              k < Math.min(lines.length, i + 30);
              k++
            ) {
              if (/\b5g\b/i.test(lines[k])) {
                gen = "5G";
                break;
              }
            }
            if (gen === "4G") {
              const rgx = new RegExp(`\\b${dataGb}\\s*Go`, "i");
              for (const el of Array.from(
                document.querySelectorAll(
                  "h1,h2,h3,h4,h5,span,p,div,label,a,li,strong,b",
                ),
              )) {
                const t = (el.textContent || "").trim();
                if (t.length < 3 || t.length > 100) continue;
                if (rgx.test(t) && /\b5g\b/i.test(t)) {
                  gen = "5G";
                  break;
                }
              }
            }
            if (gen === "4G") {
              const rgx = new RegExp(`\\b${dataGb}\\s*Go`, "i");
              for (const img of Array.from(document.querySelectorAll("img"))) {
                if (
                  !/5g/i.test(
                    `${img.getAttribute("alt") || ""} ${img.getAttribute("src") || ""}`,
                  )
                )
                  continue;
                let p: Element | null = img.parentElement;
                for (let d = 0; d < 8 && p; d++, p = p.parentElement) {
                  if (
                    (p.textContent || "").length < 300 &&
                    rgx.test(p.textContent || "")
                  ) {
                    gen = "5G";
                    break;
                  }
                }
                if (gen === "5G") break;
              }
            }

            let euGb = 0;
            for (let j = i; j < Math.min(lines.length, i + 20); j++) {
              const euMatch = lines[j].match(
                /\+?\s*(\d{1,3})\s*[Gg]o\s*(?:depuis|en|utilisables?)?\s*(?:l')?(?:europ|UE|DOM)/i,
              );
              if (euMatch) {
                euGb = parseInt(euMatch[1], 10);
                break;
              }
              const euMatch2 = lines[j].match(
                /(?:europ|UE|DOM)\D*(\d{1,3})\s*[Gg]o/i,
              );
              if (euMatch2) {
                euGb = parseInt(euMatch2[1], 10);
                break;
              }
            }

            results.push({
              planName: planName
                ? `Coriolis ${planName} ${dataGb >= 1 ? dataGb + " Go" : dataGb * 1000 + " Mo"}`
                : `Coriolis ${dataGb >= 1 ? dataGb + " Go" : dataGb * 1000 + " Mo"}`,
              dataGb,
              price,
              calls: "Illimités",
              networkGeneration: gen,
              dataEuGb: euGb,
            });
          }
        }
      }

      // Coriolis dedup step: prevent picking up same plan mixed with lower roaming GBs.
      // If two extracted plans have the same price, we only keep the one with the highest data.
      const plansByPrice = new Map<string, typeof results[0]>();
      for (const p of results) {
        // Group by price; round mathematically to avoid floating point hash issues
        const pKey = `${Math.round(p.price * 100)}`;
        const existing = plansByPrice.get(pKey);
        // Compare dataGb to filter out fake "10 Go" from the same page if we already caught "100 Go" at same price
        if (!existing || p.dataGb > existing.dataGb) {
          plansByPrice.set(pKey, p);
        }
      }

      return Array.from(plansByPrice.values());
    });

    return plans
      .filter((p) => p.price > 0 && p.dataGb > 0)
      .map((plan) => ({
        planName: plan.planName,
        dataGb: plan.dataGb,
        price: plan.price,
        calls: plan.calls,
        operator: "Coriolis",
        network: "SFR",
        networkGeneration: plan.networkGeneration,
        dataEuGb: plan.dataEuGb || undefined,
        simPrice: fees.simPrice ?? undefined,
        activationPrice: fees.activationPrice ?? undefined,
        cancellationPrice: fees.cancellationPrice ?? undefined,
      }));
  } catch (error) {
    console.error("Erreur dans la collecte Coriolis:", error);
    return [];
  }
};
