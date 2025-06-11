import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

interface DeleteInvoiceRequest {
  invoice_id: string;
  organization_id: string;
}

/**
 * Handle deleting an invoice
 */
export async function handleDeleteInvoice(request: DeleteInvoiceRequest, supabase: SupabaseClient) {
  try {
    const { invoice_id, organization_id } = request;
    
    logger.info(`Deleting invoice ${invoice_id} for organization ${organization_id}`);
    
    // First, verify the invoice exists and belongs to the organization
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, status')
      .eq('id', invoice_id)
      .eq('organization_id', organization_id)
      .single();
    
    if (fetchError) {
      logger.error(`Error fetching invoice ${invoice_id}: ${fetchError.message}`);
      throw new Error(`Failed to verify invoice: ${fetchError.message}`);
    }
    
    if (!invoice) {
      throw new Error(`Invoice ${invoice_id} not found or does not belong to organization ${organization_id}`);
    }
    
    // Check if invoice can be deleted
    // Only allow deleting invoices in draft or cancelled status
    if (invoice.status !== 'draft' && invoice.status !== 'cancelled') {
      logger.warn(`Cannot delete invoice ${invoice_id} with status ${invoice.status}`);
      throw new Error(`Cannot delete invoice with status ${invoice.status}. Only draft or cancelled invoices can be deleted.`);
    }
    
    // Delete invoice
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoice_id)
      .eq('organization_id', organization_id);
    
    if (deleteError) {
      logger.error(`Error deleting invoice ${invoice_id}: ${deleteError.message}`);
      throw new Error(`Failed to delete invoice: ${deleteError.message}`);
    }
    
    // Try to delete associated PDF from storage if it exists
    try {
      // Check if PDF exists in storage
      const bucketName = process.env.PDF_STORAGE_BUCKET || 'invoices';
      const storagePath = process.env.PDF_STORAGE_PATH || 'pdfs';
      const filePath = `${organization_id}/${storagePath}/${invoice_id}.pdf`;
      
      // Delete from storage
      await supabase
        .storage
        .from(bucketName)
        .remove([filePath]);
      
      logger.info(`Deleted PDF for invoice ${invoice_id}`);
    } catch (storageError) {
      // Don't fail the request if PDF deletion fails
      logger.warn(`Error deleting PDF for invoice ${invoice_id}: ${storageError instanceof Error ? storageError.message : String(storageError)}`);
    }
    
    logger.info(`Invoice ${invoice_id} deleted successfully`);
    return { success: true };
  } catch (error) {
    logger.error(`Error in handleDeleteInvoice: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
