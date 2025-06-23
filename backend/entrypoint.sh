#!/bin/sh
# entrypoint.sh

# Affiche une bannière pour le débogage
echo "--- Lancement du script d'entrée ---"

# Lance la génération du client Prisma
echo "1. Génération du client Prisma..."
npx prisma generate

# Vérifie que la génération a réussi (code de sortie 0)
if [ $? -ne 0 ]; then
  echo "ERREUR: La génération du client Prisma a échoué."
  exit 1
fi
echo "Génération du client Prisma terminée."

# Lance l'application Node.js
# `exec "$@"` exécute la commande passée en arguments au script (le CMD du Dockerfile)
echo "2. Lancement de l'application Node.js..."
exec "$@" 