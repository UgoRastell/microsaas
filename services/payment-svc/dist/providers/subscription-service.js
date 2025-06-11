"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const logger_1 = require("../utils/logger");
class SubscriptionService {
    stripe;
    supabaseClient;
    plans;
    postalDeliveryPricePerInvoice = 0.30;
    // Fonction utilitaire pour vérifier si une chaîne est un UUID valide
    isValidUUID(str) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
    }
    constructor(stripe, supabaseClient) {
        this.stripe = stripe;
        this.supabaseClient = supabaseClient;
        // Définition des plans selon le business model demandé
        this.plans = [
            {
                id: 'freemium',
                type: 'freemium',
                name: 'Freemium',
                description: '5 factures par mois gratuites',
                price: 0,
                currency: 'eur',
                interval: 'month',
                invoiceLimit: 5,
                features: [
                    'Création de factures PDF',
                    'Envoi par email',
                    'Suivi de paiement basique'
                ],
                stripeProductId: '',
                stripePriceId: ''
            },
            {
                id: 'standard',
                type: 'standard',
                name: 'Standard',
                description: '100 factures par mois',
                price: 9,
                currency: 'eur',
                interval: 'month',
                invoiceLimit: 100,
                features: [
                    'Création de factures PDF',
                    'Envoi par email',
                    'Suivi de paiement avancé',
                    'Relances automatiques',
                    '100 factures par mois'
                ],
                stripeProductId: '',
                stripePriceId: ''
            },
            {
                id: 'premium',
                type: 'premium',
                name: 'Premium',
                description: 'Factures illimitées',
                price: 19,
                currency: 'eur',
                interval: 'month',
                invoiceLimit: null, // null signifie illimité
                features: [
                    'Création de factures PDF',
                    'Envoi par email',
                    'Suivi de paiement avancé',
                    'Relances automatiques personnalisables',
                    'Factures illimitées',
                    'Support prioritaire',
                    'Personnalisation avancée'
                ],
                stripeProductId: '',
                stripePriceId: ''
            }
        ];
    }
    /**
     * Initialiser les produits et prix dans Stripe
     * @returns Les plans avec leurs IDs Stripe mis à jour
     */
    async initializeStripePlans() {
        try {
            logger_1.logger.info('Initialisation des plans dans Stripe...');
            for (const plan of this.plans) {
                // Créer ou récupérer le produit
                let product;
                try {
                    product = await this.stripe.products.retrieve(plan.id);
                    logger_1.logger.info(`Produit existant pour ${plan.name}: ${product.id}`);
                }
                catch (error) {
                    product = await this.stripe.products.create({
                        id: plan.id,
                        name: plan.name,
                        description: plan.description,
                        metadata: {
                            type: plan.type,
                            invoice_limit: plan.invoiceLimit ? plan.invoiceLimit.toString() : 'unlimited'
                        }
                    });
                    logger_1.logger.info(`Nouveau produit créé pour ${plan.name}: ${product.id}`);
                }
                // Créer ou récupérer le prix
                let price;
                try {
                    const prices = await this.stripe.prices.list({
                        product: product.id,
                        active: true
                    });
                    price = prices.data[0];
                    if (!price)
                        throw new Error('Aucun prix trouvé');
                    logger_1.logger.info(`Prix existant pour ${plan.name}: ${price.id}`);
                }
                catch (error) {
                    // Créer un nouveau prix seulement si nous n'en trouvons pas
                    if (plan.price > 0) {
                        price = await this.stripe.prices.create({
                            product: product.id,
                            unit_amount: Math.round(plan.price * 100), // En centimes
                            currency: plan.currency,
                            recurring: {
                                interval: plan.interval,
                            },
                            metadata: {
                                plan_id: plan.id,
                            }
                        });
                        logger_1.logger.info(`Nouveau prix créé pour ${plan.name}: ${price.id}`);
                    }
                }
                // Mettre à jour les IDs Stripe dans notre configuration
                plan.stripeProductId = product.id;
                if (price) {
                    plan.stripePriceId = price.id;
                }
            }
            // Créer aussi un produit pour l'envoi postal (addon)
            try {
                const postalProductId = 'postal-delivery';
                try {
                    // Récupérer le produit existant ou en créer un nouveau
                    const productExists = await this.stripe.products.retrieve(postalProductId)
                        .then(() => true)
                        .catch(() => false);
                    if (productExists) {
                        logger_1.logger.info(`Produit existant pour livraison postale: postal-delivery`);
                    }
                    else {
                        await this.stripe.products.create({
                            id: postalProductId,
                            name: 'Envoi Postal',
                            description: 'Option d\'envoi postal de factures via API partenaire (+0,30€ par facture)',
                            metadata: {
                                type: 'addon',
                                price_per_invoice: this.postalDeliveryPricePerInvoice.toString()
                            }
                        });
                        logger_1.logger.info(`Nouveau produit créé pour livraison postale: ${postalProductId}`);
                    }
                }
                catch (error) {
                    logger_1.logger.error('Erreur lors de la création du produit d\'envoi postal');
                }
                logger_1.logger.info('Initialisation des plans dans Stripe terminée avec succès');
                return this.plans;
            }
            catch (error) {
                logger_1.logger.error('Erreur lors de la création du produit d\'envoi postal');
                return this.plans;
            }
        }
        catch (error) {
            logger_1.logger.error(`Erreur lors de l'initialisation des plans Stripe: ${error instanceof Error ? error.message : String(error)}`);
            return this.plans;
        }
    }
    /**
     * Récupérer tous les plans disponibles
     */
    getAvailablePlans() {
        return this.plans;
    }
    /**
     * Récupérer un plan par son ID
     */
    getPlanById(planId) {
        return this.plans.find(plan => plan.id === planId);
    }
    /**
     * Créer un checkout pour un abonnement
     */
    async createSubscriptionCheckout(params) {
        try {
            const plan = this.getPlanById(params.planId);
            if (!plan) {
                throw new Error(`Plan non trouvé: ${params.planId}`);
            }
            // Pour Freemium, pas besoin de checkout
            if (plan.type === 'freemium') {
                // Créer directement l'abonnement dans la base de données
                const subscription = await this.createFreemiumSubscription(params);
                return {
                    id: subscription.id,
                    status: 'success',
                    url: params.successUrl || process.env.PAYMENT_SUCCESS_URL || 'https://autoinvoice.app/subscription/success'
                };
            }
            // Pour les plans payants, créer une session de checkout
            const successUrl = params.successUrl || process.env.PAYMENT_SUCCESS_URL || 'https://autoinvoice.app/subscription/success';
            const cancelUrl = params.cancelUrl || process.env.PAYMENT_CANCEL_URL || 'https://autoinvoice.app/subscription/cancel';
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: plan.stripePriceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: cancelUrl,
                customer_email: params.customerEmail,
                metadata: {
                    organization_id: params.organizationId,
                    customer_id: params.customerId,
                    plan_id: params.planId,
                    ...params.metadata,
                },
                subscription_data: {
                    metadata: {
                        organization_id: params.organizationId,
                        customer_id: params.customerId,
                        plan_id: params.planId,
                        invoice_limit: plan.invoiceLimit ? plan.invoiceLimit.toString() : 'unlimited'
                    }
                }
            });
            return {
                id: session.id,
                status: 'pending',
                url: session.url || '',
            };
        }
        catch (error) {
            logger_1.logger.error(`Erreur lors de la création du checkout d'abonnement: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Créer un abonnement Freemium sans paiement
     */
    async createFreemiumSubscription(params) {
        const plan = this.getPlanById('freemium');
        // Générer un ID d'abonnement unique pour Freemium
        const subscriptionId = `free_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        // Calculer les dates
        const now = new Date();
        const startDate = now;
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        // Créer l'abonnement dans Supabase
        const { data, error } = await this.supabaseClient
            .from('subscriptions')
            .insert({
            id: subscriptionId,
            status: 'active',
            plan_type: 'freemium',
            start_date: startDate.toISOString(),
            current_period_start: startDate.toISOString(),
            current_period_end: endDate.toISOString(),
            canceled_at: null,
            invoice_usage: 0,
            invoice_limit: plan.invoiceLimit,
            organization_id: params.organizationId,
            customer_id: params.customerId,
            stripe_subscription_id: null,
            metadata: {
                ...params.metadata,
                created_at: now.toISOString()
            }
        })
            .select()
            .single();
        if (error) {
            throw new Error(`Erreur lors de la création de l'abonnement Freemium: ${error.message}`);
        }
        return data;
    }
    /**
     * Gérer l'événement de création d'abonnement Stripe
     */
    async handleSubscriptionCreated(event) {
        const subscription = event.data.object;
        logger_1.logger.info(`Abonnement créé: ${subscription.id}`);
        const planId = subscription.metadata.plan_id;
        const plan = this.getPlanById(planId);
        if (!plan) {
            logger_1.logger.warn(`Plan non trouvé pour l'abonnement: ${planId}`);
            return;
        }
        // Créer l'abonnement dans Supabase
        const { data, error } = await this.supabaseClient
            .from('subscriptions')
            .insert({
            id: subscription.id,
            status: subscription.status,
            plan_type: plan.type,
            start_date: new Date(subscription.start_date * 1000).toISOString(),
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            invoice_usage: 0,
            invoice_limit: plan.invoiceLimit,
            organization_id: subscription.metadata.organization_id,
            customer_id: subscription.metadata.customer_id,
            stripe_subscription_id: subscription.id,
            metadata: subscription.metadata
        })
            .select()
            .single();
        if (error) {
            logger_1.logger.error(`Erreur lors de la création de l'abonnement dans Supabase: ${error.message}`);
            throw error;
        }
        return data;
    }
    /**
     * Gérer l'événement de mise à jour d'abonnement Stripe
     */
    async handleSubscriptionUpdated(event) {
        const subscription = event.data.object;
        logger_1.logger.info(`Abonnement mis à jour: ${subscription.id}`);
        // Mettre à jour l'abonnement dans Supabase
        const { data, error } = await this.supabaseClient
            .from('subscriptions')
            .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        })
            .eq('stripe_subscription_id', subscription.id)
            .select()
            .single();
        if (error) {
            logger_1.logger.error(`Erreur lors de la mise à jour de l'abonnement dans Supabase: ${error.message}`);
            throw error;
        }
        return data;
    }
    /**
     * Récupérer l'abonnement actif d'un utilisateur
     * Cette méthode est utilisée par l'endpoint /api/subscriptions/current
     */
    /**
     * Récupérer l'abonnement actif d'un utilisateur
     * Cette méthode est utilisée par l'endpoint /api/subscriptions/current
     */
    async getUserSubscription(userId) {
        logger_1.logger.info(`Récupération de l'abonnement pour userId: ${userId}`);
        try {
            // Essayer de trouver par user_id (colonne UUID)
            try {
                const { data } = await this.supabaseClient
                    .from('subscriptions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('status', 'active')
                    .limit(1)
                    .single();
                if (data) {
                    logger_1.logger.info(`Abonnement trouvé par user_id pour userId: ${userId}: ${data.id} (${data.plan_type})`);
                    return data;
                }
            }
            catch (err) {
                logger_1.logger.info(`Pas d'abonnement trouvé via user_id pour ${userId}, essai via customer_id`);
            }
            // Si aucune trouvée, essayer avec customer_id (désormais colonne UUID)
            // Vérifier d'abord si la chaîne est un UUID valide
            if (this.isValidUUID(userId)) {
                try {
                    const { data } = await this.supabaseClient
                        .from('subscriptions')
                        .select('*')
                        .eq('customer_id', userId) // userId est déjà un format UUID valide
                        .eq('status', 'active')
                        .limit(1)
                        .single();
                    if (data) {
                        logger_1.logger.info(`Abonnement trouvé par customer_id pour userId: ${userId}: ${data.id} (${data.plan_type})`);
                        return data;
                    }
                }
                catch (err) {
                    logger_1.logger.info(`Pas d'abonnement trouvé via customer_id pour ${userId}`);
                }
            }
            else {
                logger_1.logger.warn(`L'identifiant utilisateur ${userId} n'est pas un UUID valide, impossible de rechercher par customer_id`);
            }
            // Si toujours rien, retourner null
            logger_1.logger.warn(`Aucun abonnement trouvé pour userId: ${userId}`);
            return null;
        }
        catch (error) {
            logger_1.logger.error(`Erreur lors de la récupération de l'abonnement: ${error instanceof Error ? error.message : String(error)}`);
            throw new Error(`Erreur lors de la récupération de l'abonnement: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Calculer le coût de l'envoi postal
     */
    calculatePostalDeliveryCost(quantity) {
        return quantity * this.postalDeliveryPricePerInvoice;
    }
    /**
     * Mettre à jour l'utilisation des factures
     */
    async incrementInvoiceUsage(organizationId, count = 1) {
        try {
            // Vérifier si l'organizationId est un UUID valide
            if (!this.isValidUUID(organizationId)) {
                throw new Error(`L'identifiant organisation ${organizationId} n'est pas un UUID valide`);
            }
            // Récupérer l'abonnement actif pour cette organisation
            const { data: subscription, error } = await this.supabaseClient
                .from('subscriptions')
                .select('*')
                .eq('organization_id', organizationId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (error || !subscription) {
                throw new Error(`Abonnement non trouvé pour l'organisation: ${organizationId}`);
            }
            // Vérifier si la limite est atteinte (sauf pour les abonnements illimités)
            if (subscription.invoice_limit !== null &&
                subscription.invoice_usage + count > subscription.invoice_limit) {
                throw new Error(`Limite de factures atteinte (${subscription.invoice_usage}/${subscription.invoice_limit})`);
            }
            // Mettre à jour l'utilisation
            const { error: updateError } = await this.supabaseClient
                .from('subscriptions')
                .update({
                invoice_usage: subscription.invoice_usage + count
            })
                .eq('id', subscription.id);
            if (updateError) {
                throw new Error(`Erreur lors de la mise à jour de l'utilisation des factures: ${updateError.message}`);
            }
            return {
                success: true,
                new_usage: subscription.invoice_usage + count,
                limit: subscription.invoice_limit
            };
        }
        catch (error) {
            logger_1.logger.error(`Erreur lors de l'incrémentation de l'utilisation des factures: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}
exports.SubscriptionService = SubscriptionService;
//# sourceMappingURL=subscription-service.js.map