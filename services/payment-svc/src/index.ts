import 'dotenv/config';
import { connect, NatsConnection, JSONCodec, Subscription } from 'nats';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import express, { Request, Response } from 'express';
import { logger } from './utils/logger';
import { StripePaymentProvider } from './providers/stripe';
import { PaymentProvider } from './interfaces';
import { handleCreatePayment } from './handlers/createPayment';
import { handleWebhookEvent } from './handlers/handleWebhook';
import { SubscriptionService } from './providers/subscription-service';

// Initialize JSON codec for NATS messages
const jsonCodec = JSONCodec();

// Subscriptions to clean up on exit
const subscriptions: Subscription[] = [];

// Initialize payment provider
let paymentProvider: PaymentProvider;

// Initialize subscription service
let subscriptionService: SubscriptionService;

// Supabase client
let supabaseClient: SupabaseClient;

/**
 * Connect to NATS server and set up subscriptions
 */
async function start() {
  try {
    logger.info('Starting payment service...');
    
    // Initialize payment provider
    paymentProvider = new StripePaymentProvider();
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Initialize subscription service with Stripe from payment provider
    if (paymentProvider instanceof StripePaymentProvider) {
      subscriptionService = new SubscriptionService((paymentProvider as any).stripe, supabaseClient);
      
      // Initialiser les plans dans Stripe
      await subscriptionService.initializeStripePlans();
      logger.info('Subscription plans initialized in Stripe');
    }
    
    // Connect to NATS
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    logger.info(`Connecting to NATS at ${natsUrl}`);
    
    const natsClient = await connect({
      servers: natsUrl,
      reconnect: true,
      maxReconnectAttempts: -1, // Unlimited reconnect attempts
      reconnectTimeWait: 1000,
    });
    
    logger.info(`Connected to ${natsClient.getServer()}`);
    
    // Set up subscription handlers for payment service
    setupSubscriptions(natsClient);
    
    // Handle process termination
    setupGracefulShutdown(natsClient);
    
    logger.info('Payment service started successfully');
  } catch (error) {
    logger.error(`Failed to start service: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Set up NATS subscriptions for each message type
 */
function setupSubscriptions(natsClient: NatsConnection) {
  try {
    // Handle subscription plans listing requests
    const getPlansSubscription = natsClient.subscribe('subscription.plans.get');
    subscriptions.push(getPlansSubscription);
    logger.info('Subscribed to subscription.plans.get');
    
    (async () => {
      for await (const msg of getPlansSubscription) {
        try {
          const plans = subscriptionService.getAvailablePlans();
          
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode({ plans }));
          }
        } catch (error) {
          logger.error(`Error handling subscription.plans.get: ${error instanceof Error ? error.message : String(error)}`);
          
          if (msg.reply) {
            const errorResponse = {
              error: error instanceof Error ? error.message : String(error)
            };
            natsClient.publish(msg.reply, jsonCodec.encode(errorResponse));
          }
        }
      }
    })();
    
    // Handle subscription creation requests
    const createSubscriptionSub = natsClient.subscribe('subscription.create.request');
    subscriptions.push(createSubscriptionSub);
    logger.info('Subscribed to subscription.create.request');
    
    (async () => {
      for await (const msg of createSubscriptionSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          logger.info(`Received subscription.create.request for organization ${data.organizationId}`);
          
          const result = await subscriptionService.createSubscriptionCheckout(data);
          
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(result));
          }
        } catch (error) {
          logger.error(`Error handling subscription.create.request: ${error instanceof Error ? error.message : String(error)}`);
          
          if (msg.reply) {
            const errorResponse = {
              error: error instanceof Error ? error.message : String(error)
            };
            natsClient.publish(msg.reply, jsonCodec.encode(errorResponse));
          }
        }
      }
    })();
    
    // Handle invoice usage increment requests
    const incrementUsageSub = natsClient.subscribe('subscription.invoice.increment');
    subscriptions.push(incrementUsageSub);
    logger.info('Subscribed to subscription.invoice.increment');
    
    (async () => {
      for await (const msg of incrementUsageSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          logger.info(`Received subscription.invoice.increment for organization ${data.organizationId}`);
          
          const result = await subscriptionService.incrementInvoiceUsage(
            data.organizationId, 
            data.count || 1
          );
          
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(result));
          }
        } catch (error) {
          logger.error(`Error handling subscription.invoice.increment: ${error instanceof Error ? error.message : String(error)}`);
          
          if (msg.reply) {
            const errorResponse = {
              error: error instanceof Error ? error.message : String(error),
              limitReached: error instanceof Error && error.message.includes('Limite de factures atteinte')
            };
            natsClient.publish(msg.reply, jsonCodec.encode(errorResponse));
          }
        }
      }
    })();
    
    // Handle payment creation requests
    const createPaymentSub = natsClient.subscribe('payment.create.request');
    subscriptions.push(createPaymentSub);
    logger.info('Subscribed to payment.create.request');
    
    (async () => {
      for await (const msg of createPaymentSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          logger.info(`Received payment.create.request for invoice ${data.invoice_id}`);
          
          const result = await handleCreatePayment(data, paymentProvider, supabaseClient);
          
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(result));
          }
        } catch (error) {
          logger.error(`Error handling payment.create.request: ${error instanceof Error ? error.message : String(error)}`);
          
          // Reply with error if reply subject is provided
          if (msg.reply) {
            const errorResponse = {
              error: error instanceof Error ? error.message : String(error)
            };
            natsClient.publish(msg.reply, jsonCodec.encode(errorResponse));
          }
        }
      }
    })();
    
    // Handle subscription get requests
    const getSubscriptionSub = natsClient.subscribe('subscription.get.request');
    subscriptions.push(getSubscriptionSub);
    logger.info('Subscribed to subscription.get.request');
    
    (async () => {
      for await (const msg of getSubscriptionSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          logger.info(`Received subscription.get.request for user ${data.userId}`);
          
          // Vérifier que l'ID d'utilisateur est fourni
          if (!data.userId) {
            throw new Error('userId is required');
          }
          
          // Utiliser la nouvelle méthode getUserSubscription pour récupérer l'abonnement
          // Cette méthode est plus robuste et vérifie plusieurs colonnes possibles
          const subscription = await subscriptionService.getUserSubscription(data.userId);
          
          if (msg.reply) {
            if (subscription) {
              logger.info(`Sending subscription ${subscription.id} (${subscription.plan_type}) for user ${data.userId}`);
              natsClient.publish(msg.reply, jsonCodec.encode({ subscription }));
            } else {
              logger.info(`No active subscription found for user ${data.userId}`);
              natsClient.publish(msg.reply, jsonCodec.encode({ 
                subscription: null,
                message: 'No active subscription found'
              }));
            }
          }
        } catch (error) {
          logger.error(`Error handling subscription.get.request: ${error instanceof Error ? error.message : String(error)}`);
          
          if (msg.reply) {
            const errorResponse = {
              error: error instanceof Error ? error.message : String(error),
              status: 500
            };
            natsClient.publish(msg.reply, jsonCodec.encode(errorResponse));
          }
        }
      }
    })();
    
    // Handle payment status requests
    const getPaymentSub = natsClient.subscribe('payment.get.request');
    subscriptions.push(getPaymentSub);
    logger.info('Subscribed to payment.get.request');
    
    (async () => {
      for await (const msg of getPaymentSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          
          if (!data.payment_id && !data.invoice_id) {
            throw new Error('Either payment_id or invoice_id must be provided');
          }
          
          if (data.payment_id) {
            logger.info(`Received payment.get.request for payment ${data.payment_id}`);
            
            // Query payment by ID
            const { data: payment, error } = await supabaseClient
              .from('payments')
              .select('*')
              .eq('id', data.payment_id)
              .single();
            
            if (error) {
              throw new Error(`Failed to retrieve payment: ${error.message}`);
            }
            
            if (msg.reply) {
              natsClient.publish(msg.reply, jsonCodec.encode(payment));
            }
          } else {
            logger.info(`Received payment.get.request for invoice ${data.invoice_id}`);
            
            // Query payments by invoice ID
            const { data: payments, error } = await supabaseClient
              .from('payments')
              .select('*')
              .eq('invoice_id', data.invoice_id)
              .order('created_at', { ascending: false });
            
            if (error) {
              throw new Error(`Failed to retrieve payments: ${error.message}`);
            }
            
            if (msg.reply) {
              natsClient.publish(msg.reply, jsonCodec.encode(payments));
            }
          }
        } catch (error) {
          logger.error(`Error handling payment.get.request: ${error instanceof Error ? error.message : String(error)}`);
          
          // Reply with error if reply subject is provided
          if (msg.reply) {
            const errorResponse = {
              error: error instanceof Error ? error.message : String(error)
            };
            natsClient.publish(msg.reply, jsonCodec.encode(errorResponse));
          }
        }
      }
    })();
    
    // Handle webhook events (this would typically be called by a webhook HTTP endpoint)
    logger.info('Handle payment webhook events from HTTP API');
    const webhookSub = natsClient.subscribe('payment.webhook.event');
    subscriptions.push(webhookSub);
    logger.info('Subscribed to payment.webhook.event');
    
    // Configurer le serveur express pour les webhooks Stripe
    const app = express();
    app.use(express.json());
    
    // Stripe webhook endpoint
    app.post('/webhook', async (req: Request, res: Response) => {
      const signature = req.headers['stripe-signature'] as string;
      
      try {
        // Handle webhook event
        const result = await handleWebhookEvent(
          req.body,
          signature,
          paymentProvider,
          supabaseClient,
          natsClient,
          jsonCodec,
          subscriptionService
        );
        
        res.json({ success: true, event_type: result.event_type });
      } catch (error) {
        logger.error(`Error handling payment.webhook.event: ${error instanceof Error ? error.message : String(error)}`);
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });
    
    // Démarrer le serveur HTTP pour les webhooks
    const port = process.env.PORT || 3003;
    app.listen(port, () => {
      logger.info(`Payment webhook server listening on port ${port}`);
    });
  } catch (error) {
    logger.error(`Error setting up subscriptions: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Set up graceful shutdown
 */
function setupGracefulShutdown(natsClient: NatsConnection) {
  const shutdown = async () => {
    logger.info('Shutting down payment service...');
    
    // Unsubscribe from all subscriptions
    subscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
    
    // Close NATS connection
    await natsClient.close();
    
    logger.info('Payment service shutdown complete.');
    process.exit(0);
  };
  
  // Listen for termination signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the service
start();
