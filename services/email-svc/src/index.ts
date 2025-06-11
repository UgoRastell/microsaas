import 'dotenv/config';
import { connect, NatsConnection, JSONCodec, Subscription } from 'nats';
import { logger } from './utils/logger';
import { handleSendEmail } from './handlers/sendEmail';

// Initialize NATS JSON codec
const jsonCodec = JSONCodec();

// Subscriptions to clean up on exit
const subscriptions: Subscription[] = [];

/**
 * Connect to NATS server and set up subscriptions
 */
async function start() {
  try {
    logger.info('Starting email service...');
    
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
    
    // Set up subscription handlers for email service
    setupSubscriptions(natsClient);
    
    // Handle process termination
    setupGracefulShutdown(natsClient);
    
    logger.info('Email service started successfully');
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
    // Send email handler
    const sendEmailSub = natsClient.subscribe('email.send.request');
    subscriptions.push(sendEmailSub);
    logger.info('Subscribed to email.send.request');
    
    (async () => {
      for await (const msg of sendEmailSub) {
        try {
          const data = jsonCodec.decode(msg.data) as any;
          logger.info(`Received email.send.request: ${JSON.stringify({
            to: data.to,
            subject: data.subject,
            template: data.template
          })}`);
          
          const result = await handleSendEmail(data);
          
          // Reply if a reply subject is included
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(result));
          } else if (data.requestId) {
            // Or use the requestId to create a response subject
            natsClient.publish(`email.send.response.${data.requestId}`, jsonCodec.encode(result));
          }
          
          // Publish event for successful email sending
          natsClient.publish('email.sent', jsonCodec.encode({
            to: data.to,
            messageId: result.messageId,
            template: data.template
          }));
        } catch (error) {
          logger.error(`Error handling email.send.request: ${error instanceof Error ? error.message : String(error)}`);
          
          const data = jsonCodec.decode(msg.data) as any;
          
          // Reply with error
          const errorResponse = {
            error: error instanceof Error ? error.message : String(error)
          };
          
          if (msg.reply) {
            natsClient.publish(msg.reply, jsonCodec.encode(errorResponse));
          } else if (data && data.requestId) {
            natsClient.publish(`email.send.response.${data.requestId}`, jsonCodec.encode(errorResponse));
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
    logger.info('Shutting down email service...');
    
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
