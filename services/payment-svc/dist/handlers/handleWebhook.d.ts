import { SupabaseClient } from '@supabase/supabase-js';
import { NatsConnection } from 'nats';
import { PaymentProvider } from '../interfaces';
import { SubscriptionService } from '../providers/subscription-service';
/**
 * Handle payment provider webhook events
 */
export declare function handleWebhookEvent(payload: any, signature: string, paymentProvider: PaymentProvider, supabase: SupabaseClient, natsClient: NatsConnection, jsonCodec: any, // Utilisation de any pour résoudre le problème de type
subscriptionService?: SubscriptionService): Promise<{
    success: boolean;
    event_type: string;
    payment_id?: undefined;
    invoice_id?: undefined;
    status?: undefined;
} | {
    success: boolean;
    event_type: string;
    payment_id: any;
    invoice_id: any;
    status: import("../interfaces").PaymentStatus;
}>;
