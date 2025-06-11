"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectNats = connectNats;
exports.getNatsClient = getNatsClient;
exports.publishMessage = publishMessage;
exports.subscribeToSubject = subscribeToSubject;
exports.closeNatsConnection = closeNatsConnection;
const nats_1 = require("nats");
const logger_1 = require("./utils/logger");
let natsClient;
const jsonCodec = (0, nats_1.JSONCodec)();
/**
 * Connect to NATS server
 */
async function connectNats() {
    try {
        const natsUrl = process.env.NATS_URL || 'nats://localhost:4222';
        logger_1.logger.info(`Connecting to NATS at ${natsUrl}`);
        natsClient = await (0, nats_1.connect)({
            servers: natsUrl,
            reconnect: true,
            maxReconnectAttempts: -1, // Unlimited reconnect attempts
            reconnectTimeWait: 1000,
        });
        logger_1.logger.info(`Connected to ${natsClient.getServer()}`);
        // Setup disconnect handler
        natsClient.closed().then((err) => {
            if (err) {
                logger_1.logger.error(`NATS connection closed due to error: ${err.message}`);
            }
            else {
                logger_1.logger.info('NATS connection closed');
            }
        });
        return natsClient;
    }
    catch (error) {
        logger_1.logger.error(`Failed to connect to NATS: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
/**
 * Get the NATS client
 */
function getNatsClient() {
    if (!natsClient) {
        throw new Error('NATS client not initialized');
    }
    return natsClient;
}
/**
 * Publish a message to a NATS subject
 */
function publishMessage(subject, data) {
    if (!natsClient) {
        throw new Error('NATS client not initialized');
    }
    try {
        logger_1.logger.debug(`Publishing message to ${subject}: ${JSON.stringify(data)}`);
        natsClient.publish(subject, jsonCodec.encode(data));
    }
    catch (error) {
        logger_1.logger.error(`Error publishing message to ${subject}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
/**
 * Subscribe to a NATS subject
 */
function subscribeToSubject(subject, callback) {
    if (!natsClient) {
        throw new Error('NATS client not initialized');
    }
    try {
        logger_1.logger.info(`Subscribing to ${subject}`);
        const subscription = natsClient.subscribe(subject);
        (async () => {
            for await (const message of subscription) {
                try {
                    const data = jsonCodec.decode(message.data);
                    callback(data);
                }
                catch (error) {
                    logger_1.logger.error(`Error handling message from ${subject}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        })();
        return subscription;
    }
    catch (error) {
        logger_1.logger.error(`Error subscribing to ${subject}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
/**
 * Close NATS connection
 */
async function closeNatsConnection() {
    if (natsClient) {
        await natsClient.close();
        logger_1.logger.info('NATS connection closed');
    }
}
//# sourceMappingURL=nats.js.map