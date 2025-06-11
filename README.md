# AutoInvoice - Système automatisé de génération & suivi de factures pour freelances

## 💡 Présentation

AutoInvoice est une solution SaaS qui permet aux freelances et micro-entreprises de générer, envoyer et suivre automatiquement leurs factures, tout en gérant les relances de paiement.

### Problème résolu

Les freelances passent trop de temps à créer leurs factures, suivre les paiements et relancer leurs clients.

### Solution

Un système automatisé qui, à partir d'un temps passé (TTS), d'un devis ou d'un simple e-mail:
- Génère la facture au format PDF
- L'envoie au client par email
- Suit le statut du paiement
- Relance automatiquement selon des règles définies

### Cible

- Freelances (développeurs, designers, consultants)
- Micro-entreprises < 10 personnes

### Business Model

- **Freemium**: 5 factures/mois gratuites
- **Standard**: 9€/mois → 100 factures
- **Premium**: 19€/mois → factures illimitées
- **Option**: +0,30€/facture pour l'envoi postal via API partenaire

## 🔧 Stack Technique

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Auth & Data**: Supabase (PostgreSQL + Storage + Auth)
- **API Gateway**: Fastify (Node 20, TypeScript)
- **Microservices**:
  - `invoice-svc` (Go): génération PDF via Chromium headless
  - `email-svc` (Node): envoi via Resend
  - `payment-svc` (Python): suivi paiement via Stripe webhooks
  - `reminder-svc` (Rust): scheduler de relances
- **Communication**: NATS JetStream
- **Observabilité**: Grafana + Prometheus + Loki
- **CI/CD**: GitHub Actions + Fly.io
- **IaC**: Terraform Cloud

## 🚀 Installation

### Prérequis

- Node.js 20+
- Docker et Docker Compose
- Compte Supabase
- Compte Fly.io (pour le déploiement)

### Installation locale

```bash
# Cloner le repository
git clone https://github.com/votre-username/autoinvoice.git
cd autoinvoice
```

### Configuration avec Supabase

1. Créez un projet sur [Supabase](https://supabase.io) et récupérez les informations d'API suivantes :
   - URL du projet Supabase
   - Clé d'API anonyme (anon key)
   - Clé de service (service key)

2. Copiez le fichier d'exemple et configurez vos variables d'environnement :

```bash
cp .env.example .env
```

3. Éditez le fichier `.env` et remplacez les valeurs suivantes :
   - `SUPABASE_SERVICE_KEY`: Votre clé de service Supabase
   - `VITE_SUPABASE_URL`: L'URL de votre projet Supabase
   - `VITE_SUPABASE_ANON_KEY`: Votre clé anonyme Supabase
   - D'autres clés API si nécessaire (Resend, Stripe, etc.)

### Démarrage avec Docker

Utilisez Docker Compose pour démarrer tous les services :

```bash
# Construire et démarrer tous les conteneurs
docker-compose up -d --build

# Pour voir les logs
docker-compose logs -f

# Pour arrêter tous les services
docker-compose down
```

Une fois lancés, les services seront disponibles :
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000

## 📊 Roadmap

| Sprint | Livrables                                       | Notes                        |
| ------ | ----------------------------------------------- | ---------------------------- |
| S-1    | Auth Supabase, React + Tailwind, dashboard vide | POC login                    |
| S-2    | Modèle `customers`, CRUD React-Query            | Table editable               |
| S-3    | Service `invoice-svc`, template HTML            | Génération locale sans email |
| S-4    | email-svc, envoi via Resend Sandbox             | .env secret                  |
| S-5    | Stripe intégration, webhook tunnel (ngrok)      | Statut "paid"                |
| S-6    | reminder-svc, cron, NATS JetStream durable      | alertes                      |
| S-7    | Observabilité pack (Grafana-Loki)               | dash latency                 |
| S-8    | Mise en production Fly.io + Terraform Cloud     | blue/green                   |

## 📝 License

MIT
