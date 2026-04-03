# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

## [Unreleased]

### 🔜 À surveiller

- **B&You — frais promotionnels** — Les frais B&You (SIM 1€, activation 1€) sont des promos qui changent régulièrement. L'extraction dépend du contenu des mentions légales visibles.
- **Lycamobile — antibot** — Contournements anti-détection ajoutés mais l'antibot Lycamobile reste agressif. À surveiller en production.

---

## [2.1.0] — 2026-04-03

### 🔧 Rework — Scrapers v2.0 & détection des frais

- **Free Mobile — rework complet + détection du Forfait Free Max** — Réécriture totale du scraper Free Mobile. Le site utilise un système d'onglets (« Forfait 2€ » / « Forfaits 5G/5G+ ») que le scraper navigue maintenant dynamiquement. Détection du nouveau **Forfait Free Max** (data illimitée 5G+, 29,99€/mois) qui était invisible pour l'ancien scraper car le heading affiche « illimité » au lieu d'un nombre de Go. Le **Forfait Free 5G+** (350 Go, 19,99€), la **Série Free** (150 Go, 9,99€) et le **Forfait 2€** (1 Go, 2€) sont tous correctement extraits. Gestion du format de prix splitté Free (ex: `29` sur une ligne + `€99` sur la suivante). Utilise `extractFeesFromText` pour les frais (SIM 10€, activation 0€, résiliation 0€).
- **Free Mobile — fin de la confusion Forfait 2€ / Série Free** — Réécriture de la stratégie de navigation : découverte dynamique des liens `/fiche-forfait-*` depuis la page d'accueil puis navigation dédiée vers chaque fiche forfait. Élimine la confusion causée par la lecture du `body.innerText` global qui mélangeait les données de tous les forfaits.
- **Détection des frais centralisée (`extractFeesFromText`)** — Nouvelle fonction pure dans `utils.ts` qui centralise toute la logique d'extraction des frais (SIM, activation, résiliation) depuis le texte brut d'une page. Élimine la duplication massive de code de regex entre les scrapers. Inclut des plafonds anti-faux-positifs (activation ≤ 20€, résiliation ≤ 20€) pour empêcher les frais Fibre/Bbox (48€ mise en service, 69€ résiliation) de contaminer les forfaits mobiles.
- **Coriolis — extraction des frais centralisée** — Remplacement de l'extraction inline des frais (60+ lignes de regex dupliquées dans `page.evaluate()`) par `extractFeesFromText()` centralisé. Les frais sont maintenant extraits côté Node.js et injectés dans chaque plan retourné.
- **La Poste Mobile — scraper réécrit** — URL corrigée (`/offres-mobiles/forfaits-sans-engagement` au lieu de `/offres/forfaits-sans-engagement`). Scraper entièrement réécrit avec `extractFeesFromText()`, ouverture des mentions légales, et parsing adapté au nouveau format du site.
- **B&You — rework complet (595 → 220 lignes)** — Réécriture totale du scraper. Sélecteurs CSS mis à jour (`button.is-label-check` au lieu de `label.radio-label`). Suppression de la double extraction des frais (pré-extraction mentions légales + re-détection par forfait) au profit d'une seule passe via le helper centralisé après ouverture de la modale Mentions Légales. Détection prix par sticky bar → font-size → regex body.
- **Akeo Telecom — prix sans engagement uniquement** — Le scraper ne prenait pas correctement le prix sans engagement. Filtrage strict sur le pattern « ou XX,XX€/mois » pour ignorer les prix engagement 12 mois. Ajout de la détection des frais via `extractFeesFromText`.
- **France Téléphone — fin du hardcodage 0€** — Le scraper initialisait `activationPrice = 0` et `cancellationPrice = 0` en dur, ce qui empêchait le fallback PDF de se déclencher. Remplacé par `extractFeesFromText` avec filtrage contextuel des offres fixes (Bleufix).
- **Nordnet — clic séquentiel des onglets + isolation du panel actif** — Le site utilise des onglets (1 Go, 30 Go, 70 Go, 100 Go, 150 Go) qu'il faut cliquer pour voir le prix. Le scraper clique désormais sur chaque onglet et lit le prix depuis le `tabpanel` actif uniquement (via `aria-hidden`, `aria-selected`, CSS visibility) au lieu du body entier. Fallback textuel conservé. Ajout de la détection des frais via `extractFeesFromText`.
- **Prixtel — détection de l'offre Oxygène** — Ajout du pattern « Oxygène » et « Série spéciale » à la détection des noms de forfaits. L'offre phare (120-160 Go, 5G gratuite, 6,99€) n'était pas détectée. Ajout de la détection des frais via `extractFeesFromText`.
- **TeleCoop — frais enfin détectés** — Le scraper ne retournait aucun frais (SIM, activation, résiliation). Ajout de `extractFeesFromText` et parsing amélioré du forfait Sobriété (prix + data détectés séparément).

### 🗑️ Retrait

- **Chez Switch retiré** — L'opérateur ne propose que des forfaits avec engagement 12 mois. Retiré du scraper, du Hero (badges), de l'OperatorBadge (couleur) et du compteur opérateurs (19 → 18).

### 🤖 Bot Discord

- **Notification de suppression de forfait** — Le bot Discord notifie désormais quand un forfait est retiré par un opérateur. Après chaque scrape, les forfaits présents en base mais absents du résultat du scraping sont automatiquement supprimés et une notification 🗑️ est envoyée sur tous les salons abonnés. Le type `broadcastDeal` accepte maintenant `NEW`, `UPDATE` et `DELETE`. L'embed de suppression utilise une couleur grise neutre (`#95a5a6`) pour se distinguer visuellement des nouveautés et mises à jour.

### 🐛 Correctifs

- **Lycamobile — crash `__name is not defined`** — Le bundler esbuild/tsx injectait un wrapper `__name()` autour de la fonction helper `pushPlan` dans `page.evaluate()`, ce qui crashait dans le contexte navigateur Puppeteer. Corrigé en utilisant `var addPlan = function(...)` au lieu de `const pushPlan = (...) =>` pour éviter l'injection.
- **Lycamobile — contournement antibot** — Ajout de mesures anti-détection supplémentaires : suppression du flag `webdriver`, spoof des plugins navigateur, attente initiale plus longue (8s).
- **Nordnet — tous les forfaits au même prix** — Le regex de prix matchait toujours le premier `XX€XX par mois` du body text car tous les tabpanels étaient dans le DOM. Corrigé en lisant le prix depuis le `tabpanel` actif uniquement (filtrage par `aria-hidden`, `hidden`, CSS `display`/`visibility`).
- **TeleCoop — aucun forfait détecté** — Le regex du prix Sobriété exigeait `(\d{1,2})\s*€\s*/?\s*mois` mais le site affiche le prix avec un espace fine insécable (`\u202f`) déjà normalisé, suivi d'un `€` sans `/mois`. Ajout d'un fallback `(\d{1,2})\s*€` et relâchement du regex data `inclus` en optionnel.
- **Akeo — aucun forfait détecté** — Le regex cherchait le format `ou XX,XX€/mois` mais le site affiche `XX € XX / mois` (format splitté avec espaces). Ajout d'un pattern fallback `(\d{1,2})\s*€\s*(\d{2})\s*/\s*mois` pour gérer les deux formats.

### 🛠️ Technique

- **Règle de plafond anti-Fibre** — Les frais d'activation et de résiliation captés par le scraper sont automatiquement ignorés s'ils dépassent respectivement 20€, ce qui élimine les faux positifs récurrents liés aux offres Fibre/Bbox affichées en cross-sell.
- **Normalisation unicode renforcée** — La fonction centralisée normalise systématiquement les apostrophes typographiques (`'` → `'`), les espaces insécables, les tirets longs, et le symbole € avant analyse regex. Ceci est appliqué uniformément à tous les scrapers.
- **Purge automatique des forfaits obsolètes** — Après la sauvegarde de chaque opérateur, le scraper compare les plans en base avec ceux fraîchement scrapés. Les plans non retrouvés (renommés, supprimés, changement de gamme) sont automatiquement supprimés de la base et notifiés via Discord.

---

## [2.0.0] — 2026-03-17


### ✨ Nouvelles fonctionnalités — 8 nouveaux opérateurs (20 au total)
- **Lycamobile** — Scraper pour le MVNO à gros volumes sur réseau Bouygues Telecom. Extraction DOM par blocs forfaits avec fallback textuel ligne par ligne. Filtrage automatique des offres internationales et bundles non-mensuels.
- **Prixtel** — Scraper pour l'opérateur à forfaits modulaires (Le Petit, Le Grand, Le Géant) sur réseau Orange. Extraction des paliers data/prix par regex avec prise du palier le plus élevé par plan. Détection de la génération réseau (4G/5G) depuis le nom du forfait.
- **TeleCoop** — Scraper pour l'opérateur coopératif et solidaire sur réseau Orange. Extraction DOM standard par cartes/blocs, filtrage des forfaits avec engagement.
- **Akeo Telecom** — Scraper pour le MVNO sur réseau SFR. Extraction dynamique avec détection du réseau depuis le texte de la page. Filtrage anti-engagement.
- **Chez Switch** — Scraper pour le MVNO écoresponsable sur réseau Orange. Prise en charge SPA avec scrolls et attentes supplémentaires. Extraction du palier data le plus élevé par carte.
- **Prompto** — Scraper pour le MVNO du Crédit Mutuel sur réseau SFR. Extraction DOM par blocs produits avec fallback textuel.
- **Nordnet** — Scraper pour la filiale mobile d'Orange (ex-Nordnet Mobile). Filtrage intelligent des offres box/fibre/ADSL pour ne conserver que les forfaits mobiles.
- **France Téléphone (Bleutel)** — Scraper API-first utilisant l'API WooCommerce Store (`/wp-json/wc/store/v1/products`) avec fallback DOM. Chaque forfait est dupliqué pour les réseaux Orange et Bouygues Telecom (choix à la souscription, prix identiques).

### ✨ Nouvelles fonctionnalités — Frontend
- **Sélecteur « Forfaits Mobiles » / « Box Opérateurs »** — Ajout d'un sélecteur UI en page d'accueil séparant les forfaits mobiles (actif) et les box opérateurs (coming soon). Prépare l'arrivée du comparateur Box dans une version ultérieure.
- **20 badges opérateurs** — Le HeroSection affiche désormais les 20 opérateurs suivis avec leurs couleurs de marque respectives. Compteur mis à jour (« 20 opérateurs scannés en temps réel »).
- **Couleurs des nouveaux opérateurs** — Ajout des couleurs de marque dans `OperatorBadge.vue` pour Lycamobile (vert #63A532), Prixtel (bleu #00B4D8), TeleCoop (vert #2D8F4E), Akeo (bleu #004B87), Chez Switch (orange #FF6B00), Prompto (rouge #E30613), Nordnet (bleu #003DA5), France Téléphone (bleu-gris #2C5F8A).

### 🛠️ Architecture
- **Architecture scraper API-first (France Téléphone)** — Nouveau pattern de scraping qui tente d'abord l'API JSON du site (WooCommerce Store API) avant de se rabattre sur l'extraction DOM. Plus fiable et plus rapide quand l'API est disponible.
- **Duplication multi-réseau (France Téléphone)** — Nouveau mécanisme de duplication automatique des forfaits pour les opérateurs proposant le même forfait sur plusieurs réseaux. Chaque plan France Téléphone apparaît en version Orange et Bouygues Telecom.
- **Détection d'engagement harmonisée** — Tous les nouveaux scrapers incluent un filtrage automatique des offres avec période d'engagement (regex multi-patterns : « engagement », « 12 mois », « 24 mois »). Seuls les forfaits sans engagement sont conservés.
- **Conformité `__name` (esbuild/tsx)** — Les 8 nouveaux scrapers respectent strictement la règle de ne jamais déclarer de fonctions nommées à l'intérieur de `page.evaluate()`, évitant le bug `__name is not defined` en production.

### 📝 Notes
- **Mint Mobile FR retiré** — L'opérateur « Mint Mobile (FR) » initialement prévu a été retiré du scope. Mint Mobile est un MVNO exclusivement américain (propriété de T-Mobile US) et n'opère pas en France.

### 🔧 Correctifs (post-release 2.0.0)
- **B&You — extraction frais mentions légales durcie** — Ajout d'une ouverture dynamique des blocs « Mentions légales / détails » avant parsing. Réduction des faux négatifs sur SIM / activation / résiliation quand le texte est masqué derrière un accordéon.
- **YouPrice — frais SIM via livraison** — Prise en compte explicite des formulations « frais de livraison / envoi (carte SIM) » dans les patterns SIM, y compris les variantes « livraison offerte / gratuite ».
- **Coriolis — doublons de forfaits réduits** — Ajout d'une passe de dédoublonnage pour éviter les faux doublons (forfait principal + palier data parasite) et limiter les collisions de lignes au même prix.
- **Akeo Telecom — séparation sans engagement renforcée** — Filtrage contextuel des prix liés aux offres « avec engagement » afin de conserver uniquement les forfaits sans engagement.
- **Chez Switch — extraction multi-stratégies cumulée** — Les stratégies de détection ne sont plus exclusives : elles s'additionnent avec déduplication finale, ce qui rétablit la découverte de plusieurs offres au lieu d'une seule.
- **France Téléphone (Bleutel) — faux frais d'activation fixe neutralisés** — Ajout d'un pré-filtrage mobile (exclusion des contextes « fixe / bleufix ») pour éviter d'hériter des frais de mise en service des offres fixes.

## [1.1.1] — 2026-03-10

### 🔧 Corrections
- **Fix crash scrapers B&You et Coriolis en production (`__name is not defined`)** — Les scrapers B&You et Coriolis crashaient systématiquement en environnement Docker/production avec l'erreur `ReferenceError: __name is not defined`. Cause : `tsx` (via `esbuild`) injecte un helper `__name(fn, "name")` autour des fonctions nommées pour préserver leur propriété `.name`. Lorsqu'une fonction nommée est déclarée à l'intérieur d'un callback `page.evaluate()`, Puppeteer sérialise ce callback et l'envoie au navigateur Chromium — où `__name` n'existe pas. Deux occurrences corrigées :
  - **B&You** : `const delay = (ms) => ...` dans le scroll progressif → remplacé par `await new Promise(r => setTimeout(r, 800))` inline.
  - **Coriolis** : `const detect5G = (dataGb, idx) => {...}` pour la détection 5G → logique inlinée directement aux deux sites d'appel.

### 🛠️ Technique
- **Règle de dev : ne jamais déclarer de fonctions nommées dans `page.evaluate()`** — Les déclarations `const fn = () => {}` ou `function fn() {}` à l'intérieur d'un `page.evaluate()` sont transformées par esbuild en `const fn = __name(() => {}, "fn")`, ce qui casse l'exécution dans le contexte navigateur. Utiliser uniquement des expressions inline ou des variables simples.

## [1.1.0] — 2026-03-10

### 🔧 Corrections
- **Fix Lien d'invitation Discord** — Le bouton "Inviter le Bot" sur la page d'accueil renvoyait vers `#` au lieu de l'URL OAuth2 Discord. Correction de l'encodage du scope (`bot%20applications.commands` au lieu de `bot+applications.commands`) et ajout d'un indicateur visuel "Bot non configuré" quand `DISCORD_CLIENT_ID` n'est pas défini dans l'environnement.
- **Fix Crash Loop Bot Discord (`Unknown interaction`)** — Le bot crashait en boucle lorsqu'un utilisateur exécutait `/deal-setup` et que l'opération Prisma prenait plus de 3 secondes (timeout Discord). Ajout de `deferReply()` immédiat avant l'accès DB, wrapping exhaustif de tous les `reply`/`editReply` dans des `try/catch`, et ajout d'un handler `discordClient.on('error')` pour intercepter les erreurs non gérées. Remplacement de l'option dépréciée `ephemeral: true` par `flags: MessageFlags.Ephemeral`.
- **Fix Détection Frais B&You (SIM / Activation / Résiliation)** — Le scraper B&You utilisait le fallback (prix SIM par défaut à 10€) car les frais n'étaient plus détectables via le checkout (changement de flow côté Bouygues). Ajout d'une pré-extraction des frais depuis les mentions légales en bas de page (`Carte SIM à 1€. Frais d'activation à 1€. Frais de résiliation : 5€`), avec normalisation des caractères spéciaux (apostrophes typographiques, espaces insécables, symbole €). Les frais sont extraits une seule fois puis appliqués en cascade à tous les forfaits. Filtre intelligent pour ignorer les montants fibre (48€ mise en service, 69€ résiliation).
- **Fix Détection Frais Syma Mobile (Activation / SIM)** — Le scraper Syma calculait correctement les frais d'activation globaux (`10€`) et le prix SIM depuis la page, mais ne les injectait jamais dans les forfaits retournés (toujours `null`). Les variables `globalActivation` et `globalSim` sont maintenant utilisées dans le `return` avec priorité au prix par forfait (`p.activationPrice`) si disponible.

### 🛠️ Technique
- **Scroll renforcé B&You** — Le scraper B&You effectue maintenant 5 scrolls progressifs (au lieu d'un seul) pour garantir le chargement complet des mentions légales en bas de page.
- **Logs enrichis scrapers** — Ajout de logs explicites pour les frais extraits des mentions légales B&You (`[B&You] Frais extraits des mentions légales — SIM: X€, activation: X€, résiliation: X€`) et warning console quand le Discord Client ID est absent.

## [1.0.0] — 2026-03-10

### ✨ Nouvelles fonctionnalités
- **Page 404 Néo-Brutaliste** — Création d'une page d'erreur 404 sur-mesure respectant l'identité visuelle du projet. Design en CSS pur (sans images), typographie massive, blocs colorés (`primary`/`secondary`) et ombres portées (`shadow-neo`). Support complet du mode sombre avec accessibilité renforcée (texte contrasté sur fond jaune).
- **Bannière Promotionnelle Discord** — Ajout d'une section massive et colorée sur la page d'accueil incitant les utilisateurs à rejoindre le bot Discord pour suivre l'évolution des forfaits.
- **Sécurité par l'obscurité (Admin)** — Retrait du bouton "Admin" visible dans le footer public pour plus de discrétion. L'accès au panneau de contrôle se fait désormais uniquement via l'URL directe `/admin`.

### 🔧 Corrections
- **Fix "0 Mo" (Migration Prisma Float)** — Le champ `dataGb` en base de données est passé du type `Int` au type `Float`. Cela corrige le bug où les forfaits < 1 Go (ex: 100 Mo -> 0.1 Go) étaient arrondis à 0 par PostgreSQL. Ils s'affichent désormais parfaitement en Mo partout.
- **Fix Formatage Bot Discord (Mo)** — Le bot Discord adapte désormais son unité (Go/Mo) pour les forfaits de moins de 1 Go, assurant une cohérence visuelle parfaite avec le site web.
- **Fix Formatage Syma (Mo)** — Mise à jour du scraper Syma pour formater correctement les noms de forfaits en "Mo" au lieu de "Go" pour les petites enveloppes data.
- **Fix Robustesse B&You (Normalisation)** — Résolution du problème de checkout intermittent (échec 1 fois sur 2). Le scraper normalise maintenant les accents des boutons (é -> e), permettant de cliquer sur "Étape suivante" sans erreur d'encodage.
- **Fix Accessibilité Dark Mode (404)** — Correction du contraste sur la page 404 en mode sombre en forçant le texte noir sur fond jaune.

### 🎨 Design
- **Page Mentions Légales** — Création d'une page `/mentions-legales` complète intégrée au design néobrutaliste du site. 10 sections numérotées (Éditeur, Hébergement, Présentation, Fonctionnement, Responsabilité, Affiliation, Propriété intellectuelle, Mesure d'audience, Données personnelles, Droit applicable) avec blocs `neo-box`, numéros colorés alternés et support complet du mode sombre.
- **Lien Footer "Mentions Légales"** — Ajout d'un bouton `📜 Mentions Légales` stylisé dans le footer du layout par défaut, visible sur toutes les pages.

### 🛠️ Technique — Migration Prisma v6 → v7
- **Nouveau client Prisma (Rust-free)** — Passage du provider `prisma-client-js` à `prisma-client` avec un `output` explicite vers `src/generated/prisma`. Le nouveau client est plus léger et ne nécessite plus de moteur binaire Rust.
- **Driver Adapter PostgreSQL** — Ajout de `@prisma/adapter-pg` (`PrismaPg`) pour la connexion directe TCP à la base de données, remplaçant l'ancien moteur de requêtes intégré.
- **Prisma Config centralisé** — Création de `prisma.config.ts` à la racine du backend pour centraliser la configuration CLI (schéma, migrations, URL de la base). Utilisation de `process.env.DATABASE_URL` avec placeholder fallback pour permettre `prisma generate` au build Docker sans variable d'environnement.
- **Passage en ESM** — Ajout de `"type": "module"` dans `package.json`. Configuration `tsconfig.json` mise à jour (`module: ESNext`, `moduleResolution: bundler`, `target: ES2023`).
- **Runtime `tsx`** — Remplacement de `ts-node-dev` par `tsx` pour le développement et la production. Résout les problèmes de résolution d'imports sans extension `.js` inhérents à ESM, sans nécessiter de modifier chaque fichier source.
- **Chargement explicite des variables d'environnement** — Ajout de `import "dotenv/config"` dans le point d'entrée (`src/index.ts`) et dans `prisma.config.ts`, les variables d'environnement n'étant plus chargées automatiquement en Prisma v7.
- **Simplification du Dockerfile** — Suppression du `RUN npx prisma generate` redondant (géré par `npm run build`). Le script `build` exécute désormais uniquement `prisma generate`.
- **Nettoyage de l'entrypoint Docker** — Suppression du `prisma generate` au runtime (inutile puisque `tsx` lit directement les sources `.ts`). Seul `prisma db push` est conservé pour synchroniser le schéma au démarrage.
- **CI : Node ≥ 20** — Suppression de Node 18.x de la matrice de test GitHub Actions (incompatible avec Prisma v7, minimum requis : 20.19).

### 🛠️ Technique
- **Migration Schema DB** — Exécution de `npx prisma db push` pour le passage au type `Float`.
- **Nettoyage Environnement** — Suppression des scripts de débogage temporaires (`test-byou.ts`) et des captures d'écran de test.

### 🔒 Sécurité
- **Mise à jour des Dépendances (Backend/Frontend)** — Mise à jour des paquets vers leurs dernières versions stables (`discord.js`, `undici`, `nuxt`, `puppeteer`, etc.) pour patcher les vulnérabilités les plus critiques. Choix délibéré de ne pas utiliser de `overrides` pour préserver un arbre de dépendances standard et stable. Le backend est désormais à jour sur ses briques principales.

## [0.6.0] — 2026-03-08

### ✨ Nouvelles fonctionnalités
- **Support analytique (Matomo)** — Préparation de l'intégration optionnelle de Matomo Analytics via Docker (`matomo` / `matomo_db`) et le module `@nuxt/scripts` côté frontend, respectueux de la vie privée.
- **Bot Discord Néo-Brutaliste** — Intégration d'un véritable Bot Discord (`discord.js`) qui notifie passivement les utilisateurs. Une commande `/deal-setup` permet aux administrateurs de serveurs d'enregistrer leur salon pour recevoir automatiquement de sublimes alertes Format Embed avec les couleurs de l'opérateur.
- **Bannière Automatique Discord** — Création d'un très grand encart `#5865F2` (bleu Discord) en bas de page pour inciter la communauté à rejoindre le serveur et à installer le bot.
- **Forfaits illimités NRJ Mobile** — Le scraper détecte désormais les forfaits « Illimité » (stockés avec `dataGb: 9999`) en plus des forfaits classiques à enveloppe fixe.
- **Prix SIM dynamique par plan** — NRJ Mobile, Auchan, Lebara, Sosh, RED by SFR, Free, B&You, YouPrice, Coriolis, La Poste Mobile, Cdiscount et Syma détectent automatiquement le prix de la carte SIM depuis la page catalogue. Plus besoin de le saisir manuellement, y compris pour les promos Lebara à 0€.
- **Frais d'Activation et Résiliation Dynamiques** — Les 12 scrapers parcourent dynamiquement les pages forfaits pour extraire automatiquement les prix de carte SIM, les éventuels frais d'activation ou de mise en service, et les frais de résiliation trouvés dans les mentions légales ou textes de description.
- **Fallback PDF pour les frais opérateurs** — Quand les frais de résiliation, d'activation ou le prix SIM ne sont pas trouvés sur la page web, le système télécharge et analyse dynamiquement les CGS/guides tarifaires PDF des opérateurs (NRJ Mobile, Cdiscount Mobile, Auchan Telecom, B&You, Free Mobile, La Poste Mobile). Extraction par regex multi-patterns sur le texte brut du PDF avec détection intelligente du prix en ligne vs en boutique.
- **Détection SIM et activation via checkout** — En l'absence du prix SIM ou des frais d'activation sur la page catalogue, le scraper tente automatiquement de naviguer vers le panier/checkout de l'opérateur pour y détecter les deux (prix SIM et frais d'activation/souscription) avant de se rabattre sur le PDF. Particulièrement utile pour B&You où le checkout affiche des prix promos différents du guide tarifaire PDF.
- **Prix SIM par défaut configurable** — Nouveau champ `defaultSimPrice` dans la config scraper permettant de définir un prix SIM de dernier recours lorsqu'il n'est trouvé ni sur le site, ni au checkout, ni dans le PDF (utilisé pour Sosh et RED by SFR à 10€).
- **Curseur de Data étendu** — Le slider de Data en frontend permet désormais de sélectionner jusqu'à 500 Go pour tenir compte des nouveaux grands forfaits MVNO.
- **Filtre par Réseau** — Ajout d'une option directement dans le composant des Besoins en Data permettant de cibler un réseau spécifique (Orange, SFR, Bouygues, Free) ou de garder tous les réseaux actifs. Le message d'erreur d'aucun forfait s'adapte dynamiquement si aucun forfait n'est disponible sur ce réseau.
- **Suppression édition manuelle SIM** — Le champ « simPrice » n'est plus éditable dans l'admin. Il est auto-détecté par les scrapers et affiché par plan dans le tableau. Les frais d'activation et de résiliation restent éditables manuellement.

### 🔧 Corrections
- **Fix Free Mobile SIM à 0€ au lieu de 10€** — Le regex `sim offert` matchait le texte promo « SIM offerte pour les abonnés Freebox » et mettait le prix à 0€. Corrigé : les patterns numériques sont maintenant testés en premier, et `offert/gratuit` ne s'applique que si ce n'est pas conditionnel (exclusion de « Freebox », « abonnés »).
- **Fix faux positifs activation (tous scrapers)** — Le pattern `frais de livraison` était classé comme frais d'activation dans les 12 scrapers, causant des faux positifs systématiques (ex: B&You affichait activation: 6/6 avec le prix de livraison). Remplacé par `frais de souscription` qui est un vrai synonyme d'activation.
- **Fix B&You checkout inaccessible** — Implémentation d'un flux en deux clics (« Continuer » puis « Étape suivante ») pour traverser la page d'options et atteindre le panier réel, permettant d'extraire les frais de la SIM et de l'activation à 1€.
- **Fix DealCard Affichage** — Le badge "Augmentation probable" a été intégré au flux naturel du composant pour ne plus chevaucher le ruban absolu "Meilleur Choix" de la carte Star sur les petits écrans.
- **Fix Coriolis SIM** — Ajout du mot-clé « j'en profite » en priorité absolue dans le checkout pour forcer le clic sur le bon bouton du forfait au lieu d'un lien générique du header, permettant de récupérer les frais d'activation de 10€.
- **Fix La Poste Mobile prix SIM** — Ajout du récapitulatif contractuel PDF. L'extraction multi-ligne fusionne les paragraphes découpés pour détecter le prix en ligne (9,90€) distinct du prix en bureau de poste (14,90€) et du prix conditionnel Bbox (0€).
- **Fix Cdiscount SIM faux positif** — L'extraction du prix de la carte SIM se fait désormais de manière ciblée par bloc de variante de forfait (prix locaux) au lieu d'une regex globale, corrigeant l'attribution fautive des cartes SIM à 5€ et 1€.
- **Fix NRJ Mobile (500 Go manquant et URLs erronées)** — Le forfait 500 Go manquait, et l'URL du catalogue a été corrigée (`/forfait-se` au lieu de `/forfait-mobile`).
- **Fix Sosh (timeout systématique)** — Le site a migré de `sosh.fr` vers `shop.sosh.fr`. URL corrigée et parsing adapté au nouveau layout (3 forfaits actuels).
- **Fix Syma Mobile SIM** — Le scraper ignore désormais les longs textes SEO présents dans le footer (« Carte SIM gratuite ») qui provoquaient un faux positif à 0€, forçant ainsi le système à interroger correctement le PDF du guide tarifaire.
- **Retrait Réglo Mobile** — L'opérateur a été retiré de l'interface frontend (Hero, Badges) et son scraper a été désactivé côté backend.
- **Fix Free Mobile (timeouts intermittents)** — Ajout d'un mécanisme de retry avec délai de 10s en cas d'erreur réseau `ERR_TIMED_OUT`, appliqué à tous les scrapers.
- **Fix NRJ Mobile (plan manquant)** — Le forfait Illimité 5G n'était pas détecté car le regex ne matchait que `\d+ Go`.
- **Fix frais de résiliation non détectés** — NRJ Mobile, Cdiscount Mobile, Auchan Telecom et B&You initialisaient les frais de résiliation à 0€ par défaut au lieu de `null`, empêchant le fallback PDF de se déclencher quand l'info n'était pas présente sur la page.
- **Fix faux frais d'activation B&You (48€)** — Le scraper B&You interceptait parfois les "Frais de mise en service de 48€" liés à une offre Fibre Bbox affichée en cross-sell (vente croisée) ou dans le panier. Les frais d'activation mobiles sont désormais formellement plafonnés à 20€ dans l'algorithme d'extraction (`utils.ts`) pour ignorer le matériel fixe.

### 🎨 Design
- **Responsive Mobile-First** — Refonte complète des composants de l'interface (`HeroSection`, `DataSlider`, `DealCard`, `OperatorBadge`) pour garantir un affichage fluide sur smartphone sans débordement horizontal ni texte écrasé :
  - **Titres fluides** : Utilisation d'échelles de classes (`text-4xl md:text-7xl`) pour adapter la typographie Néo-Brutaliste aux petits écrans.
  - **Empilement (Stacking)** : Les rangées (`flex-row`) de la barre de Data ("Go") et du récapitulatif des prix (`DealCard`) se transforment désormais en colonnes (`flex-col`) sur mobile pour préserver la lisibilité de chaque bloc.
  - **Badges fluides** : Les étiquettes de réseau, de 5G et d'alerte (`Augmentation probable`) utilisent désormais le retour à la ligne (`flex-wrap`) ou s'intègrent au flux naturel (`DealCard`) pour éviter de chevaucher le texte ou le ruban de la carte Star sur mobile.
  - **Grille adaptative** : Espacement de grille `gap-6` sur mobile (`md:gap-8`) sur la grille des forfaits pour optimiser l'espace écran.

### 🛠️ Technique
- **Retry réseau global** — Tous les scrapers bénéficient d'un retry automatique en cas de timeout réseau (2 tentatives max, 10s entre chaque).
- **User-Agent mis à jour** — Passage à Chrome 131 pour une meilleure compatibilité avec les protections anti-bot.
- **Détection SIM gratuite Lebara** — Patterns reconnus : « SIM gratuite », « carte SIM 0€ », « SIM offerte ».
- **Parsing PDF via `pdf-parse` v2** — Utilisation de l'API `PDFParse` pour télécharger et extraire le texte brut des PDF de CGS. Les frais sont recherchés dynamiquement via des patterns regex multi-variantes (résiliation, activation, mise en service, fermeture, souscription, carte SIM).
- **Architecture fallback à 4 niveaux** — Pour chaque donnée manquante (SIM, activation, résiliation), le système suit la chaîne : page web → checkout/panier → PDF des CGS → `defaultSimPrice` configurable. La logique est centralisée dans `scraper.service.ts` et s'applique à tous les opérateurs.
- **Checkout intelligent** — La détection du bouton CTA utilise 10 keywords conjugués (`je choisis`, `je commande`, `commander`, `souscrire`…), exclut automatiquement les éléments de footer/nav/header, et log l'URL de destination pour faciliter le debug.
- **Extraction SIM PDF améliorée** — Nouvelle stratégie en 2 phases : d'abord une extraction directe (« Carte SIM facturée X€ »), puis une analyse par paragraphes fusionnés avec priorisation du prix en ligne (`.fr`, `en ligne`) sur le prix en boutique/bureau de poste.
- **Détection SIM site robustifiée** — Les patterns numériques sont testés AVANT les patterns « offert/gratuit » pour éviter les faux positifs promotionnels (ex: « SIM offerte pour les abonnés Freebox »). Appliqué à Free Mobile, Coriolis et potentiellement tous les scrapers touchés.

---

## [0.5.0] — 2026-03-05

### ✨ Nouvelles fonctionnalités
- **6 nouveaux opérateurs MVNO** — Ajout de La Poste Mobile (Bouygues), NRJ Mobile (Bouygues), Auchan Telecom (Bouygues), Cdiscount Mobile (Bouygues), Syma Mobile (SFR) et Lebara (SFR), portant le nombre total d'opérateurs surveillés à **12**.
- **Nouvel Opérateur : Coriolis** — Ajout de Coriolis Télécom (MVNO réseau SFR) à la liste des opérateurs scannés.
- **Détection 4G / 5G** — Chaque forfait scrapé est désormais identifié comme 4G ou 5G grâce à une analyse du contenu des pages opérateurs. Un badge coloré (accent pour 5G, muted pour 4G) est affiché dans les cartes forfait et dans le tableau admin.
- **Data Europe/DOM** — Chaque forfait affiche désormais l'enveloppe de data utilisable en Europe et DOM (icône globe + "XX Go EU") dans les cartes forfait. Scraping automatique pour les 12 opérateurs.
- **YouPrice multi-réseau** — Les forfaits YouPrice disponibles sur plusieurs réseaux (Orange, SFR, Bouygues) sont désormais traités comme des offres distinctes au lieu d'écraser les doublons. Le nom du forfait inclut le réseau pour les différencier.
- **Barre d'opérateurs dans le Hero** — Affichage visuel des 12 opérateurs scannés sous forme de badges néo-brutalistes avec les couleurs de marque de chaque opérateur, rotations alternées et effet hover.

### 🔒 Sécurité
- **Suppression des identifiants en dur** — Les credentials `admin:secret` codés en clair dans le JavaScript client ont été supprimés. L'authentification repose maintenant sur le header HTTP Basic transmis par le navigateur via `useState`.
- **Comparaison timing-safe** — Les mots de passe sont comparés via un algorithme à temps constant (XOR bit à bit) pour empêcher les attaques par timing, côté backend et frontend.
- **Rate limiting** — Maximum 10 tentatives d'authentification échouées par IP sur 15 minutes (backend).
- **Variables d'environnement obligatoires** — Plus aucun fallback `admin/secret`. Le serveur refuse de démarrer si `ADMIN_USERNAME` et `ADMIN_PASSWORD` ne sont pas définis.
- **Sécurisation PostgreSQL** — Les credentials de la base de données sont configurables via `.env` au lieu d'être en dur dans le compose. Le port 5432 n'est plus exposé publiquement.
- **CORS restreint** — Remplacement de `origin: '*'` par une whitelist configurable.

### 🔧 Corrections
- **Fix DNS Docker** — Ajout de serveurs DNS publics (Google, Cloudflare) au service backend dans `compose.yml` pour résoudre les erreurs `ERR_NAME_NOT_RESOLVED` lors du scraping depuis le conteneur.
- **Fix scraping NRJ Mobile & Auchan Telecom** — Les sites EI Telecom rendent les données (`500`) et l'unité (`Go`) sur des lignes séparées dans Puppeteer headless. Ajout d'un pattern multi-ligne pour détecter ce cas.
- **Fix URL Cdiscount Mobile** — L'ancienne page catalogue retournait 404. Migration vers la page dédiée `cdiscount-mobile/v-164-0.html`.
- **Fix détection 5G Coriolis** — La fenêtre de recherche "5G" capturait les mentions génériques de la FAQ. Réduction à la ligne du forfait uniquement pour éviter les faux positifs.
- **Fix détection 5G B&You / RED** — La 5G n'apparaît pas dans les labels radio mais dans un badge visuel séparé. La détection lit désormais la page visible après chaque clic au lieu du texte du label.
- **Fix détection 5G YouPrice** — La génération réseau ("Réseau 5G") apparaît APRÈS le titre du forfait dans le DOM. Le scraper regarde maintenant en avant (look-ahead) au lieu de conserver un état global qui propageait la valeur du plan précédent.

### 🎨 Design
- **Badges Opérateurs** — Couleurs de marque dédiées pour les 12 opérateurs : Sosh (orange), RED (rouge), B&You (bleu), Free (rouge foncé), YouPrice (bleu nuit), Coriolis (violet), La Poste Mobile (jaune), NRJ Mobile (rouge vif), Auchan Telecom (rouge), Cdiscount Mobile (bleu marine), Syma Mobile (vert), Lebara (magenta).
- **Encart Coût 1 an** — Taille réduite et alignement sur l'encart des frais opérateur pour une lecture plus cohérente des cartes forfait.
- **Bannière Automatique Discord** — Création d'un très grand encart `#5865F2` (bleu Discord) en bas de page pour inciter la communauté à rejoindre le serveur et à installer le bot.

### 🛠️ Technique
- **Proxy Nitro** — Les appels API frontend passent maintenant par un proxy Nuxt (`routeRules`) au lieu d'appeler `http://localhost:3001` en dur. Seul le port du frontend est exposé.
- **Configuration Docker centralisée** — Un seul `.env` à la racine configure admin, Postgres et le port public. Docker Compose refuse de démarrer si les variables obligatoires manquent.
- **Unicité DB renforcée** — La recherche de doublons en base inclut maintenant le champ `network` pour éviter d'écraser des forfaits sur des réseaux différents.
- **Scrapers résilients** — Les 6 nouveaux scrapers gèrent le rendering multi-ligne (BTBD, ex. EI Telecom), les prix split, les promos (La Poste Mobile prend le prix hors promo), et retournent `[]` en cas d'échec sans bloquer les autres.
- **README restructuré** — Documentation mise à jour avec le schéma d'architecture, la section sécurité, les instructions de déploiement serveur et la table des 12 opérateurs.

### 🔒 Sécurité
- **Bouton d'administration masqué** — Retrait du bouton d'accès au panel admin (`⚙️ Admin`) présent en dur dans le pied de page (`footer`). Le panel reste exclusivement accessible en se rendant manuellement sur la route `/admin`.
- **CORS restreint (Nuxt)** — Les requêtes vers l'API sont bloquées si elles ne proviennent pas du domaine défini dans `.env` (`CORS_ORIGIN`).
- **Isolation réseau Docker** — Le frontend communique en direct avec le backend via le réseau Docker privé (`http://backend:3001`). Seul le frontend est exposé sur le port public `3000`.
- **Basic Auth (Proxy Caddy)** — Le panel `deal.doalo.fr/admin` est protégé par un rempart d'authentification HTTP intégré au reverse-proxy (limite les bruteforces sur l'API Node).

---

## [0.4.0] — 2026-03-03

### ✨ Nouvelles fonctionnalités
- **Administration Sécurisée** — Intégration d'une protection par authentification HTTP Basic sur la page `/admin` (Nuxt) et sur les routes de modification de l'API (Express) pour sécuriser l'accès à la Control Room.
- **Nouvel Opérateur : YouPrice** — Ajout de YouPrice (réseau Orange / SFR / Bouygues) à la liste des MVNO scannés automatiquement, portant le nombre d'opérateurs surveillés à 5.
- **Section Méthodologie** — Ajout d'une section explicative sur la page d'accueil détaillant le calcul du Coût Réel, la philosophie du Juste Prix, l'indépendance du comparateur et le Label "Fairplay".
- **Dashboard Admin : Auto-Polling** — Le panneau d'administration interroge automatiquement l'état du scraping (toutes les 5 secondes) et rafraîchit les offres dès que le robot a terminé, offrant un suivi en temps réel sans rechargement manuel.
- **Bouton Rouge (Zone Danger)** — Ajout d'une fonctionnalité sécurisée pour vider l'intégralité de la base de données directement depuis la Zone Restreinte de l'Admin (`DELETE /api/v1/clear`).
- **Affichage du Coût sur 1 An** — Les cartes forfaits intègrent désormais explicitement le calcul "(Abonnement 1 an)" combinant le prix mensuel sur 12 mois, le coût de la SIM, et les frais d'activation ou résiliation.

---

## [0.3.0] — 2026-03-03

### ✨ Nouvelles fonctionnalités
- **Dark Mode Complet** — Thème sombre intégré respectant l'identité Néo-Brutaliste. Bascule dynamique gérée via `useColorMode()`, appliqué sur l'Accueil, le Footer et la Control Room (Admin).
- **Frais Opérateurs Avancés** — Prise en charge des frais de résiliation et d'activation dans le modèle de données, intégrés au calcul global d'abonnement pour "L'Offre Star".
- **Icônes d'interface** — Ajouts de SVG clairs (Téléphone, Bulles) pour différencier facilement les Appels et les SMS dans les cartes forfait.

### 🔧 Corrections
- **Amélioration du Scrapper Sosh** — Réparation du scrapping et détection intelligente des heures d'appels incluses ou illimitées.
- **Détection des heures Free & B&You** — Amélioration de l'extraction des quotas d'heures d'appels pour les forfaits à enveloppe restreinte.
- **Correction des Contrastes (Accessibilité)** — Ajustements majeurs des couleurs de textes sur les éléments colorés (Noir absolu sur Jaune Primaire/Rose Secondaire) pour le panneau d'administration et la carte Star.

---

## [0.2.0] — 2026-03-02

### ✨ Nouvelles fonctionnalités
- **Slider éditable au Go près** — Cliquez sur la valeur Go pour saisir un chiffre précis, le curseur s'ajuste automatiquement
- **Liens directs opérateurs** — Chaque carte forfait (star et alternatives) affiche un bouton "Voir ce forfait" / "Souscrire maintenant" pointant vers le site de l'opérateur
- **Score €/Go affiché** — Chaque carte de forfait montre le rapport qualité/prix en €/Go
- **Bouton "Voir tous les forfaits"** — Permet d'afficher tous les forfaits au-delà des 3 alternatives initiales
- **Prix SIM/eSIM éditables** — Nouveau endpoint `PUT /api/v1/deals/:id` + interface d'édition inline dans l'admin
- **Affichage Mo intelligent** — Les forfaits < 1 Go s'affichent correctement en Mo (ex: "50 Mo" au lieu de "0.05 Go")
- **Logs scraper en temps réel** — Chaque forfait trouvé est loggé immédiatement dans la console pour tous les opérateurs

### 🔧 Corrections
- **Fix colonne `simPrice` manquante** — Ajout de `prisma db push` dans le `entrypoint.sh` pour synchroniser automatiquement le schéma BDD au démarrage
- **Fix URL Sosh** — Mise à jour de `/forfaits-mobiles` (404) vers `/forfaits-mobile/`
- **Fix URL B&You** — Mise à jour vers `/forfaits-mobiles/b-and-you`
- **Fix affichage initial** — Le slider démarre à 20 Go au lieu de 100, les forfaits s'affichent dès le premier chargement
- **Fix slider à 0 Go** — Affiche tous les forfaits triés par prix
- **Fix backticks markdown** dans `scraper.service.ts` qui cassaient la compilation TypeScript

### 🎨 Design
- **Migration Néo-Brutaliste** — Remplacement complet du design glassmorphism par un style néo-brutaliste original
- **Composants modulaires** — `HeroSection`, `DataSlider`, `DealCard`, `OperatorBadge`
- **Suppression de la navbar** — Remplacée par un footer minimaliste avec lien admin
- **Titre Hero lisible** — "Trouvez votre forfait IDÉAL" avec fond contrasté
- **Typographies** — Space Grotesk + Outfit via Google Fonts

### 🛠️ Technique
- **Scrapers réécrits** — Double stratégie d'extraction (parsing texte + proximité spatiale DOM) pour Sosh et B&You
- **Entrypoint backend** — Auto-synchronisation du schéma Prisma au démarrage (`prisma db push`)
- **Nuxt config** — Titre et description plus percutants, favicon 📡, preconnect fonts

---

## [0.1.0] — 2026-03-01

### 🚀 Version initiale
- Migration du frontend d'Astro vers Nuxt 3
- Backend Express.js + Prisma + Puppeteer fonctionnel
- Scrapers pour Sosh, RED by SFR, B&You, Free Mobile
- Dashboard admin basique
- Docker Compose (db, backend, frontend)
