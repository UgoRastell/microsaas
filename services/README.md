# AutoInvoice Backend Microservices

Ce répertoire contient l'infrastructure backend de l'application AutoInvoice, implémentée sous forme d'architecture microservices communiquant via NATS.

## Architecture

L'architecture backend d'AutoInvoice comprend plusieurs microservices spécialisés :

- **API Gateway** (`api-gateway`) : Point d'entrée unique pour les requêtes frontend, authentification JWT et routage vers les microservices appropriés via NATS
- **Service de Facturation** (`invoice-svc`) : Gestion et génération de factures en PDF avec Puppeteer
- **Service d'Email** (`email-svc`) : Envoi d'emails aux clients utilisant Resend
- **Service de Paiement** (`payment-svc`) : Traitement des paiements via Stripe
- **Service de Rappel** (`reminder-svc`) : Envoi automatisé de rappels pour les factures impayées

![Architecture Microservices](https://mermaid.ink/img/pako:eNqNVE1vozAQ_SsWF1bKibL0wC2kcmFTdVvt9rBVDzMwJFYBg2zTNGr437cGQhLCtit8MD5v3ps3H4wTFhrDNPMYzeXJqmT6XfHCCLWR6ihhiBeVSRooZb5PNNsg-QsDGOWHUiCs_qvB54iSdkjFAbxRRU8rcYJgCVizeDKNouB_8HMS4OtvFJzLdN6jbdWOujQGtqCZtRg5cHPrhmXW92hacW6kBPBGsQ1yD0-NM3qayHUcPwXjIIyer-Ez-PCNoiBcxY--dwBmO-A-Fjcle31Cr8QJbngFbs6o8O75-mQplfbZxinRdauNUN7kNJ7PwuXCAZ-c2i74G0B8pS1odlDVHrSVal8w_l4YeVQVc7jj0f6DHpJrpfM0QNFiupxHP0BpkM2BLlbTIJhP5uh7Qu4nuKoCbbPjG-AsBW03H8_CGN2Nx7MzLB_d3XvofroKl7PwJ0Iuvj0FXwCfcV0FDafj3LbhwFUSjuy5_DEKosfokfEjLSweejYcSlQ07wy0grXLO8OdYW0Ic24RLT641c24nLkntbK1Kofv8KuRRteybnOJWc246opeGQvDLjac3PutTuUe7pmKFlVeSNEww5xaMntnDGBGtsJCIZn_JoXGo8TgNvBn4s_WHDnyfpmyba7krmLdtet32OR6vNwoJffMS_WnUrbjAQPHzl4KSn1LN27Sho30S_or9U_MeWVEx_QGzuqSCeCe9SDOgu49-m6XoXTdH6MVG6M?type=png)

## Communication

Les microservices communiquent exclusivement par messages asynchrones via NATS JetStream. L'API Gateway traduit les requêtes HTTP REST en messages NATS.

### Principaux sujets NATS

- `invoice.*` - Requêtes et événements liés aux factures
- `email.send.*` - Requêtes d'envoi d'emails
- `payment.*` - Création et notification de paiements
- `reminder.*` - Événements liés aux rappels de factures

## Configuration

Chaque microservice nécessite des variables d'environnement spécifiques définies dans les fichiers `.env.example`.

### Dépendances externes

- **Supabase** : Authentification, base de données PostgreSQL et stockage d'objets
- **NATS Server** : Communication entre microservices
- **Resend** : Service d'envoi d'emails
- **Stripe** : Traitement des paiements

## Structure du code

Chaque microservice suit une structure similaire :

```
service-name/
├── src/
│   ├── index.ts        # Point d'entrée principal
│   ├── handlers/       # Gestionnaires de messages
│   ├── utils/          # Utilitaires partagés
│   └── ...             # Autres fichiers spécifiques au service
├── package.json        # Dépendances npm
└── tsconfig.json       # Configuration TypeScript
```

## Installation et démarrage

1. Installez les dépendances pour chaque service :
   ```bash
   cd services/api-gateway && npm install
   cd services/invoice-svc && npm install
   cd services/email-svc && npm install
   cd services/payment-svc && npm install
   cd services/reminder-svc && npm install
   ```

2. Configurez les variables d'environnement en copiant les fichiers `.env.example` en `.env` et en les ajustant.

3. Démarrez les services :
   ```bash
   # Dans des terminaux séparés
   cd services/api-gateway && npm run dev
   cd services/invoice-svc && npm run dev
   cd services/email-svc && npm run dev
   cd services/payment-svc && npm run dev
   cd services/reminder-svc && npm run dev
   ```

## Schéma de base de données

Les tables principales dans Supabase :

- `organizations` - Organisations utilisant le système
- `customers` - Clients des organisations
- `invoices` - Factures émises
- `invoice_items` - Lignes individuelles des factures
- `payments` - Transactions de paiement
- `invoice_reminders` - Historique des rappels envoyés

## À venir

- Tests unitaires et d'intégration
- CI/CD avec GitHub Actions
- Déploiement via Fly.io ou Terraform Cloud
- Observabilité avec Grafana, Prometheus et Loki
