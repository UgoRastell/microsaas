import 'dotenv/config';
import { connect, NatsConnection, JSONCodec, Subscription } from 'nats';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './utils/logger';
import { StripePaymentProvider } from './providers/stripe';
import { PaymentProvider } from './interfaces';
import { handleCreatePayment } from './handlers/createPayment';
import { handleWebhookEvent } from './handlers/handleWebhook';

// Initialize JSON codec for NATS messages
const jsonCodec = JSONCodec();

// Subscriptions to clean up on exit
const subscriptions: Subscription[] = [];

// Initialize payment provider
let paymentProvider: PaymentProvider;

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
    const webhookSub = natsClient.subscribe('payment.webhook.event');
    subscriptions.push(webhookSub);
    logger.info('Subscribed to payment.webhook.event');
    
    (async () => {
      for await (const msg of webhookSub) {
        try {
          const data = jsonCodec.decode(msg.data) as { payload: any; signature: string };
          logger.info('Received payment.webhook.event');
          
          const result = await handleWebhookEvent(
            data.payload, 
            data.signature, 
            paymentProvider, 
            supabaseClient,
            natsClient,
            jsonCodec // Utilisation directe de jsonCodec comme type any
          );
          
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(result));
          }
        } catch (error) {
          logger.error(`Error handling payment.webhook.event: ${error instanceof Error ? error.message : String(error)}`);
          
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
  } catch (error) {
    logger.error(`Error setting up subscriptions: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Set up graceful shutdown for CTRL+C and process termination
 */
function setupGracefulShutdown(natsClient: NatsConnection) {
  const shutdown = async () => {
    logger.info('Shutting down payment service...');
    
    // Unsubscribe from all subscriptions
    for (const sub of subscriptions) {
      sub.unsubscribe();
    }
    
    // Close NATS connection
    await natsClient.close();
    logger.info('NATS connection closed');
    
    process.exit(0);
  };
  
  // Handle CTRL+C
  process.on('SIGINT', shutdown);
  
  // Handle process termination
  process.on('SIGTERM', shutdown);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    logger.error(error.stack);
    shutdown();
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, _promise: Promise<unknown>) => {
    logger.error(`Unhandled promise rejection: ${reason}`);
    shutdown();
  });
}

// Start the service
start();
