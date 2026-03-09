# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

## [0.6.0] — 2026-03-08

### ✨ Nouvelles fonctionnalités
- **Support analytique (Matomo)** — Préparation de l'intégration optionnelle de Matomo Analytics via Docker (`matomo` / `matomo_db`) et le module `@nuxt/scripts` côté frontend, respectueux de la vie privée.
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

### 🛠️ Technique
- **Proxy Nitro** — Les appels API frontend passent maintenant par un proxy Nuxt (`routeRules`) au lieu d'appeler `http://localhost:3001` en dur. Seul le port du frontend est exposé.
- **Configuration Docker centralisée** — Un seul `.env` à la racine configure admin, Postgres et le port public. Docker Compose refuse de démarrer si les variables obligatoires manquent.
- **Unicité DB renforcée** — La recherche de doublons en base inclut maintenant le champ `network` pour éviter d'écraser des forfaits sur des réseaux différents.
- **Scrapers résilients** — Les 6 nouveaux scrapers gèrent le rendering multi-ligne (BTBD, ex. EI Telecom), les prix split, les promos (La Poste Mobile prend le prix hors promo), et retournent `[]` en cas d'échec sans bloquer les autres.
- **README restructuré** — Documentation mise à jour avec le schéma d'architecture, la section sécurité, les instructions de déploiement serveur et la table des 12 opérateurs.

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