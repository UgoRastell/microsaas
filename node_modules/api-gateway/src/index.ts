import 'dotenv/config';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';

import { connectNats } from './nats';
import routes from './routes';

const server: FastifyInstance = Fastify({
  logger: true
});

// Register plugins
async function registerPlugins() {
  // Security headers
  await server.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'validator.swagger.io'],
        scriptSrc: ["'self'", "https: 'unsafe-inline'"],
      },
    }
  });
  
  // CORS
  await server.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL || 'https://autoinvoice.app'] 
      : true
  });
  
  // Rate limiting
  await server.register(fastifyRateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_TIMEWINDOW || '60000')
  });
  
  // JWT Authentication
  await server.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret'
  });

  // Swagger documentation
  await server.register(swagger, {
    swagger: {
      info: {
        title: 'AutoInvoice API',
        description: 'API documentation for AutoInvoice',
        version: '1.0.0'
      },
      externalDocs: {
        url: 'https://swagger.io',
        description: 'Find more info here'
      },
      host: 'localhost',
      schemes: ['http'],
      consumes: ['application/json'],
      produces: ['application/json']
    }
  });
  
  await server.register(swaggerUI, {
    routePrefix: '/documentation'
  });
}

// Main server setup function
async function startServer() {
  try {
    await registerPlugins();
    
    // Connect to NATS
    await connectNats();
    
    // Register routes
    server.register(routes, { prefix: '/api' });

    // Default route - Redirect to docs
    server.get('/', async (_request, reply) => {
      return reply.redirect('/documentation');
    });

    // Handle 404
    server.setNotFoundHandler((_request, reply) => {
      reply.code(404).send({ 
        statusCode: 404,
        error: 'Not Found',
        message: `Route ${_request.method}:${_request.url} not found`
      });
    });

    // Start the server
    const port = parseInt(process.env.PORT || '8000');
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    console.log(`Server is running on ${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

// Start the server
startServer();

// Export server for testing
export default server;
