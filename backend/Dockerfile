# Utiliser l'image officielle de Puppeteer qui inclut déjà Chrome et toutes les dépendances.
FROM --platform=linux/amd64 ghcr.io/puppeteer/puppeteer:latest

USER pptruser
WORKDIR /home/pptruser/app

# Copier les fichiers de dépendances
COPY --chown=pptruser:pptruser package*.json ./

# Installer TOUTES les dépendances (prisma CLI est en devDep, nécessaire pour generate)
RUN npm install

# Copier tout le code source
COPY --chown=pptruser:pptruser . .

# Générer le client Prisma
RUN npm run build

# Rendre le script d'entrée exécutable
RUN chmod +x entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
CMD [ "npm", "start" ]
