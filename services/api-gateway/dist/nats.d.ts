import { NatsConnection, Subscription } from 'nats';
/**
 * Connect to NATS server
 */
export declare function connectNats(): Promise<NatsConnection>;
/**
 * Get the NATS client
 */
export declare function getNatsClient(): NatsConnection;
/**
 * Publish a message to a NATS subject
 */
export declare function publishMessage(subject: string, data: any): void;
/**
 * Subscribe to a NATS subject
 */
export declare function subscribeToSubject(subject: string, callback: (data: any) => void): Subscription;
/**
 * Close NATS connection
 */
export declare function closeNatsConnection(): Promise<void>;
