import Stripe from 'stripe';
import { SubscriptionPlan, CreateSubscriptionParams } from '../interfaces';
import { SupabaseClient } from '@supabase/supabase-js';
export declare class SubscriptionService {
    private stripe;
    private supabaseClient;
    private plans;
    private postalDeliveryPricePerInvoice;
    private isValidUUID;
    constructor(stripe: Stripe, supabaseClient: SupabaseClient);
    /**
     * Initialiser les produits et prix dans Stripe
     * @returns Les plans avec leurs IDs Stripe mis à jour
     */
    initializeStripePlans(): Promise<SubscriptionPlan[]>;
    /**
     * Récupérer tous les plans disponibles
     */
    getAvailablePlans(): SubscriptionPlan[];
    /**
     * Récupérer un plan par son ID
     */
    getPlanById(planId: string): SubscriptionPlan | undefined;
    /**
     * Créer un checkout pour un abonnement
     */
    createSubscriptionCheckout(params: CreateSubscriptionParams): Promise<{
        id: any;
        status: string;
        url: string;
    }>;
    /**
     * Créer un abonnement Freemium sans paiement
     */
    private createFreemiumSubscription;
    /**
     * Gérer l'événement de création d'abonnement Stripe
     */
    handleSubscriptionCreated(event: Stripe.Event): Promise<any>;
    /**
     * Gérer l'événement de mise à jour d'abonnement Stripe
     */
    handleSubscriptionUpdated(event: Stripe.Event): Promise<any>;
    /**
     * Récupérer l'abonnement actif d'un utilisateur
     * Cette méthode est utilisée par l'endpoint /api/subscriptions/current
     */
    /**
     * Récupérer l'abonnement actif d'un utilisateur
     * Cette méthode est utilisée par l'endpoint /api/subscriptions/current
     */
    getUserSubscription(userId: string): Promise<any>;
    /**
     * Calculer le coût de l'envoi postal
     */
    calculatePostalDeliveryCost(quantity: number): number;
    /**
     * Mettre à jour l'utilisation des factures
     */
    incrementInvoiceUsage(organizationId: string, count?: number): Promise<{
        success: boolean;
        new_usage: any;
        limit: any;
    }>;
}
