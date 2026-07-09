# Stage 1: Build & Prune
FROM --platform=linux/amd64 node:24-slim AS builder

WORKDIR /app

# Le runtime final fournit deja Chromium via l'image Puppeteer.
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation de toutes les dépendances (y compris dev pour Prisma CLI et tsx)
RUN npm ci

# Copie du schéma Prisma et du code source requis pour la génération
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json prisma.config.ts ./

# Génération du client Prisma
RUN npm run build

# Nettoyage des dépendances de développement pour alléger le dossier node_modules
RUN npm prune --omit=dev && npm cache clean --force

# Stage 2: Final Run Image
FROM --platform=linux/amd64 ghcr.io/puppeteer/puppeteer:latest

USER pptruser
WORKDIR /home/pptruser/app

# Copie des fichiers d'exécution
COPY --chown=pptruser:pptruser package.json entrypoint.sh ./
COPY --chown=pptruser:pptruser --from=builder /app/node_modules ./node_modules
COPY --chown=pptruser:pptruser --from=builder /app/src ./src
COPY --chown=pptruser:pptruser --from=builder /app/prisma ./prisma
COPY --chown=pptruser:pptruser --from=builder /app/prisma.config.ts ./

# Rendre le script d'entrée exécutable
RUN chmod +x entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
CMD [ "npm", "start" ]
