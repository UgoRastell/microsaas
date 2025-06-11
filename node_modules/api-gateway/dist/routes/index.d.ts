import { FastifyInstance, FastifyPluginOptions } from 'fastify';
declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: any, reply: any) => Promise<void>;
    }
}
export default function routes(fastify: FastifyInstance, _options: FastifyPluginOptions): Promise<void>;
