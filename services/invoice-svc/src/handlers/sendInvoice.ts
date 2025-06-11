import { SupabaseClient } from '@supabase/supabase-js';
import { NatsConnection } from 'nats';
import { logger } from '../utils/logger';

interface SendInvoiceRequest {
  invoice_id: string;
  organization_id: string;
  pdf_url?: string;
  email_template?: string;
}

/**
 * Handle sending an invoice via email
 */
export async function handleSendInvoice(
  request: SendInvoiceRequest, 
  supabase: SupabaseClient,
  natsClient: NatsConnection,
  jsonCodec: any // Utilisation de type 'any' pour éviter les erreurs de typage
) {
  try {
    const { invoice_id, organization_id, pdf_url, email_template = 'default' } = request;
    
    logger.info(`Sending invoice ${invoice_id} for organization ${organization_id}`);
    
    // Fetch the invoice with customer details
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        *,
        customers:customer_id(id, name, email, address, phone)
      `)
      .eq('id', invoice_id)
      .eq('organization_id', organization_id)
      .single();
    
    if (fetchError) {
      logger.error(`Error fetching invoice ${invoice_id}: ${fetchError.message}`);
      throw new Error(`Failed to retrieve invoice: ${fetchError.message}`);
    }
    
    if (!invoice) {
      throw new Error(`Invoice ${invoice_id} not found or does not belong to organization ${organization_id}`);
    }
    
    // Verify we have a PDF URL
    const pdfUrl = pdf_url || invoice.pdf_url;
    
    if (!pdfUrl) {
      logger.error(`No PDF URL available for invoice ${invoice_id}`);
      throw new Error('PDF URL is required to send the invoice');
    }
    
    // Verify customer has an email
    if (!invoice.customers?.email) {
      logger.error(`No email found for customer ${invoice.customer_id}`);
      throw new Error('Customer email is required to send the invoice');
    }
    
    // Fetch organization details for the email
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('name, email')
      .eq('id', organization_id)
      .single();
    
    if (orgError) {
      logger.error(`Error fetching organization ${organization_id}: ${orgError.message}`);
      throw new Error(`Failed to retrieve organization: ${orgError.message}`);
    }
    
    // Update invoice status to 'sent'
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', invoice_id)
      .eq('organization_id', organization_id);
    
    if (updateError) {
      logger.error(`Error updating invoice status: ${updateError.message}`);
      throw new Error(`Failed to update invoice status: ${updateError.message}`);
    }
    
    // Prepare email data
    const emailData = {
      to: invoice.customers.email,
      subject: `Facture ${invoice.number} de ${organization?.name || 'AutoInvoice'}`,
      template: email_template,
      data: {
        invoice: {
          id: invoice.id,
          number: invoice.number,
          issue_date: invoice.issue_date,
          due_date: invoice.due_date,
          subtotal: invoice.subtotal,
          tax_amount: invoice.tax_amount,
          total_amount: invoice.total_amount,
          currency: invoice.currency,
          notes: invoice.notes
        },
        customer: invoice.customers,
        organization: organization || { name: 'AutoInvoice', email: 'contact@autoinvoice.com' },
        pdf_url: pdfUrl
      }
    };
    
    // Send message to email service
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create a promise to wait for the response from the email service
    const responsePromise = new Promise<any>((resolve, reject) => {
      // Set up a timeout
      const timeout = setTimeout(() => {
        reject(new Error('Request to email service timed out'));
      }, 10000);
      
      // Subscribe to the response subject
      const subscription = natsClient.subscribe(`email.send.response.${requestId}`, {
        callback: (msg: any) => {
        clearTimeout(timeout);
        subscription.unsubscribe();
        
        try {
          const response = jsonCodec.decode(msg.data);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      }
      });
      
      // Publish the request
      natsClient.publish('email.send.request', jsonCodec.encode({
        ...emailData,
        requestId
      }));
      
      logger.info(`Published email.send.request for invoice ${invoice_id}`);
    });
    
    try {
      // Wait for the response
      const response = await responsePromise;
      logger.info(`Email sent for invoice ${invoice_id}, messageId: ${response.messageId}`);
      
      return {
        success: true,
        email: invoice.customers.email,
        message_id: response.messageId
      };
    } catch (error) {
      logger.error(`Error from email service: ${error instanceof Error ? error.message : String(error)}`);
      
      // For development/testing, we'll simulate a success response
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`Development mode: Simulating successful email sending for invoice ${invoice_id}`);
        
        return {
          success: true,
          email: invoice.customers.email,
          message_id: `mock-${requestId}`,
          mock: true
        };
      }
      
      throw error;
    }
  } catch (error) {
    logger.error(`Error in handleSendInvoice: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
