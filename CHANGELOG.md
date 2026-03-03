# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

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