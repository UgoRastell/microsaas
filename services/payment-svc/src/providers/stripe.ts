import Stripe from 'stripe';
import { logger } from '../utils/logger';
import { 
  PaymentProvider, 
  CreateCheckoutSessionParams, 
  CheckoutSessionResult,
  PaymentDetails,
  PaymentStatus,
  WebhookHandleResult
} from '../interfaces';

/**
 * Stripe payment provider implementation
 */
export class StripePaymentProvider implements PaymentProvider {
  private stripe: Stripe;
  private webhookSecret: string;
  
  constructor() {
    const apiKey = process.env.STRIPE_API_KEY;
    if (!apiKey) {
      throw new Error('STRIPE_API_KEY environment variable is not set');
    }
    
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16',
    });
    
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!this.webhookSecret && process.env.NODE_ENV === 'production') {
      logger.warn('STRIPE_WEBHOOK_SECRET environment variable is not set. Webhook validation will be skipped.');
    }
  }
  
  /**
   * Create a checkout session for an invoice
   */
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionResult> {
    try {
      logger.info(`Creating Stripe checkout session for invoice ${params.invoice_id}`);
      
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
      
      logger.info(`Created Stripe checkout session: ${session.id}`);
      
      return {
        sessionId: session.id,
        url: session.url || '',
        provider: 'stripe',
        expiresAt: session.expires_at || Math.floor(Date.now() / 1000) + 3600, // Default expiration: 1 hour
      };
    } catch (error) {
      logger.error(`Error creating Stripe checkout session: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Retrieve information about a payment
   */
  async retrievePayment(paymentId: string): Promise<PaymentDetails> {
    try {
      logger.info(`Retrieving Stripe payment: ${paymentId}`);
      
      // Determine if the ID is a session ID or a payment intent ID
      if (paymentId.startsWith('cs_')) {
        // It's a checkout session ID
        const session = await this.stripe.checkout.sessions.retrieve(paymentId, {
          expand: ['payment_intent'],
        });
        
        const paymentIntent = session.payment_intent as Stripe.PaymentIntent;
        
        if (!paymentIntent) {
          throw new Error(`No payment intent found for session: ${paymentId}`);
        }
        
        return this.mapPaymentIntentToDetails(paymentIntent, session);
      } else if (paymentId.startsWith('pi_')) {
        // It's a payment intent ID
        const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
        return this.mapPaymentIntentToDetails(paymentIntent);
      } else {
        throw new Error(`Invalid payment ID format: ${paymentId}`);
      }
    } catch (error) {
      logger.error(`Error retrieving Stripe payment: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Handle webhook events from Stripe
   */
  async handleWebhookEvent(payload: any, signature: string): Promise<WebhookHandleResult> {
    try {
      logger.info('Processing Stripe webhook event');
      
      let event: Stripe.Event;
      
      // Verify the event signature
      if (this.webhookSecret) {
        try {
          event = this.stripe.webhooks.constructEvent(
            payload,
            signature,
            this.webhookSecret
          );
        } catch (error) {
          logger.error(`Webhook signature verification failed: ${error instanceof Error ? error.message : String(error)}`);
          throw new Error('Invalid signature');
        }
      } else {
        // If no webhook secret, parse the payload directly (development only)
        event = JSON.parse(payload) as Stripe.Event;
        logger.warn('Webhook signature verification skipped (no secret provided)');
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
    } catch (error) {
      logger.error(`Error handling webhook event: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * Map Stripe PaymentIntent to our PaymentDetails interface
   */
  private mapPaymentIntentToDetails(
    paymentIntent: Stripe.PaymentIntent, 
    session?: Stripe.Checkout.Session
  ): PaymentDetails {
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
  private mapStripeStatus(stripeStatus: string): PaymentStatus {
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
  private async handlePaymentIntentSucceeded(event: Stripe.Event): Promise<WebhookHandleResult> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    logger.info(`Payment succeeded: ${paymentIntent.id}`);
    
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
  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<WebhookHandleResult> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const error = paymentIntent.last_payment_error;
    
    logger.warn(`Payment failed: ${paymentIntent.id}, reason: ${error?.message || 'Unknown error'}`);
    
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
  private async handleCheckoutSessionCompleted(event: Stripe.Event): Promise<WebhookHandleResult> {
    const session = event.data.object as Stripe.Checkout.Session;
    
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
    
    logger.info(`Checkout session completed: ${session.id}`);
    
    // Get the payment intent if available
    let paymentIntentId = session.payment_intent as string;
    
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
