"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const supabase_js_1 = require("@supabase/supabase-js");
// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
/**
 * Auth routes
 */
async function authRoutes(fastify, _options) {
    /**
     * @swagger
     * /api/auth/validate:
     *   post:
     *     summary: Validate Supabase JWT and issue our own JWT
     *     tags:
     *       - Auth
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: JWT token validated and new token issued
     *       401:
     *         description: Unauthorized
     */
    fastify.post('/validate', async (request, reply) => {
        try {
            const authHeader = request.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return reply.code(401).send({
                    statusCode: 401,
                    error: 'Unauthorized',
                    message: 'Missing or invalid bearer token'
                });
            }
            const supabaseToken = authHeader.split(' ')[1];
            // Verify token with Supabase
            const { data: { user }, error } = await supabase.auth.getUser(supabaseToken);
            if (error || !user) {
                return reply.code(401).send({
                    statusCode: 401,
                    error: 'Unauthorized',
                    message: 'Invalid token'
                });
            }
            // Get user organization from profiles table
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('organization_id')
                .eq('user_id', user.id)
                .single();
            if (profileError) {
                fastify.log.error(`Error fetching profile for user ${user.id}: ${profileError.message}`);
            }
            // Generate our own JWT
            const token = fastify.jwt.sign({
                sub: user.id,
                email: user.email,
                org_id: profile?.organization_id,
            }, {
                expiresIn: process.env.JWT_EXPIRES || '1h'
            });
            return {
                token,
                user: {
                    id: user.id,
                    email: user.email
                }
            };
        }
        catch (err) {
            request.log.error(`Auth validation error: ${err instanceof Error ? err.message : String(err)}`);
            return reply.code(500).send({
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'An error occurred while validating authentication'
            });
        }
    });
    /**
     * @swagger
     * /api/auth/me:
     *   get:
     *     summary: Get the current authenticated user
     *     tags:
     *       - Auth
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: User information retrieved successfully
     *       401:
     *         description: Unauthorized
     */
    fastify.get('/me', { onRequest: [fastify.authenticate] }, async (request, reply) => {
        try {
            const user = request.user;
            return {
                user: {
                    id: user.sub,
                    email: user.email,
                    org_id: user.org_id
                }
            };
        }
        catch (err) {
            request.log.error(`Auth me error: ${err instanceof Error ? err.message : String(err)}`);
            return reply.code(500).send({
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'An error occurred while retrieving user information'
            });
        }
    });
}
//# sourceMappingURL=auth.routes.js.map