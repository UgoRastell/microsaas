import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getNatsClient } from '../nats';

/**
 * Health check routes
 */
export default async function healthRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  
  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Check API health
   *     tags:
   *       - Health
   *     responses:
   *       200:
   *         description: API is healthy
   *       500:
   *         description: API is not healthy
   */
  fastify.get('/health', async (request, reply) => {
    try {
      const status = {
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        status: 'ok',
        version: process.env.npm_package_version || '1.0.0',
        nats: {
          connected: false,
          server: ''
        },
        uptime: process.uptime()
      };

      // Check NATS connection
      try {
        const natsClient = getNatsClient();
        status.nats.connected = natsClient.getServer() !== undefined;
        status.nats.server = natsClient.getServer() || '';
      } catch (err) {
        status.nats.connected = false;
        status.status = 'degraded';
      }

      // Return appropriate status code based on health
      const statusCode = status.status === 'ok' ? 200 : 503;
      return reply.code(statusCode).send(status);
    } catch (err) {
      request.log.error(`Health check error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        timestamp: new Date().toISOString(),
        service: 'api-gateway',
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
}
