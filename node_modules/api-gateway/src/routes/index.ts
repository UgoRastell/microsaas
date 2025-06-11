import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import invoiceRoutes from './invoice.routes';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';
import customerRoutes from './customer.routes';

// Extend FastifyInstance type with authenticate method
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

export default async function routes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  // Auth middleware for protected routes
  fastify.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ 
        statusCode: 401, 
        error: 'Unauthorized', 
        message: 'Authentication required' 
      });
    }
  });

  // Register routes
  fastify.register(healthRoutes);
  fastify.register(authRoutes, { prefix: '/auth' });
  
  // Protected routes
  fastify.register(async function (instance) {
    instance.addHook('onRequest', fastify.authenticate);
    instance.register(invoiceRoutes, { prefix: '/invoices' });
    instance.register(customerRoutes, { prefix: '/customers' });
  });
}
