import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { NatsConnection } from 'nats';
declare module 'fastify' {
    interface FastifyInstance {
        nats: NatsConnection;
    }
}
/**
 * Invoice routes
 */
export default function invoiceRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions): Promise<void>;
