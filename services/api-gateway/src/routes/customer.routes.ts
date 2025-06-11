import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { publishMessage } from '../nats';

/**
 * Customer routes
 */
export default async function customerRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  
  /**
   * @swagger
   * /api/customers:
   *   get:
   *     summary: Get all customers for the authenticated user's organization
   *     tags:
   *       - Customers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term to filter customers by name or email
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *         description: Page number for pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Number of customers per page
   *     responses:
   *       200:
   *         description: List of customers
   *       401:
   *         description: Unauthorized
   */
  fastify.get('/', async (request: any, reply) => {
    try {
      const { page = 1, limit = 10, search: _search } = request.query;
      const orgId = request.user.org_id;
      
      if (!orgId) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Organization ID is required'
        });
      }
      
      // For development with mock data
      if (process.env.NODE_ENV !== 'production') {
        return {
          customers: Array.from({ length: 5 }, (_, i) => ({
            id: `cus-${i+1}`,
            name: `Client ${i+1}`,
            email: `client${i+1}@example.com`,
            phone: `+33 6 12 34 56 ${i+1}`,
            address: `${i+10} Rue de Paris, 75001 Paris, France`,
            created_at: new Date(Date.now() - i * 86400000).toISOString()
          })),
          total: 5,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(5 / parseInt(limit))
        };
      }
      
      // Real implementation would communicate with a customer microservice
      // through NATS in a request-reply pattern
      
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Customer service not implemented yet'
      });
    } catch (err) {
      request.log.error(`Customer fetch error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred while fetching customers'
      });
    }
  });
  
  /**
   * @swagger
   * /api/customers/{id}:
   *   get:
   *     summary: Get customer by ID
   *     tags:
   *       - Customers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Customer ID
   *     responses:
   *       200:
   *         description: Customer details
   *       404:
   *         description: Customer not found
   *       401:
   *         description: Unauthorized
   */
  fastify.get('/:id', async (request: any, reply) => {
    try {
      const { id } = request.params;
      const orgId = request.user.org_id;
      
      if (!orgId) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Organization ID is required'
        });
      }
      
      // For development with mock data
      if (process.env.NODE_ENV !== 'production') {
        // Generate a deterministic customer based on the ID
        const idNumber = parseInt(id.replace(/\D/g, '')) || 1;
        
        return {
          id,
          name: `Client ${idNumber}`,
          email: `client${idNumber}@example.com`,
          phone: `+33 6 12 34 56 ${idNumber % 10}`,
          address: `${(idNumber * 10) % 100} Rue de Paris, 75001 Paris, France`,
          notes: 'Important client.',
          created_at: new Date(Date.now() - idNumber * 86400000).toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      // Real implementation would communicate with a customer microservice
      
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Customer with ID ${id} not found`
      });
    } catch (err) {
      request.log.error(`Customer fetch by ID error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred while fetching customer'
      });
    }
  });
  
  /**
   * @swagger
   * /api/customers:
   *   post:
   *     summary: Create a new customer
   *     tags:
   *       - Customers
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *               - email
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               phone:
   *                 type: string
   *               address:
   *                 type: string
   *               notes:
   *                 type: string
   *     responses:
   *       201:
   *         description: Customer created successfully
   *       400:
   *         description: Invalid input
   *       401:
   *         description: Unauthorized
   */
  fastify.post('/', async (request: any, reply) => {
    try {
      const customer = request.body;
      const orgId = request.user.org_id;
      
      if (!orgId) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Organization ID is required'
        });
      }
      
      // Add organization ID to the customer
      customer.organization_id = orgId;
      
      // Publish message to NATS for customer service to process
      publishMessage('customer.create', customer);
      
      // For development with mock response
      if (process.env.NODE_ENV !== 'production') {
        return reply.code(201).send({
          id: `cus-${Date.now()}`,
          ...customer,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      // Real implementation would wait for a response
      
      return reply.code(201).send({
        message: 'Customer creation in progress'
      });
    } catch (err) {
      request.log.error(`Customer creation error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred while creating customer'
      });
    }
  });
  
  /**
   * @swagger
   * /api/customers/{id}:
   *   put:
   *     summary: Update a customer
   *     tags:
   *       - Customers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Customer ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               phone:
   *                 type: string
   *               address:
   *                 type: string
   *               notes:
   *                 type: string
   *     responses:
   *       200:
   *         description: Customer updated successfully
   *       404:
   *         description: Customer not found
   *       401:
   *         description: Unauthorized
   */
  fastify.put('/:id', async (request: any, reply) => {
    try {
      const { id } = request.params;
      const customer = request.body;
      const orgId = request.user.org_id;
      
      if (!orgId) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Organization ID is required'
        });
      }
      
      // Publish message to NATS for customer service to process
      publishMessage('customer.update', {
        id,
        organization_id: orgId,
        ...customer
      });
      
      // For development with mock response
      if (process.env.NODE_ENV !== 'production') {
        return {
          id,
          ...customer,
          organization_id: orgId,
          updated_at: new Date().toISOString()
        };
      }
      
      // Real implementation would wait for a response
      
      return {
        message: `Customer ${id} has been updated`
      };
    } catch (err) {
      request.log.error(`Customer update error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred while updating customer'
      });
    }
  });
  
  /**
   * @swagger
   * /api/customers/{id}:
   *   delete:
   *     summary: Delete a customer
   *     tags:
   *       - Customers
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Customer ID
   *     responses:
   *       200:
   *         description: Customer deleted successfully
   *       404:
   *         description: Customer not found
   *       401:
   *         description: Unauthorized
   */
  fastify.delete('/:id', async (request: any, reply) => {
    try {
      const { id } = request.params;
      const orgId = request.user.org_id;
      
      if (!orgId) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Organization ID is required'
        });
      }
      
      // Publish message to NATS for customer service to process
      publishMessage('customer.delete', {
        id,
        organization_id: orgId
      });
      
      return {
        message: `Customer ${id} has been deleted`
      };
    } catch (err) {
      request.log.error(`Customer delete error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred while deleting customer'
      });
    }
  });
}
