import { SupabaseClient } from '@supabase/supabase-js';
import { PaymentProvider, CreatePaymentRequest } from '../interfaces';
/**
 * Handle creating a payment checkout session for an invoice
 */
export declare function handleCreatePayment(request: CreatePaymentRequest, paymentProvider: PaymentProvider, supabase: SupabaseClient): Promise<{
    payment_id: string;
    checkout_url: string;
    session_id: string;
    provider: string;
    expires_at: number;
}>;
