FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json ./

# Installer les dépendances + dépendances manquantes
RUN npm install && \
    npm install @headlessui/react @heroicons/react tailwindcss postcss autoprefixer

# Copier le reste du code source
COPY . .

# Exposer le port pour Vite
EXPOSE 3000

# Démarrer l'application en mode développement
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
