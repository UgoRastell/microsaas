/**
 * Subscription interfaces
 */
export type SubscriptionPlanType = 'freemium' | 'standard' | 'premium';
export interface SubscriptionPlan {
    id: string;
    type: SubscriptionPlanType;
    name: string;
    description: string;
    price: number;
    currency: string;
    interval: 'month' | 'year';
    invoiceLimit: number | null;
    features: string[];
    stripeProductId: string;
    stripePriceId: string;
}
export interface CreateSubscriptionParams {
    organizationId: string;
    planId: string;
    customerId: string;
    customerEmail: string;
    paymentMethodId?: string;
    metadata?: Record<string, string>;
    successUrl?: string;
    cancelUrl?: string;
}
export interface SubscriptionDetails {
    id: string;
    status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
    planType: SubscriptionPlanType;
    startDate: Date;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    canceledAt: Date | null;
    invoiceUsage: number;
    invoiceLimit: number | null;
    organizationId: string;
    customerId: string;
    stripeSubscriptionId: string;
    metadata?: Record<string, any>;
}
export interface UpdateSubscriptionParams {
    subscriptionId: string;
    planId?: string;
    cancelAtPeriodEnd?: boolean;
    metadata?: Record<string, string>;
}
export interface PostalDeliveryOption {
    enabled: boolean;
    pricePerInvoice: number;
    currency: string;
}
