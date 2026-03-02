# 📡 Deal-Voyager

**Vos forfaits mobiles sans embrouilles.**

Deal-Voyager est un comparateur de forfaits mobiles français indépendant. Il scrape automatiquement les prix des opérateurs (MNO/MVNO) et les classe au centime près pour vous aider à trouver l'offre la plus honnête — sans partenariat, sans pub, sans bullshit.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Nuxt](https://img.shields.io/badge/Nuxt_3-00DC82?style=for-the-badge&logo=nuxt.js&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

## ✨ Fonctionnalités

- 🔍 **Scraping automatisé** — Puppeteer + Stealth Plugin pour Sosh, RED, B&You, Free
- 📊 **Classement transparent** — Tri par coût annuel réel (prix × 12 + carte SIM) avec score €/Go affiché
- 🎨 **Interface Néo-Brutaliste** — Design original avec bordures épaisses, ombres dures et couleurs pop
- 🎛️ **Slider interactif + saisie directe** — Filtrage par data (0 à 400 Go), cliquable pour taper un chiffre précis
- 🔗 **Liens directs opérateurs** — Accès en un clic à la page de souscription de chaque forfait
- 💳 **Prix SIM/eSIM éditables** — Personnalisables par forfait depuis l'admin
- ⚙️ **Panneau d'administration** (`/admin`) — Relancer le scraping, éditer les prix SIM, modérer les opérateurs
- 📱 **Affichage Mo/Go intelligent** — Les forfaits < 1 Go s'affichent en Mo
- 🐳 **Déploiement Docker** one-click (migrations auto au démarrage)

## 🏗️ Stack Technologique

| Couche | Technologie |
|--------|-------------|
| **Backend** | Node.js + TypeScript + Express.js + Prisma ORM |
| **Scraping** | Puppeteer avec plugin Stealth anti-détection |
| **Frontend** | Nuxt 3 + Tailwind CSS |
| **Base de données** | PostgreSQL 15 |
| **Déploiement** | Docker + Docker Compose |

### Opérateurs Supportés

| Opérateur | Type | URL Scrapée | Statut |
|-----------|------|-------------|--------|
| Sosh | MNO (Orange) | sosh.fr/forfaits-mobile/ | ✅ Actif |
| RED by SFR | MNO (SFR) | red-by-sfr.fr/forfaits-mobiles/ | ✅ Actif |
| B&You | MNO (Bouygues) | bouyguestelecom.fr/forfaits-mobiles/b-and-you | ✅ Actif |
| Free Mobile | MNO | mobile.free.fr/ | ✅ Actif |

## 🚀 Démarrage Rapide

### Prérequis

- Docker & Docker Compose
- Git
- 4 Go RAM minimum

### Installation

```bash
git clone https://github.com/votre-username/Deal-Voyager.git
cd Deal-Voyager
docker compose up --build
```

C'est tout. Le schéma Prisma se synchronise automatiquement au démarrage via `prisma db push`.

### Accès

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:3000 |
| **API Backend** | http://localhost:3001 |

### Premier Lancement

1. Allez sur **http://localhost:3000/admin**
2. Cliquez sur **« Lancer l'extraction maintenant »**
3. Patientez ~2 minutes (le scraper parcourt les sites des opérateurs)
4. Retournez sur la page d'accueil pour explorer les forfaits

## 📡 API

### Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v1/deals` | Toutes les offres triées par score |
| `GET` | `/api/v1/stats` | État du système (nb offres, date MàJ, lock scraping) |
| `GET` | `/api/v1/operators` | Liste des opérateurs et leur statut fairplay |
| `POST` | `/api/v1/scrape` | Lance le scraping en arrière-plan |
| `PUT` | `/api/v1/deals/:id` | Modifier une offre (prix SIM, etc.) |
| `PUT` | `/api/v1/operators/:name/fairplay` | Toggle le statut fairplay d'un opérateur |
| `DELETE` | `/api/v1/clear` | Vide la base de données |

## 🛠️ Structure du Projet

```
Deal-Voyager/
├── backend/                 # API Express.js + Scraper
│   ├── src/
│   │   ├── controllers/     # Contrôleurs API (scrape, deals, operators)
│   │   ├── services/        # Orchestrateur de scraping
│   │   │   └── scrapers/    # Logique par opérateur (sosh, red, byou, free)
│   │   ├── routes/          # Routes Express
│   │   └── lib/             # Client Prisma
│   ├── prisma/
│   │   └── schema.prisma    # Schéma BDD (MobilePlan, OperatorSettings)
│   ├── entrypoint.sh        # Script de démarrage (prisma generate + db push)
│   └── Dockerfile
├── frontend/                # Application Nuxt 3 (Port 3000)
│   ├── components/          # Composants Vue
│   │   ├── HeroSection.vue  # Hero néo-brutaliste
│   │   ├── DataSlider.vue   # Slider avec saisie directe au Go près
│   │   ├── DealCard.vue     # Carte forfait (€/Go, lien, SIM price)
│   │   └── OperatorBadge.vue # Badge couleur par opérateur
│   ├── layouts/             # Layout par défaut
│   ├── pages/               # Pages (index, admin)
│   ├── assets/css/          # Styles Tailwind + utilitaires néo-brutalistes
│   ├── tailwind.config.js   # Thème custom
│   └── Dockerfile
├── compose.yml              # Orchestration Docker (db, backend, frontend)
├── CHANGELOG.md             # Historique des modifications
└── README.md
```

## 📋 Roadmap

- [ ] Ajouter les MVNOs restants (Prixtel, La Poste Mobile, NRJ, etc.)
- [ ] Scraping automatique du prix SIM/eSIM par opérateur
- [ ] Notifications (nouveau forfait avantageux détecté)
- [ ] Historique des prix
- [ ] Export CSV/JSON
- [ ] Tests automatisés
- [ ] CI/CD

## 📄 Licence

GNU General Public License v3.0 — voir [LICENSE](LICENSE.txt).

---

**Fait avec ❤️ pour la communauté télécoms française** — Si ce projet vous aide à économiser, n'hésitez pas à ⭐ le repo !