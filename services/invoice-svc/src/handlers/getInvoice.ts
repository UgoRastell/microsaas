import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

interface GetInvoiceRequest {
  requestId?: string;
  orgId: string;
  invoiceId?: string;
  filters?: {
    status?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

/**
 * Handle retrieving invoices with filtering and pagination
 */
export async function handleGetInvoice(request: GetInvoiceRequest, supabase: SupabaseClient) {
  try {
    const { orgId, invoiceId, filters, pagination } = request;
    
    logger.info(`Retrieving invoices for organization ${orgId}`);
    
    // If a specific invoice ID is provided, return just that invoice
    if (invoiceId) {
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers(id, name, email)
        `)
        .eq('id', invoiceId)
        .eq('organization_id', orgId)
        .single();
      
      if (error) {
        logger.error(`Error fetching invoice ${invoiceId}: ${error.message}`);
        throw new Error(`Failed to retrieve invoice: ${error.message}`);
      }
      
      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }
      
      return { invoice };
    }
    
    // Otherwise, return a list of invoices with filters and pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 10;
    const offset = (page - 1) * limit;
    
    // Start building the query
    let query = supabase
      .from('invoices')
      .select(`
        *,
        customers:customer_id(id, name, email)
      `, { count: 'exact' })
      .eq('organization_id', orgId);
    
    // Apply filters if provided
    if (filters) {
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.customerId) {
        query = query.eq('customer_id', filters.customerId);
      }
      
      if (filters.startDate) {
        query = query.gte('issue_date', filters.startDate);
      }
      
      if (filters.endDate) {
        query = query.lte('issue_date', filters.endDate);
      }
    }
    
    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Execute the query
    const { data: invoices, error, count } = await query;
    
    if (error) {
      logger.error(`Error fetching invoices: ${error.message}`);
      throw new Error(`Failed to retrieve invoices: ${error.message}`);
    }
    
    // Format the response
    return {
      invoices: invoices.map(invoice => ({
        ...invoice,
        customer_name: invoice.customers?.name,
        customer_email: invoice.customers?.email
      })),
      total: count || 0,
      page,
      limit,
      pages: count ? Math.ceil(count / limit) : 0
    };
  } catch (error) {
    logger.error(`Error in handleGetInvoice: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
