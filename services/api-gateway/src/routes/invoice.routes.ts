import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { publishMessage, subscribeToSubject } from '../nats';
import { NatsConnection } from 'nats';

// Extend FastifyInstance type with nats property
declare module 'fastify' {
  interface FastifyInstance {
    nats: NatsConnection;
  }
}

/**
 * Invoice routes
 */
export default async function invoiceRoutes(fastify: FastifyInstance, _options: FastifyPluginOptions) {
  
  /**
   * @swagger
   * /api/invoices:
   *   get:
   *     summary: Get all invoices for the authenticated user's organization
   *     tags:
   *       - Invoices
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *         description: Filter by invoice status (draft, sent, paid, overdue)
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *         description: Page number for pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Number of invoices per page
   *     responses:
   *       200:
   *         description: List of invoices
   *       401:
   *         description: Unauthorized
   */
  fastify.get('/', async (request: any, reply) => {
    try {
      const { page = 1, limit = 10, status } = request.query;
      const orgId = request.user.org_id;
      
      if (!orgId) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Organization ID is required'
        });
      }
      
      // Publish a request to invoice-svc to get invoices
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Create a promise that will be resolved when we get a response
      const responsePromise = new Promise((resolve, reject) => {
        // Set up a timeout
        const timeout = setTimeout(() => {
          reject(new Error('Request to invoice-svc timed out'));
        }, 5000);
        
        // Subscribe to the response subject
        const subscription = subscribeToSubject(`invoice.get.response.${requestId}`, (msg: any) => {
          clearTimeout(timeout);
          subscription.unsubscribe();
          resolve(msg);
        });
        
        // Publish the request
        publishMessage('invoice.get.request', {
          requestId,
          orgId,
          filters: { status },
          pagination: { page: parseInt(page), limit: parseInt(limit) }
        });
      });
      
      try {
        const response: any = await responsePromise;
        return response;
      } catch (error) {
        request.log.error(`Error getting invoices: ${error instanceof Error ? error.message : String(error)}`);
        
        // Fallback to mock data for development
        if (process.env.NODE_ENV !== 'production') {
          const mockInvoices = Array.from({ length: 10 }, (_, i) => ({
            id: `inv-${i+1}`,
            number: `INV-${2023000 + i + 1}`,
            customer_id: `cus-${i % 3 + 1}`,
            customer_name: `Client ${i % 3 + 1}`,
            amount: Math.floor(Math.random() * 100000) / 100,
            issue_date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
            due_date: new Date(Date.now() + (30 - i) * 86400000).toISOString().split('T')[0],
            status: ['draft', 'sent', 'paid', 'overdue'][i % 4],
            currency: 'EUR'
          }));
          
          return {
            invoices: mockInvoices,
            total: 15,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(15 / parseInt(limit))
          };
        }
        
        throw error;
      }
    } catch (err) {
      request.log.error(`Invoice fetch error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred while fetching invoices'
      });
    }
  });
  
  /**
   * @swagger
   * /api/invoices/{id}:
   *   get:
   *     summary: Get invoice by ID
   *     tags:
   *       - Invoices
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Invoice ID
   *     responses:
   *       200:
   *         description: Invoice details
   *       404:
   *         description: Invoice not found
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
      
      // Similar pattern to the GET all invoices endpoint
      // Generate request ID but commented as unused
      // const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // For development with mock data
      if (process.env.NODE_ENV !== 'production') {
        return {
          id,
          number: `INV-${id.substring(0, 6)}`,
          customer_id: 'cus-1',
          customer_name: 'Acme Inc.',
          customer_email: 'billing@acme.com',
          amount: 1250.50,
          tax_amount: 250.10,
          total_amount: 1500.60,
          issue_date: '2023-06-01',
          due_date: '2023-07-01',
          status: 'sent',
          currency: 'EUR',
          notes: 'Thank you for your business!',
          items: [
            {
              id: 'item-1',
              description: 'Website development',
              quantity: 10,
              unit_price: 125.00,
              amount: 1250.00
            }
          ]
        };
      }
      
      // Real implementation would communicate with invoice-svc
      
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Invoice with ID ${id} not found`
      });
    } catch (err) {
      request.log.error(`Invoice fetch by ID error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred while fetching invoice'
      });
    }
  });
  
  /**
   * @swagger
   * /api/invoices:
   *   post:
   *     summary: Create a new invoice
   *     tags:
   *       - Invoices
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - customer_id
   *               - items
   *             properties:
   *               customer_id:
   *                 type: string
   *               issue_date:
   *                 type: string
   *                 format: date
   *               due_date:
   *                 type: string
   *                 format: date
   *               items:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - description
   *                     - quantity
   *                     - unit_price
   *                   properties:
   *                     description:
   *                       type: string
   *                     quantity:
   *                       type: number
   *                     unit_price:
   *                       type: number
   *     responses:
   *       201:
   *         description: Invoice created successfully
   *       400:
   *         description: Invalid input
   *       401:
   *         description: Unauthorized
   */
  fastify.post('/', async (request: any, reply) => {
    try {
      const invoice = request.body;
      const orgId = request.user.org_id;
      
      if (!orgId) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Organization ID is required'
        });
      }
      
      // Add organization ID to the invoice
      invoice.organization_id = orgId;
      
      // Publish message to NATS for invoice-svc to process
      publishMessage('invoice.create', invoice);
      
      // For development with mock response
      if (process.env.NODE_ENV !== 'production') {
        return reply.code(201).send({
          id: `inv-${Date.now()}`,
          ...invoice,
          status: 'draft',
          created_at: new Date().toISOString()
        });
      }
      
      // Real implementation would wait for a response from invoice-svc
      
      return reply.code(201).send({
        message: 'Invoice creation in progress'
      });
    } catch (err) {
      request.log.error(`Invoice creation error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred while creating invoice'
      });
    }
  });
  
  /**
   * @swagger
   * /api/invoices/{id}/send:
   *   post:
   *     summary: Send an invoice by email
   *     tags:
   *       - Invoices
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Invoice ID
   *     responses:
   *       200:
   *         description: Invoice sent successfully
   *       404:
   *         description: Invoice not found
   *       401:
   *         description: Unauthorized
   */
  fastify.post('/:id/send', async (request: any, reply) => {
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
      
      // Publish message to NATS for invoice-svc to generate PDF and email-svc to send
      publishMessage('invoice.send', {
        invoice_id: id,
        organization_id: orgId
      });
      
      return {
        message: `Invoice ${id} has been queued for sending`
      };
    } catch (err) {
      request.log.error(`Invoice send error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred while sending invoice'
      });
    }
  });
  
  /**
   * @swagger
   * /api/invoices/{id}:
   *   delete:
   *     summary: Delete an invoice
   *     tags:
   *       - Invoices
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: Invoice ID
   *     responses:
   *       200:
   *         description: Invoice deleted successfully
   *       404:
   *         description: Invoice not found
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
      
      // Publish message to NATS for invoice-svc to delete
      publishMessage('invoice.delete', {
        invoice_id: id,
        organization_id: orgId
      });
      
      return {
        message: `Invoice ${id} has been deleted`
      };
    } catch (err) {
      request.log.error(`Invoice delete error: ${err instanceof Error ? err.message : String(err)}`);
      return reply.code(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred while deleting invoice'
      });
    }
  });
}
