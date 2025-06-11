import { connect, NatsConnection, JSONCodec, Subscription } from 'nats';
import { logger } from './utils/logger';

let natsClient: NatsConnection;
const jsonCodec = JSONCodec();

/**
 * Connect to NATS server
 */
export async function connectNats(): Promise<NatsConnection> {
  try {
    const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
    
    logger.info(`Connecting to NATS at ${natsUrl}`);
    
    natsClient = await connect({
      servers: natsUrl,
      reconnect: true,
      maxReconnectAttempts: -1, // Unlimited reconnect attempts
      reconnectTimeWait: 1000,
    });

    logger.info(`Connected to ${natsClient.getServer()}`);

    // Setup disconnect handler
    natsClient.closed().then((err) => {
      if (err) {
        logger.error(`NATS connection closed due to error: ${err.message}`);
      } else {
        logger.info('NATS connection closed');
      }
    });

    return natsClient;
  } catch (error) {
    logger.error(`Failed to connect to NATS: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Get the NATS client
 */
export function getNatsClient(): NatsConnection {
  if (!natsClient) {
    throw new Error('NATS client not initialized');
  }
  return natsClient;
}

/**
 * Publish a message to a NATS subject
 */
export function publishMessage(subject: string, data: any): void {
  if (!natsClient) {
    throw new Error('NATS client not initialized');
  }

  try {
    logger.debug(`Publishing message to ${subject}: ${JSON.stringify(data)}`);
    natsClient.publish(subject, jsonCodec.encode(data));
  } catch (error) {
    logger.error(`Error publishing message to ${subject}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Subscribe to a NATS subject
 */
export function subscribeToSubject(subject: string, callback: (data: any) => void): Subscription {
  if (!natsClient) {
    throw new Error('NATS client not initialized');
  }

  try {
    logger.info(`Subscribing to ${subject}`);
    
    const subscription = natsClient.subscribe(subject);
    
    (async () => {
      for await (const message of subscription) {
        try {
          const data = jsonCodec.decode(message.data);
          callback(data);
        } catch (error) {
          logger.error(`Error handling message from ${subject}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    })();
    
    return subscription;
  } catch (error) {
    logger.error(`Error subscribing to ${subject}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Close NATS connection
 */
export async function closeNatsConnection(): Promise<void> {
  if (natsClient) {
    await natsClient.close();
    logger.info('NATS connection closed');
  }
}
