# 🚀 Deal-Voyager

**Votre copilote pour trouver le meilleur forfait mobile en France**

Deal-Voyager est une application web moderne qui scrape automatiquement les offres des opérateurs mobiles français (MNO/MVNO) et les classe selon un score **€/Go** pour vous aider à trouver le forfait le plus avantageux.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Astro](https://img.shields.io/badge/Astro-FF5D01?style=for-the-badge&logo=astro&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)

## ✨ Fonctionnalités

- 🔍 **Scraping automatisé** des offres mobiles de 13+ opérateurs français
- 📊 **Scoring intelligent** basé sur le ratio €/Go
- 🎨 **Interface moderne** avec thème sombre et design responsive
- 🏷️ **Identification visuelle** des opérateurs par couleur
- 🔄 **Tri et filtrage** des offres en temps réel
- 🐳 **Déploiement Docker** one-click
- ⚡ **Performance optimisée** avec mise en cache

## 🏗️ Architecture

### Stack Technologique

- **Backend** : Node.js + TypeScript + Express.js + Prisma ORM
- **Scraping** : Puppeteer avec plugins anti-détection
- **Frontend** : Astro + React + TypeScript + Tailwind CSS + shadcn/ui
- **Base de données** : PostgreSQL
- **Déploiement** : Docker + Docker Compose

### Opérateurs Supportés

| Opérateur | Type | Statut |
|-----------|------|--------|
| Sosh | MNO (Orange) | ✅ Actif |
| RED by SFR | MNO (SFR) | ✅ Actif |
| B&You | MNO (Bouygues) | ✅ Actif |
| Free Mobile | MNO | ✅ Actif |
| Prixtel | MVNO | 🔄 En développement |
| La Poste Mobile | MVNO | 🔄 En développement |
| NRJ Mobile | MVNO | 🔄 En développement |
| Et 6 autres... | MVNO | 🔄 En développement |

## 🚀 Démarrage Rapide

### Prérequis

- Docker & Docker Compose
- Git
- 4GB RAM disponible minimum

### Installation

1. **Cloner le repository**
```bash
git clone https://github.com/votre-username/Deal-Voyager.git
cd Deal-Voyager
```

2. **Configurer l'environnement**
```bash
# Copier le fichier d'exemple
cp .env.example .env
# Éditer si nécessaire (les valeurs par défaut fonctionnent)
```

3. **Lancer avec Docker Compose**
```bash
docker-compose up --build
```

4. **Accéder à l'application**
- **Frontend** : http://localhost:4321
- **API Backend** : http://localhost:3001

### Premier Scraping

1. Rendez-vous sur http://localhost:4321
2. Cliquez sur **"Lancer le scraping"** (peut prendre 5-10 minutes)
3. Rafraîchissez la page pour voir les offres

## 📡 API

### Endpoints Disponibles

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v1/deals` | Récupère toutes les offres triées par score |
| `POST` | `/api/v1/scrape` | Lance le scraping en arrière-plan |

### Exemple de Réponse

```json
{
  "id": 1,
  "operator": "Sosh",
  "planName": "Le 100Go",
  "price": 19.99,
  "dataGb": 100,
  "calls": "Illimités",
  "sms": "Illimités",
  "network": "Orange",
  "score": 0.20,
  "url": "https://www.sosh.fr/forfaits-mobiles",
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## 🛠️ Développement

### Structure du Projet

```
Deal-Voyager/
├── backend/                 # API Express.js + Scraper
│   ├── src/
│   │   ├── controllers/     # Contrôleurs API
│   │   ├── services/        # Logique de scraping
│   │   ├── routes/          # Routes Express
│   │   └── lib/             # Utilitaires (Prisma, etc.)
│   ├── prisma/
│   │   └── schema.prisma    # Schéma de base de données
│   └── Dockerfile
├── frontend/                # Application Astro
│   ├── src/
│   │   ├── components/      # Composants React
│   │   ├── layouts/         # Layouts Astro
│   │   ├── pages/           # Pages Astro
│   │   └── styles/          # CSS globaux
│   └── Dockerfile
├── docker-compose.yml       # Orchestration Docker
└── README.md
```

### Développement Local

1. **Backend (mode développement)**
```bash
cd backend
npm install
npm run dev
```

2. **Frontend (mode développement)**
```bash
cd frontend
npm install
npm run dev
```

3. **Base de données**
```bash
# Démarrer PostgreSQL
docker run -d -p 5432:5432 -e POSTGRES_DB=deal_voyager -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password postgres:15-alpine

# Appliquer les migrations
cd backend
npx prisma migrate dev
```

### Ajouter un Nouvel Opérateur

1. Créer une fonction de scraping dans `backend/src/services/scraper.service.ts`
2. Ajouter la configuration dans le tableau `scraperConfigs`
3. Ajouter la couleur de l'opérateur dans `frontend/src/components/DealCard.tsx`

Exemple :
```typescript
const nouveauOperateurScrapeLogic: ScraperConfig['scrapeFunction'] = async (page) => {
  // Votre logique de scraping ici
  return plans.map(plan => ({ 
    ...plan, 
    operator: 'Nouvel Opérateur', 
    network: 'Réseau' 
  }));
};
```

## 🔧 Configuration

### Variables d'Environnement

```bash
# Base de données
DATABASE_URL=postgresql://user:password@db:5432/deal_voyager

# Serveur backend
PORT=3001

# Mode développement (optionnel)
NODE_ENV=development
```

### Personnalisation du Scraping

- **Fréquence** : Modifiez le cron dans `backend/src/index.ts`
- **Timeout** : Ajustez les délais dans `scraper.service.ts`
- **User Agent** : Personnalisez dans la fonction `launchBrowser`

## 📊 Métriques et Monitoring

- **Logs** : `docker-compose logs -f backend`
- **Base de données** : Accès via client PostgreSQL sur le port 5432
- **Métriques de scraping** : Consultez les logs du backend

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez :

1. Forker le projet
2. Créer une branche feature (`git checkout -b feature/amelioration`)
3. Commiter vos changements (`git commit -m 'Ajout de fonctionnalité'`)
4. Pousser vers la branche (`git push origin feature/amelioration`)
5. Ouvrir une Pull Request

### Guidelines

- Respecter la convention de nommage TypeScript
- Tester les nouveaux scrapers avec des données réelles
- Documenter les nouvelles fonctionnalités
- Maintenir la compatibilité Docker

## 📋 TODO / Roadmap

- [ ] Ajouter les 6 MVNOs restants
- [ ] Système de notifications (nouveau forfait avantageux)
- [ ] API GraphQL
- [ ] Comparaison historique des prix
- [ ] Export des données (CSV, JSON)
- [ ] Interface d'administration
- [ ] Tests automatisés complets
- [ ] CI/CD avec GitHub Actions

## 🚨 Avertissements

- Le scraping doit respecter les `robots.txt` et les conditions d'utilisation
- Utilisez des délais appropriés pour éviter la surcharge des serveurs
- Les prix et offres peuvent changer rapidement
- Ce projet est à des fins éducatives et de comparaison

## 📄 Licence

Ce projet est sous licence **GNU General Public License v3.0**. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Puppeteer](https://pptr.dev/) pour le scraping web
- [Astro](https://astro.build/) pour le framework frontend
- [shadcn/ui](https://ui.shadcn.com/) pour les composants UI
- [Prisma](https://www.prisma.io/) pour l'ORM moderne

---

**Fait avec ❤️ pour la communauté telco française**

Si ce projet vous aide à économiser sur votre forfait mobile, n'hésitez pas à ⭐ le repository ! 