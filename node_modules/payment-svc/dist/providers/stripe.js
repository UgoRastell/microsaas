"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripePaymentProvider = void 0;
const stripe_1 = __importDefault(require("stripe"));
const logger_1 = require("../utils/logger");
/**
 * Stripe payment provider implementation
 */
class StripePaymentProvider {
    stripe;
    webhookSecret;
    constructor() {
        const apiKey = process.env.STRIPE_API_KEY;
        if (!apiKey) {
            throw new Error('STRIPE_API_KEY environment variable is not set');
        }
        this.stripe = new stripe_1.default(apiKey, {
            apiVersion: '2023-10-16',
        });
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
        if (!this.webhookSecret && process.env.NODE_ENV === 'production') {
            logger_1.logger.warn('STRIPE_WEBHOOK_SECRET environment variable is not set. Webhook validation will be skipped.');
        }
    }
    /**
     * Create a checkout session for an invoice
     */
    async createCheckoutSession(params) {
        try {
            logger_1.logger.info(`Creating Stripe checkout session for invoice ${params.invoice_id}`);
            const successUrl = params.success_url || process.env.PAYMENT_SUCCESS_URL || 'https://autoinvoice.app/payment/success';
            const cancelUrl = params.cancel_url || process.env.PAYMENT_CANCEL_URL || 'https://autoinvoice.app/payment/cancel';
            // Prepare checkout session parameters
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: params.currency.toLowerCase(),
                            product_data: {
                                name: params.description || `Invoice #${params.invoice_id}`,
                            },
                            unit_amount: Math.round(params.amount * 100), // Convert to cents
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: cancelUrl,
                customer_email: params.customer_email,
                metadata: {
                    invoice_id: params.invoice_id,
                    organization_id: params.organization_id,
                    customer_id: params.customer_id,
                    ...params.metadata,
                },
            });
            logger_1.logger.info(`Created Stripe checkout session: ${session.id}`);
            return {
                sessionId: session.id,
                url: session.url || '',
                provider: 'stripe',
                expiresAt: session.expires_at || Math.floor(Date.now() / 1000) + 3600, // Default expiration: 1 hour
            };
        }
        catch (error) {
            logger_1.logger.error(`Error creating Stripe checkout session: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Retrieve information about a payment
     */
    async retrievePayment(paymentId) {
        try {
            logger_1.logger.info(`Retrieving Stripe payment: ${paymentId}`);
            // Determine if the ID is a session ID or a payment intent ID
            if (paymentId.startsWith('cs_')) {
                // It's a checkout session ID
                const session = await this.stripe.checkout.sessions.retrieve(paymentId, {
                    expand: ['payment_intent'],
                });
                const paymentIntent = session.payment_intent;
                if (!paymentIntent) {
                    throw new Error(`No payment intent found for session: ${paymentId}`);
                }
                return this.mapPaymentIntentToDetails(paymentIntent, session);
            }
            else if (paymentId.startsWith('pi_')) {
                // It's a payment intent ID
                const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
                return this.mapPaymentIntentToDetails(paymentIntent);
            }
            else {
                throw new Error(`Invalid payment ID format: ${paymentId}`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error retrieving Stripe payment: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Handle webhook events from Stripe
     */
    async handleWebhookEvent(payload, signature) {
        try {
            logger_1.logger.info('Processing Stripe webhook event');
            let event;
            // Verify the event signature
            if (this.webhookSecret) {
                try {
                    event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
                }
                catch (error) {
                    logger_1.logger.error(`Webhook signature verification failed: ${error instanceof Error ? error.message : String(error)}`);
                    throw new Error('Invalid signature');
                }
            }
            else {
                // If no webhook secret, parse the payload directly (development only)
                event = JSON.parse(payload);
                logger_1.logger.warn('Webhook signature verification skipped (no secret provided)');
            }
            // Handle the event based on its type
            switch (event.type) {
                case 'payment_intent.succeeded':
                    return await this.handlePaymentIntentSucceeded(event);
                case 'payment_intent.payment_failed':
                    return await this.handlePaymentIntentFailed(event);
                case 'checkout.session.completed':
                    return await this.handleCheckoutSessionCompleted(event);
                default:
                    // Return basic information for unhandled events
                    return {
                        success: true,
                        event_type: event.type,
                        event_id: event.id
                    };
            }
        }
        catch (error) {
            logger_1.logger.error(`Error handling webhook event: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    /**
     * Map Stripe PaymentIntent to our PaymentDetails interface
     */
    mapPaymentIntentToDetails(paymentIntent, session) {
        const metadata = {
            ...paymentIntent.metadata,
            ...(session?.metadata || {})
        };
        return {
            id: paymentIntent.id,
            status: this.mapStripeStatus(paymentIntent.status),
            amount: paymentIntent.amount / 100, // Convert from cents
            currency: paymentIntent.currency,
            invoice_id: metadata.invoice_id,
            customer_id: metadata.customer_id,
            provider: 'stripe',
            provider_payment_id: paymentIntent.id,
            metadata,
            created_at: new Date(paymentIntent.created * 1000),
            updated_at: new Date()
        };
    }
    /**
     * Map Stripe payment status to our PaymentStatus type
     */
    mapStripeStatus(stripeStatus) {
        switch (stripeStatus) {
            case 'succeeded':
                return 'succeeded';
            case 'processing':
                return 'processing';
            case 'requires_payment_method':
            case 'requires_confirmation':
            case 'requires_action':
            case 'requires_capture':
                return 'pending';
            case 'canceled':
                return 'cancelled';
            default:
                return 'failed';
        }
    }
    /**
     * Handle the payment_intent.succeeded event
     */
    async handlePaymentIntentSucceeded(event) {
        const paymentIntent = event.data.object;
        logger_1.logger.info(`Payment succeeded: ${paymentIntent.id}`);
        return {
            success: true,
            event_type: event.type,
            event_id: event.id,
            payment_id: paymentIntent.id,
            invoice_id: paymentIntent.metadata.invoice_id,
            data: {
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
                customer_id: paymentIntent.metadata.customer_id,
                organization_id: paymentIntent.metadata.organization_id,
                payment_method: paymentIntent.payment_method_types?.[0] || 'unknown',
            }
        };
    }
    /**
     * Handle the payment_intent.payment_failed event
     */
    async handlePaymentIntentFailed(event) {
        const paymentIntent = event.data.object;
        const error = paymentIntent.last_payment_error;
        logger_1.logger.warn(`Payment failed: ${paymentIntent.id}, reason: ${error?.message || 'Unknown error'}`);
        return {
            success: true,
            event_type: event.type,
            event_id: event.id,
            payment_id: paymentIntent.id,
            invoice_id: paymentIntent.metadata.invoice_id,
            data: {
                error: error?.message || 'Unknown error',
                error_code: error?.code,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
                customer_id: paymentIntent.metadata.customer_id,
                organization_id: paymentIntent.metadata.organization_id,
            }
        };
    }
    /**
     * Handle the checkout.session.completed event
     */
    async handleCheckoutSessionCompleted(event) {
        const session = event.data.object;
        // Skip if the session is not paid
        if (session.payment_status !== 'paid') {
            return {
                success: true,
                event_type: event.type,
                event_id: event.id,
                data: {
                    payment_status: session.payment_status
                }
            };
        }
        logger_1.logger.info(`Checkout session completed: ${session.id}`);
        // Get the payment intent if available
        let paymentIntentId = session.payment_intent;
        return {
            success: true,
            event_type: event.type,
            event_id: event.id,
            payment_id: paymentIntentId,
            invoice_id: session.metadata?.invoice_id,
            data: {
                amount: session.amount_total ? session.amount_total / 100 : null,
                currency: session.currency,
                customer_id: session.metadata?.customer_id,
                organization_id: session.metadata?.organization_id,
                customer_email: session.customer_details?.email,
                payment_status: session.payment_status
            }
        };
    }
}
exports.StripePaymentProvider = StripePaymentProvider;
//# sourceMappingURL=stripe.js.map