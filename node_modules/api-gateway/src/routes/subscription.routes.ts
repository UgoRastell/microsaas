import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify';
import { NatsConnection } from 'nats';

// Extend FastifyInstance to include nc property
declare module 'fastify' {
  interface FastifyInstance {
    nc: NatsConnection;
  }
}

// Extend FastifyRequest to include user property with sub
interface UserRequest extends FastifyRequest {
  user: {
    sub: string;
    [key: string]: any;
  };
}

export default async function subscriptionRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  const nc: NatsConnection = fastify.nc;

  // Get subscription plans
  fastify.get('/plans', async (request, reply) => {
    try {
      // Request plans from payment service
      const msg = await nc.request('subscription.plans.get', Buffer.from(JSON.stringify({})), { timeout: 5000 });
      
      const response = JSON.parse(Buffer.from(msg.data).toString());
      if (response.error) {
        request.log.error(`Error getting plans: ${response.error}`);
        return reply.code(500).send({ error: response.error });
      }
      
      return { plans: response.plans };
    } catch (err) {
      request.log.error(`Error requesting plans: ${err}`);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Get current subscription
  fastify.get('/current', async (request, reply) => {
    try {
      const userId = (request as UserRequest).user.sub;
      
      // Request subscription from payment service
      const msg = await nc.request(
        'subscription.get.request',
        Buffer.from(JSON.stringify({ userId })),
        { timeout: 5000 }
      );
      
      const response = JSON.parse(Buffer.from(msg.data).toString());
      if (response.error) {
        request.log.error(`Error getting subscription: ${response.error}`);
        return reply.code(response.status || 500).send({ error: response.error });
      }
      
      return { subscription: response.subscription };
    } catch (err) {
      request.log.error(`Error requesting subscription: ${err}`);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Create checkout session
  fastify.post('/checkout', async (request, reply) => {
    try {
      const { planId, successUrl, cancelUrl } = request.body as any;
      const userId = (request as UserRequest).user.sub;
      
      if (!planId) {
        return reply.code(400).send({ error: 'Plan ID is required' });
      }
      
      // Request checkout session from payment service
      const msg = await nc.request(
        'subscription.create.request',
        Buffer.from(JSON.stringify({
          userId,
          planId,
          successUrl,
          cancelUrl
        })),
        { timeout: 10000 }
      );
      
      const response = JSON.parse(Buffer.from(msg.data).toString());
      if (response.error) {
        request.log.error(`Error creating checkout: ${response.error}`);
        return reply.code(500).send({ error: response.error });
      }
      
      return { url: response.url, status: response.status };
    } catch (err) {
      request.log.error(`Error creating checkout session: ${err}`);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Cancel subscription
  fastify.post('/cancel', async (request, reply) => {
    try {
      const userId = (request as UserRequest).user.sub;
      
      // Request subscription cancellation from payment service
      const msg = await nc.request(
        'subscription.cancel.request',
        Buffer.from(JSON.stringify({ userId })),
        { timeout: 5000 }
      );
      
      const response = JSON.parse(Buffer.from(msg.data).toString());
      if (response.error) {
        request.log.error(`Error cancelling subscription: ${response.error}`);
        return reply.code(500).send({ error: response.error });
      }
      
      return { status: 'success', message: 'Subscription cancelled' };
    } catch (err) {
      request.log.error(`Error cancelling subscription: ${err}`);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
