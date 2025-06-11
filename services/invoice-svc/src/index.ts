import 'dotenv/config';
import { connect, NatsConnection, JSONCodec, Subscription } from 'nats';
import { createClient } from '@supabase/supabase-js';
import { logger } from './utils/logger';
import { handleCreateInvoice } from './handlers/createInvoice';
import { handleGetInvoice } from './handlers/getInvoice';
import { handleGeneratePdf } from './handlers/generatePdf';
import { handleDeleteInvoice } from './handlers/deleteInvoice';
import { handleSendInvoice } from './handlers/sendInvoice';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize NATS JSON codec
const jsonCodec = JSONCodec();

// Subscriptions to clean up on exit
const subscriptions: Subscription[] = [];

/**
 * Connect to NATS server and set up subscriptions
 */
async function start() {
  try {
    logger.info('Starting invoice service...');
    
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
    
    // Set up subscription handlers for invoice service
    setupSubscriptions(natsClient);
    
    // Handle process termination
    setupGracefulShutdown(natsClient);
    
    logger.info('Invoice service started successfully');
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
    // Create invoice handler
    const createSub = natsClient.subscribe('invoice.create');
    subscriptions.push(createSub);
    logger.info('Subscribed to invoice.create');
    
    (async () => {
      for await (const msg of createSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          logger.info(`Received invoice.create request: ${JSON.stringify(data)}`);
          
          const result = await handleCreateInvoice(data, supabase);
          
          // Reply if a reply subject is included
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(result));
          }
          
          // Publish event for successful invoice creation
          natsClient.publish('invoice.created', jsonCodec.encode({
            invoice_id: result.id,
            organization_id: data.organization_id
          }));
        } catch (error) {
          logger.error(`Error handling invoice.create: ${error instanceof Error ? error.message : String(error)}`);
          
          // Reply with error if a reply subject is included
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode({
              error: error instanceof Error ? error.message : String(error)
            }));
          }
        }
      }
    })();
    
    // Get invoice handler
    const getSub = natsClient.subscribe('invoice.get.request');
    subscriptions.push(getSub);
    logger.info('Subscribed to invoice.get.request');
    
    (async () => {
      for await (const msg of getSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          logger.info(`Received invoice.get.request: ${JSON.stringify(data)}`);
          
          const result = await handleGetInvoice(data, supabase);
          
          // Reply with the result
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(result));
          } else if (data.requestId) {
            natsClient.publish(`invoice.get.response.${data.requestId}`, jsonCodec.encode(result));
          }
        } catch (error) {
          logger.error(`Error handling invoice.get.request: ${error instanceof Error ? error.message : String(error)}`);
          
          // Reply with error
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode({
              error: error instanceof Error ? error.message : String(error)
            }));
          } else {
            try {
              const reqData = jsonCodec.decode(msg.data) as any;
              if (reqData && reqData.requestId) {
                natsClient.publish(`invoice.get.response.${reqData.requestId}`, jsonCodec.encode({
                  error: error instanceof Error ? error.message : String(error)
                }));
              }
            } catch (decodeErr) {
              logger.error(`Error decoding message data: ${decodeErr}`);
            }
          }
        }
      }
    })();
    
    // Generate PDF handler
    const generatePdfSub = natsClient.subscribe('invoice.generate.pdf');
    subscriptions.push(generatePdfSub);
    logger.info('Subscribed to invoice.generate.pdf');
    
    (async () => {
      for await (const msg of generatePdfSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          logger.info(`Received invoice.generate.pdf request: ${JSON.stringify(data)}`);
          
          const result = await handleGeneratePdf(data, supabase);
          
          // Reply if a reply subject is included
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(result));
          }
          
          // Publish event for successful PDF generation
          natsClient.publish('invoice.pdf.generated', jsonCodec.encode({
            invoice_id: data.invoice_id,
            organization_id: data.organization_id,
            pdf_url: result.pdf_url
          }));
        } catch (error) {
          logger.error(`Error handling invoice.generate.pdf: ${error instanceof Error ? error.message : String(error)}`);
          
          // Reply with error if a reply subject is included
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode({
              error: error instanceof Error ? error.message : String(error)
            }));
          }
        }
      }
    })();
    
    // Delete invoice handler
    const deleteSub = natsClient.subscribe('invoice.delete');
    subscriptions.push(deleteSub);
    logger.info('Subscribed to invoice.delete');
    
    (async () => {
      for await (const msg of deleteSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          logger.info(`Received invoice.delete request: ${JSON.stringify(data)}`);
          
          await handleDeleteInvoice(data, supabase);
          
          // Reply if a reply subject is included
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode({
              success: true,
              invoice_id: data.invoice_id
            }));
          }
          
          // Publish event for successful invoice deletion
          natsClient.publish('invoice.deleted', jsonCodec.encode({
            invoice_id: data.invoice_id,
            organization_id: data.organization_id
          }));
        } catch (error) {
          logger.error(`Error handling invoice.delete: ${error instanceof Error ? error.message : String(error)}`);
          
          // Reply with error if a reply subject is included
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode({
              error: error instanceof Error ? error.message : String(error)
            }));
          }
        }
      }
    })();
    
    // Send invoice handler
    const sendSub = natsClient.subscribe('invoice.send');
    subscriptions.push(sendSub);
    logger.info('Subscribed to invoice.send');
    
    (async () => {
      for await (const msg of sendSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          logger.info(`Received invoice.send request: ${JSON.stringify(data)}`);
          
          // First, make sure we have the PDF generated
          const pdfResult = await handleGeneratePdf(data, supabase);
          
          // Then handle sending the invoice 
          const result = await handleSendInvoice({
            ...data,
            pdf_url: pdfResult.pdf_url
          }, supabase, natsClient, jsonCodec);
          
          // Reply if a reply subject is included
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(result));
          }
          
          // Publish event for successful invoice sending
          natsClient.publish('invoice.sent', jsonCodec.encode({
            invoice_id: data.invoice_id,
            organization_id: data.organization_id,
            pdf_url: pdfResult.pdf_url,
            email: result.email
          }));
        } catch (error) {
          logger.error(`Error handling invoice.send: ${error instanceof Error ? error.message : String(error)}`);
          
          // Reply with error if a reply subject is included
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode({
              error: error instanceof Error ? error.message : String(error)
            }));
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
    logger.info('Shutting down invoice service...');
    
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
  process.on('unhandledRejection', (reason, _promise: Promise<unknown>) => {
    logger.error(`Unhandled promise rejection: ${reason}`);
    shutdown();
  });
}

// Start the service
start();
