import { SupabaseClient } from '@supabase/supabase-js';
import { NatsConnection } from 'nats';
import { logger } from '../utils/logger';
import { PaymentProvider, PaymentEventData } from '../interfaces';

/**
 * Handle payment provider webhook events
 */
export async function handleWebhookEvent(
  payload: any,
  signature: string,
  paymentProvider: PaymentProvider,
  supabase: SupabaseClient,
  natsClient: NatsConnection,
  jsonCodec: any // Utilisation de any pour résoudre le problème de type
) {
  try {
    logger.info('Processing payment webhook event');
    
    // Process webhook event with the payment provider
    const webhookResult = await paymentProvider.handleWebhookEvent(payload, signature);
    
    // If no payment ID is associated with the event, just acknowledge it
    if (!webhookResult.payment_id) {
      logger.info(`Processed webhook event: ${webhookResult.event_type}, no payment ID associated`);
      return { success: true, event_type: webhookResult.event_type };
    }
    
    // Get payment details from the provider
    const paymentDetails = await paymentProvider.retrievePayment(webhookResult.payment_id);
    
    // Check if we have a record of this payment in our database
    const { data: existingPayment, error: fetchError } = await supabase
      .from('payments')
      .select('id, invoice_id, status, organization_id, customer_id')
      .eq('provider_payment_id', webhookResult.payment_id)
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') { // Not found is fine, other errors should be logged
      logger.error(`Error fetching payment record: ${fetchError.message}`);
    }
    
    let payment_id = existingPayment?.id;
    let invoice_id = webhookResult.invoice_id || existingPayment?.invoice_id || paymentDetails.invoice_id;
    
    // If we don't have this payment in our DB yet, we should fetch additional info from metadata
    if (!existingPayment && invoice_id) {
      // Fetch invoice to get organization_id and customer_id
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('id, organization_id, customer_id, total_amount, currency')
        .eq('id', invoice_id)
        .single();
      
      if (invoiceError) {
        logger.error(`Error fetching invoice ${invoice_id}: ${invoiceError.message}`);
      } else if (invoice) {
        // Create a new payment record based on the webhook data
        const { data: newPayment, error: insertError } = await supabase
          .from('payments')
          .insert({
            invoice_id,
            organization_id: invoice.organization_id,
            customer_id: invoice.customer_id,
            amount: paymentDetails.amount || invoice.total_amount,
            currency: paymentDetails.currency || invoice.currency,
            status: paymentDetails.status,
            provider: paymentDetails.provider,
            provider_payment_id: paymentDetails.provider_payment_id,
            metadata: paymentDetails.metadata,
          })
          .select('id')
          .single();
        
        if (insertError) {
          logger.error(`Error creating payment record: ${insertError.message}`);
        } else {
          payment_id = newPayment.id;
          logger.info(`Created new payment record: ${payment_id}`);
        }
      }
    } else if (existingPayment) {
      // Update existing payment record with latest status
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          status: paymentDetails.status,
          updated_at: new Date().toISOString(),
          // Utilisation d'un cast pour éviter l'erreur TS2339
          metadata: {
            ...((existingPayment as any).metadata || {}),
            ...((paymentDetails as any).metadata || {}),
          },
        })
        .eq('id', existingPayment.id);
      
      if (updateError) {
        logger.error(`Error updating payment record: ${updateError.message}`);
      } else {
        logger.info(`Updated payment ${existingPayment.id} status to ${paymentDetails.status}`);
      }
    }
    
    // If payment was successful, update the invoice status
    if (paymentDetails.status === 'succeeded' && invoice_id) {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', invoice_id);
      
      if (updateError) {
        logger.error(`Error updating invoice status: ${updateError.message}`);
      } else {
        logger.info(`Updated invoice ${invoice_id} status to paid`);
      }
      
      // Publish payment completion event to NATS for other services
      const eventData: PaymentEventData = {
        payment_id: payment_id || webhookResult.payment_id,
        invoice_id,
        status: paymentDetails.status,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        provider: paymentDetails.provider,
        provider_payment_id: paymentDetails.provider_payment_id,
        customer_id: existingPayment?.customer_id || '',
        organization_id: existingPayment?.organization_id || '',
        event_type: webhookResult.event_type,
        event_id: webhookResult.event_id,
        metadata: paymentDetails.metadata,
        created_at: new Date(),
      };
      
      // Publish event to payment.completed subject
      natsClient.publish('payment.completed', jsonCodec.encode(eventData));
      logger.info(`Published payment.completed event for invoice ${invoice_id}`);
      
      // Also publish to payment.event subject with more details
      natsClient.publish('payment.event', jsonCodec.encode({
        type: 'payment.completed',
        data: eventData
      }));
    } else if (paymentDetails.status === 'failed' && invoice_id) {
      // If payment failed, publish failure event
      const eventData = {
        payment_id: payment_id || webhookResult.payment_id,
        invoice_id,
        status: paymentDetails.status,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        provider: paymentDetails.provider,
        provider_payment_id: paymentDetails.provider_payment_id,
        error: webhookResult.data?.error,
        error_code: webhookResult.data?.error_code,
        event_type: webhookResult.event_type,
        event_id: webhookResult.event_id,
        created_at: new Date()
      };
      
      // Publish event to payment.failed subject
      natsClient.publish('payment.failed', jsonCodec.encode(eventData));
      logger.info(`Published payment.failed event for invoice ${invoice_id}`);
      
      // Also publish to payment.event subject
      natsClient.publish('payment.event', jsonCodec.encode({
        type: 'payment.failed',
        data: eventData
      }));
    }
    
    // Return webhook handling result
    return {
      success: true,
      event_type: webhookResult.event_type,
      payment_id: payment_id || webhookResult.payment_id,
      invoice_id,
      status: paymentDetails.status
    };
  } catch (error) {
    logger.error(`Error handling webhook event: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
