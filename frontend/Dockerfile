# Étape 1: Construire l'application Astro
FROM node:18-slim AS builder

WORKDIR /app

# Copier les fichiers de package et installer les dépendances
COPY package*.json ./
RUN npm install

# Copier le reste du code source
COPY . .

# Construire l'application
RUN npm run build

# Étape 2: Servir l'application avec un serveur de production léger
FROM node:18-alpine AS runner

WORKDIR /app

# Copier les dépendances de production depuis l'étape builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copier les fichiers de l'application construite
COPY --from=builder /app/dist ./dist

# Créer un package.json minimal pour le serveur de production
# Astro recommande d'utiliser un serveur Node.js pour le preview
RUN echo '{ "name": "astro-prod-server", "version": "1.0.0", "private": true, "scripts": { "start": "node ./dist/server/entry.mjs" } }' > package.json

# Exposer le port
EXPOSE 4321

# Commande pour démarrer le serveur en mode preview
CMD ["npm", "start"] 