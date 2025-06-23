# Utiliser l'image officielle de Puppeteer qui inclut déjà Chrome et toutes les dépendances.
# Voir https://github.com/puppeteer/puppeteer/blob/main/docker/README.md
FROM ghcr.io/puppeteer/puppeteer:latest

# L'utilisateur par défaut est 'pptruser', on l'utilise.
USER pptruser

# Le répertoire de travail est déjà défini sur /home/pptruser, on s'y place.
WORKDIR /home/pptruser/app

# Copier les fichiers de package et installer les dépendances
# L'image de base contient déjà un `npm`, nous pouvons l'utiliser.
COPY --chown=pptruser:pptruser package*.json ./
RUN npm install --only=production

# Copier le reste de l'application
COPY --chown=pptruser:pptruser . .

# Compiler le code TypeScript
RUN npm run build

# Copier et rendre le script d'entrée exécutable
COPY --chown=pptruser:pptruser entrypoint.sh .
RUN chmod +x entrypoint.sh

# Exposer le port
EXPOSE 3001

# La variable PUPPETEER_EXECUTABLE_PATH n'est plus nécessaire car l'image la gère.

# Définir le point d'entrée
ENTRYPOINT ["./entrypoint.sh"]

# Commande pour démarrer le serveur, passée à l'entrypoint
CMD [ "npm", "start" ] 