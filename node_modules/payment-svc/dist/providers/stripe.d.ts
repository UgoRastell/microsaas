import { PaymentProvider, CreateCheckoutSessionParams, CheckoutSessionResult, PaymentDetails, WebhookHandleResult } from '../interfaces';
/**
 * Stripe payment provider implementation
 */
export declare class StripePaymentProvider implements PaymentProvider {
    private stripe;
    private webhookSecret;
    constructor();
    /**
     * Create a checkout session for an invoice
     */
    createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult>;
    /**
     * Retrieve information about a payment
     */
    retrievePayment(paymentId: string): Promise<PaymentDetails>;
    /**
     * Handle webhook events from Stripe
     */
    handleWebhookEvent(payload: any, signature: string): Promise<WebhookHandleResult>;
    /**
     * Map Stripe PaymentIntent to our PaymentDetails interface
     */
    private mapPaymentIntentToDetails;
    /**
     * Map Stripe payment status to our PaymentStatus type
     */
    private mapStripeStatus;
    /**
     * Handle the payment_intent.succeeded event
     */
    private handlePaymentIntentSucceeded;
    /**
     * Handle the payment_intent.payment_failed event
     */
    private handlePaymentIntentFailed;
    /**
     * Handle the checkout.session.completed event
     */
    private handleCheckoutSessionCompleted;
}
