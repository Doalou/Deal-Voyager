  # Deal-Voyager

> **Vos forfaits mobiles sans embrouilles.**

Deal-Voyager est un comparateur de forfaits mobiles francais 100% independant. Il scrape automatiquement les prix des operateurs (MNO/MVNO) et les classe au centime pres pour vous aider a trouver l'offre la plus honnete — sans partenariat financier, sans publicite, et sans bullshit.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Vue.js](https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vue.js&logoColor=4FC08D)
![Nuxt](https://img.shields.io/badge/Nuxt_4-00DC82?style=for-the-badge&logo=nuxt.js&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![Puppeteer](https://img.shields.io/badge/Puppeteer-40B5A4?style=for-the-badge&logo=puppeteer&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

---

## Fonctionnalites Principales

- **Scraping Automatisé & Furtif** — Puppeteer + Stealth Plugin pour contourner les protections anti-bot de 12 opérateurs. Cron horaire + déclenchement manuel. Détection automatique 4G/5G et Data Europe/DOM.
- **Classement Transparent (Coût Réel sur 1 An)** — Tri basé sur le coût annuel total : prix mensuel x 12 + carte SIM + frais d'activation + frais de résiliation. Score euro/Go calculé.
- **Design Néobrutaliste & Dark Mode** — Interface avec bordures épaisses, contrastes forts, ombres nettes et Dark Mode dynamique. Inclut une page 404 sur-mesure.
- **Filtrage Avancé** — Slider interactif (0 à 500 Go) avec saisie directe au Go près et filtre exclusif par réseau (Orange, SFR, Bouygues, Free).
- **Bot Discord Dédié** — Bot Discord formatant les alertes de nouveaux forfaits en temps réel pour vos serveurs.
- **Liens Directs Sans Affiliation** — Accès en un clic aux pages opérateurs, zéro tracking.
- **Control Room** — Panneau d'administration hybride (accessible uniquement via `/admin` et protégé par Basic Auth) avec suivi du scraping en temps réel, gestion des frais par opérateur, label "Fairplay", et bouton de purge de la base.
- **Déploiement Docker Sécurisé** — Stack complète (Frontend, Backend, BDD) avec credentials configurables via `.env`, proxy interne Nitro, et zéro port exposé inutilement.

---

## Operateurs Couverts

| Operateur | Type | Reseau | Detection 4G/5G |
|-----------|------|--------|-----------------|
| **Sosh** | MNO low-cost | Orange | Oui |
| **RED by SFR** | MNO low-cost | SFR | Oui |
| **B&You** | MNO low-cost | Bouygues Telecom | Oui |
| **Free Mobile** | MNO | Free | Oui |
| **YouPrice** | MVNO | Orange / SFR / Bouygues | Oui (multi-reseau) |
| **Coriolis** | MVNO | SFR | Oui |
| **La Poste Mobile** | MVNO | Bouygues Telecom | Oui |
| **NRJ Mobile** | MVNO | Bouygues Telecom | Oui |
| **Auchan Telecom** | MVNO | Bouygues Telecom | Oui |
| **Cdiscount Mobile** | MVNO | Bouygues Telecom | Oui |
| **Syma Mobile** | MVNO | SFR | Oui |
| **Lebara** | MVNO | SFR | Oui |

---

## Architecture

```text
                    ┌─────────────────────────┐
                    │     Navigateur (port    │
                    │     configurable)       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐                  ┌───────────────┐
                    │   Frontend Nuxt (SSR)   │                  │  API Discord  │
                    │   Proxy /api/v1/** ─────┼──► Backend ──────► (Bot alerts & │
                    │   Auth HTTP Basic       │    Express:3001  │  Webhooks)    │
                    └────────────┬────────────┘        │         └───────────────┘
                                 │                     ▼
┌────────────────┐  ┌────────────▼────────────┐  ┌────────────────┐
│ matomo_db:3306 ◄──┼        matomo:80        │  │ PostgreSQL:5432│
└────────────────┘  └─────────────────────────┘  └────────────────┘
```

Seul le port du frontend est exposé. Le backend et PostgreSQL communiquent exclusivement via le réseau Docker interne. Le Backend effectue lui-même ses requêtes sortantes vers l'API de Discord.

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Frontend** | Nuxt 4 (Vue 3) + Tailwind CSS | Interface utilisateur, SSR, proxy API via Nitro `routeRules` |
| **Backend** | Node.js + Express 5 + discord.js | API REST, orchestration du scraping, alertes via Discord Bot, rate limiting |
| **Scrapers** | Puppeteer + Stealth Plugin | Extraction DOM + analyse textuelle heuristique par opérateur |
| **BDD** | PostgreSQL 15 + Prisma ORM | Stockage des forfaits (`MobilePlan`), paramétrage (`OperatorSettings`) et serveurs Discord cibles (`DiscordSubscription`) |
| **Infra** | Docker Compose | Conteneurisation, réseau interne, healthchecks |

---

## Demarrage Rapide

### Prerequis

- [Docker](https://www.docker.com/products/docker-desktop/) (Engine + Compose)
- **4 Go de RAM** minimum (instances Chromium headless pendant le scraping)

### 1. Configuration

```bash
git clone https://github.com/votre-username/Deal-Voyager.git
cd Deal-Voyager
cp .env.example .env
```

Editez le fichier `.env` avec vos propres credentials :

```env
# Admin credentials (OBLIGATOIRE)
ADMIN_USERNAME=votre_identifiant
ADMIN_PASSWORD=votre_mot_de_passe

# Base de données PostgreSQL (OBLIGATOIRE)
POSTGRES_USER=dealvoyager
POSTGRES_PASSWORD=votre_mdp_postgres
POSTGRES_DB=deal_voyager

# Configuration Discord Bot (Requis pour /deal-setup et les alertes automatiques)
DISCORD_CLIENT_ID=votre_client_id_discord
DISCORD_BOT_TOKEN=votre_token_bot_discord

# Port public (optionnel, défaut: 3000)
# APP_PORT=3000

# Analytique Matomo (Optionnel)
MATOMO_DB_PASSWORD=votre_mot_de_passe_matomo_db
# MATOMO_PORT=8080
# MATOMO_URL=http://localhost:8080
# MATOMO_SITE_ID=1
```

> **Important :** Le déploiement refuse de démarrer si les variables obligatoires ne sont pas définies.

### 2. Lancement

```bash
docker compose up -d --build
```

Le conteneur `backend` execute automatiquement `prisma db push` au demarrage pour creer/mettre a jour le schema.

### 3. Acces

| Service | URL |
|---------|-----|
| **Comparateur** | [http://localhost:3000](http://localhost:3000) |
| **Control Room** | [http://localhost:3000/admin](http://localhost:3000/admin) |

L'API n'est pas exposee directement — toutes les requetes `/api/v1/*` passent par le proxy Nuxt.

### 4. Premier Scraping

1. Rendez-vous sur la [Control Room](http://localhost:3000/admin) (authentification HTTP Basic).
2. Cliquez sur **Lancer l'extraction maintenant**.
3. Patientez 1 a 2 minutes — la page suit la progression automatiquement.
4. Les offres apparaissent sur l'accueil une fois le scraping termine.

### 5. Configuration de Matomo (Optionnel)

L'analytique est desactivee par defaut pour respecter la vie privee. Pour l'activer via les conteneurs Docker inclus :
1. Accedez a l'interface d'installation sur `http://localhost:8080` (port modifiable via `MATOMO_PORT`).
2. Lors de l'etape "Configuration de la base de donnees" de l'installateur Matomo, utilisez ces valeurs :
   - Serveur de base de donnees : `matomo_db`
   - Identifiant : `matomo`
   - Mot de passe : *La valeur de MATOMO_DB_PASSWORD definie dans votre .env*
   - Nom de la base de donnees : `matomo`
3. Lors de la creation du site, utilisez `http://frontend:3000` comme URL du site (c'est l'adresse Docker interne qui permet a Matomo de verifier le script de suivi).
4. Renseignez les variables dans votre fichier `.env` :
   ```env
   MATOMO_URL=http://localhost:8080
   MATOMO_SITE_ID=1
   ```
5. Appliquez les changements en reconstruisant le frontend :
   ```bash
   docker compose up -d --build frontend
   ```

### 6. Configuration du Bot Discord (Optionnel)

Pour permettre à votre communauté de recevoir des alertes automatiques lors de changements de prix :
1. Créez une application sur le [Discord Developer Portal](https://discord.com/developers/applications).
2. Ajoutez un Bot à l'application et récupérez son Token.
3. Renseignez les variables correspondantes dans votre `.env` :
   ```env
   DISCORD_CLIENT_ID=votre_client_id
   DISCORD_BOT_TOKEN=votre_token_app
   ```
4. Redémarrez vos conteneurs (`docker compose up -d --build`). Le bouton "Inviter le Bot" de l'accueil utilisera désormais votre Client ID.
5. Une fois le bot invité sur un serveur Discord, un administrateur doit taper la commande `/deal-setup` dans le salon souhaité pour activer l'envoi des notifications automatiques (Format Embed Néo-Brutaliste).

---

## Securité & Privacy

| Mesure | Détail |
|--------|--------|
| **Pas de credentials par défaut** | Aucun fallback `admin/secret`. Variables d'environnement obligatoires. |
| **Comparaison timing-safe** | Mots de passe comparés via XOR constant-time (backend + frontend). |
| **Sécurité par l'obscurité** | Le bouton `/admin` n'est pas affiché publiquement dans l'interface. |
| **Rate limiting** | 10 tentatives max par IP sur 15 min (backend). |
| **Proxy interne** | Le backend n'est pas exposé — tout passe par le proxy Nitro du frontend. |
| **PostgreSQL isolé** | Port 5432 non exposé, accessible uniquement via le réseau Docker. |
| **CORS restreint** | Whitelist configurable au lieu de `origin: *`. |
| **Auth header transmis** | Le header HTTP Basic du navigateur est stocké côté serveur (`useState`) et réutilisé pour les appels API. |

---

## Endpoints API (`/api/v1`)

Tous accessibles via le proxy frontend. Les routes marquees d'un cadenas necessitent l'authentification Basic.

| Methode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| `GET` | `/deals` | | Toutes les offres triees par score. |
| `GET` | `/stats` | | Etat du backend (nombre d'offres, dernier scraping, statut). |
| `GET` | `/operators` | | Configuration par operateur (SIM, frais, fairplay). |
| `POST` | `/scrape` | Oui | Declenche le scraping global. |
| `PUT` | `/operators/:name/simprice` | Oui | Met a jour les frais (SIM, activation, resiliation). |
| `PUT` | `/operators/:name/fairplay` | Oui | Bascule le label Fairplay. |
| `DELETE` | `/clear` | Oui | Purge la base de donnees. |

---

## Structure du Projet

```text
Deal-Voyager/
├── backend/
│   ├── src/
│   │   ├── controllers/        # Logique de reponse HTTP
│   │   ├── middlewares/        # Auth Basic + rate limiting
│   │   ├── services/
│   │   │   └── scrapers/       # Un fichier par operateur
│   │   │       ├── sosh.scraper.ts
│   │   │       ├── red.scraper.ts
│   │   │       ├── byou.scraper.ts
│   │   │       ├── free.scraper.ts
│   │   │       ├── youprice.scraper.ts
│   │   │       ├── coriolis.scraper.ts
│   │   │       └── types.ts
│   │   ├── routes/
│   │   └── lib/                # Prisma Client
│   ├── prisma/schema.prisma
│   ├── entrypoint.sh
│   └── Dockerfile
│
├── frontend/
│   ├── components/             # DealCard, DataSlider, OperatorBadge...
│   ├── layouts/
│   ├── middleware/             # Auth HTTP Basic (route middleware)
│   ├── pages/                 # Accueil + Admin
│   ├── assets/css/
│   └── Dockerfile
│
├── compose.yml
├── .env.example                # Template de configuration
├── CHANGELOG.md
└── README.md
```

---

## Deploiement sur un Serveur

Pour exposer Deal-Voyager sur un domaine avec HTTPS, ajoutez un reverse proxy (Caddy recommande) devant le frontend :

```yaml
# Exemple Caddyfile
deal-voyager.mondomaine.fr {
    reverse_proxy frontend:3000
}
```

Pensez a :
- Rediriger les ports 80/443 sur votre routeur
- Pointer le DNS vers l'IP publique de votre serveur
- Mettre a jour `APP_PORT` si necessaire

---

## Roadmap

- [ ] Automatisation de la tarification SIM/eSIM pendant le scraping
- [ ] Notifications Telegram/Discord pour les offres exceptionnelles
- [ ] Historisation des prix et graphiques de tendances
- [ ] Export CSV/JSON de l'inventaire
- [ ] CI/CD & tests E2E (Playwright)
- [ ] Ajout d'operateurs : Prixtel, Mint Mobile, Réglo Mobile...

---

## Licence

**GNU General Public License v3.0** — Voir [LICENSE](LICENSE.txt).

---

**Fait avec soin pour la communaute telecoms francaise.**
