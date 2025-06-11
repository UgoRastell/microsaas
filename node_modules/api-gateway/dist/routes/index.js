"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = routes;
const invoice_routes_1 = __importDefault(require("./invoice.routes"));
const auth_routes_1 = __importDefault(require("./auth.routes"));
const health_routes_1 = __importDefault(require("./health.routes"));
const customer_routes_1 = __importDefault(require("./customer.routes"));
async function routes(fastify, _options) {
    // Auth middleware for protected routes
    fastify.decorate('authenticate', async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch (err) {
            reply.code(401).send({
                statusCode: 401,
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }
    });
    // Register routes
    fastify.register(health_routes_1.default);
    fastify.register(auth_routes_1.default, { prefix: '/auth' });
    // Protected routes
    fastify.register(async function (instance) {
        instance.addHook('onRequest', fastify.authenticate);
        instance.register(invoice_routes_1.default, { prefix: '/invoices' });
        instance.register(customer_routes_1.default, { prefix: '/customers' });
    });
}
//# sourceMappingURL=index.js.map