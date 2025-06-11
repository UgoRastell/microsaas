# Docker Setup pour AutoInvoice

Ce guide vous explique comment configurer et exécuter le projet AutoInvoice avec Docker en utilisant vos paramètres de connexion Supabase.

## Prérequis

- Docker et Docker Compose installés sur votre machine
- Un compte Supabase avec les informations de connexion
- Les clés API pour Resend et Stripe

## Configuration

1. **Créez un fichier `.env` à partir du modèle**

Copiez le fichier `.env.example` et renommez-le en `.env` :

```bash
cp .env.example .env
```

2. **Remplissez les variables d'environnement**

Ouvrez le fichier `.env` et complétez les variables suivantes :

```
# Supabase
SUPABASE_SERVICE_KEY=votre_service_key_ici
# Choisissez l'une des options de connexion ci-dessous:

# Option 1: Direct connection (recommandé pour les VM et containers long-terme)
SUPABASE_DB_URL=postgresql://postgres:votre_mot_de_passe@db.kttyjxnpbvqzdlemfxqt.supabase.co:5432/postgres

# Option 2: Transaction pooler (recommandé pour les fonctions serverless)
# SUPABASE_DB_URL=postgresql://postgres.kttyjxnpbvqzdlemfxqt:votre_mot_de_passe@aws-0-us-east-2.pooler.supabase.com:6543/postgres

# Option 3: Session pooler (alternative pour réseaux IPv4)
# SUPABASE_DB_URL=postgresql://postgres.kttyjxnpbvqzdlemfxqt:votre_mot_de_passe@aws-0-us-east-2.pooler.supabase.com:5432/postgres

# JWT
JWT_SECRET=une_chaine_secrete_aleatoire

# API Keys
RESEND_API_KEY=votre_cle_resend_ici
STRIPE_API_KEY=votre_cle_stripe_ici
STRIPE_WEBHOOK_SECRET=votre_secret_webhook_stripe_ici
```

## Construire et démarrer les conteneurs

1. **Construire tous les services**

```bash
docker-compose build
```

2. **Démarrer l'ensemble des services**

```bash
docker-compose up -d
```

Pour voir les logs en temps réel :

```bash
docker-compose logs -f
```

3. **Pour arrêter tous les services**

```bash
docker-compose down
```

## Choix de la méthode de connexion Supabase

Selon votre cas d'utilisation :

- **Direct connection** : Idéale pour les applications avec des connexions persistantes et durables, comme des conteneurs Docker qui restent actifs longtemps. Offre les meilleures performances mais nécessite IPv6.

- **Transaction pooler** : Recommandé pour les applications serverless où chaque interaction avec PostgreSQL est brève et isolée. Adapté pour un grand nombre de clients connectés simultanément.

- **Session pooler** : Alternative à la connexion directe lorsque vous êtes sur un réseau IPv4. Utilise un proxy IPv4 gratuit.

## Structure des services

Le projet se compose de plusieurs microservices :

- **api-gateway** : Point d'entrée pour les clients (port 8000)
- **invoice-svc** : Service de génération et gestion des factures
- **email-svc** : Service d'envoi d'emails
- **payment-svc** : Service de traitement des paiements
- **reminder-svc** : Service d'envoi automatique de rappels
- **nats** : Broker de messages pour la communication inter-services

## Accès aux services

- API Gateway : http://localhost:8000
- NATS Monitoring : http://localhost:8222
