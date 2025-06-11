import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { PaymentProvider, CreatePaymentRequest } from '../interfaces';

/**
 * Handle creating a payment checkout session for an invoice
 */
export async function handleCreatePayment(
  request: CreatePaymentRequest,
  paymentProvider: PaymentProvider,
  supabase: SupabaseClient
) {
  try {
    const { 
      invoice_id, 
      organization_id,
      customer_id,
      amount,
      currency,
      description,
      customer_email,
      metadata
    } = request;
    
    logger.info(`Creating payment for invoice ${invoice_id} (${amount} ${currency})`);
    
    // Verify invoice exists and belongs to the organization
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, status, customer_id, total_amount, currency')
      .eq('id', invoice_id)
      .eq('organization_id', organization_id)
      .single();
    
    if (fetchError) {
      logger.error(`Error fetching invoice ${invoice_id}: ${fetchError.message}`);
      throw new Error(`Failed to verify invoice: ${fetchError.message}`);
    }
    
    if (!invoice) {
      throw new Error(`Invoice ${invoice_id} not found or does not belong to organization ${organization_id}`);
    }
    
    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      logger.warn(`Invoice ${invoice_id} is already paid`);
      throw new Error(`Cannot create payment for invoice that is already paid`);
    }
    
    // Verify amount matches invoice
    if (invoice.total_amount !== amount) {
      logger.warn(`Payment amount (${amount}) does not match invoice amount (${invoice.total_amount})`);
    }
    
    // Generate a unique payment ID
    const payment_id = uuidv4();
    
    // Create checkout session with the payment provider
    const checkoutSession = await paymentProvider.createCheckoutSession({
      invoice_id,
      organization_id,
      customer_id,
      amount,
      currency,
      description,
      customer_email,
      metadata: {
        ...metadata,
        payment_id,
      },
    });
    
    // Store the payment in the database
    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        id: payment_id,
        invoice_id,
        organization_id,
        customer_id,
        amount,
        currency,
        status: 'pending',
        provider: checkoutSession.provider,
        provider_payment_id: checkoutSession.sessionId,
        provider_checkout_url: checkoutSession.url,
        expires_at: new Date(checkoutSession.expiresAt * 1000).toISOString(),
        metadata: {
          ...metadata,
          description,
        },
      });
    
    if (insertError) {
      logger.error(`Error storing payment record: ${insertError.message}`);
      throw new Error(`Failed to store payment: ${insertError.message}`);
    }
    
    // Update invoice status to pending_payment
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'pending_payment' })
      .eq('id', invoice_id)
      .eq('organization_id', organization_id);
    
    if (updateError) {
      logger.warn(`Error updating invoice status: ${updateError.message}`);
      // Non-critical error, continue
    }
    
    logger.info(`Payment session created for invoice ${invoice_id}, payment ID: ${payment_id}`);
    
    return {
      payment_id,
      checkout_url: checkoutSession.url,
      session_id: checkoutSession.sessionId,
      provider: checkoutSession.provider,
      expires_at: checkoutSession.expiresAt,
    };
  } catch (error) {
    logger.error(`Error in handleCreatePayment: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
