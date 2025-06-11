/**
 * Common payment service interfaces
 */
export * from './subscription';
export interface PaymentProvider {
    /**
     * Create a checkout session for an invoice
     */
    createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult>;
    /**
     * Retrieve information about a payment
     */
    retrievePayment(paymentId: string): Promise<PaymentDetails>;
    /**
     * Handle webhook events from the payment provider
     */
    handleWebhookEvent(payload: any, signature: string): Promise<WebhookHandleResult>;
}
export interface CreateCheckoutSessionParams {
    invoice_id: string;
    organization_id: string;
    customer_id: string;
    amount: number;
    currency: string;
    description: string;
    customer_email?: string;
    customer_name?: string;
    metadata?: Record<string, string>;
    success_url?: string;
    cancel_url?: string;
}
export interface CheckoutSessionResult {
    sessionId: string;
    url: string;
    provider: string;
    expiresAt: number;
}
export interface PaymentDetails {
    id: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    invoice_id?: string;
    customer_id?: string;
    provider: string;
    provider_payment_id: string;
    metadata?: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'cancelled';
export interface WebhookHandleResult {
    success: boolean;
    event_type: string;
    event_id: string;
    payment_id?: string;
    invoice_id?: string;
    data?: Record<string, any>;
}
export interface PaymentEventData {
    payment_id: string;
    invoice_id: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    provider: string;
    provider_payment_id: string;
    customer_id: string;
    organization_id: string;
    event_type: string;
    event_id: string;
    metadata?: Record<string, any>;
    created_at: Date;
}
export interface CreatePaymentRequest {
    invoice_id: string;
    organization_id: string;
    customer_id: string;
    amount: number;
    currency: string;
    description: string;
    customer_email?: string;
    metadata?: Record<string, string>;
}
