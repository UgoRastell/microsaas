"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const cors_1 = __importDefault(require("@fastify/cors"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const swagger_1 = __importDefault(require("@fastify/swagger"));
const swagger_ui_1 = __importDefault(require("@fastify/swagger-ui"));
const nats_1 = require("./nats");
const routes_1 = __importDefault(require("./routes"));
const server = (0, fastify_1.default)({
    logger: true
});
// Register plugins
async function registerPlugins() {
    // Security headers
    await server.register(helmet_1.default, {
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
    await server.register(cors_1.default, {
        origin: process.env.NODE_ENV === 'production'
            ? [process.env.FRONTEND_URL || 'https://autoinvoice.app']
            : true
    });
    // Rate limiting
    await server.register(rate_limit_1.default, {
        max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        timeWindow: parseInt(process.env.RATE_LIMIT_TIMEWINDOW || '60000')
    });
    // JWT Authentication
    await server.register(jwt_1.default, {
        secret: process.env.JWT_SECRET || 'supersecret'
    });
    // Swagger documentation
    await server.register(swagger_1.default, {
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
    await server.register(swagger_ui_1.default, {
        routePrefix: '/documentation'
    });
}
// Main server setup function
async function startServer() {
    try {
        await registerPlugins();
        // Connect to NATS
        await (0, nats_1.connectNats)();
        // Register routes
        server.register(routes_1.default, { prefix: '/api' });
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
    }
    catch (err) {
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
exports.default = server;
//# sourceMappingURL=index.js.map