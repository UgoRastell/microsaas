import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount?: number;
}

interface InvoiceData {
  customer_id: string;
  organization_id: string;
  issue_date?: string;
  due_date?: string;
  items: InvoiceItem[];
  notes?: string;
  currency?: string;
}

/**
 * Handle creating a new invoice
 */
export async function handleCreateInvoice(data: InvoiceData, supabase: SupabaseClient) {
  try {
    logger.info(`Creating invoice for customer ${data.customer_id}`);
    
    // Generate invoice ID
    const invoiceId = `inv-${uuidv4()}`;
    
    // Calculate invoice number (in a production system, this would be more sophisticated)
    const { data: lastInvoice, error: countError } = await supabase
      .from('invoices')
      .select('number')
      .eq('organization_id', data.organization_id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    let nextNumber = 1;
    const currentYear = new Date().getFullYear();
    
    if (!countError && lastInvoice && lastInvoice.length > 0) {
      // Extract number from last invoice if available
      const lastNumber = lastInvoice[0].number;
      if (lastNumber && lastNumber.includes('-')) {
        const numberPart = parseInt(lastNumber.split('-')[1]);
        if (!isNaN(numberPart)) {
          nextNumber = numberPart + 1;
        }
      }
    }
    
    // Format invoice number as INV-YYYYXXXX (e.g., INV-20230001)
    const invoiceNumber = `INV-${currentYear}${nextNumber.toString().padStart(4, '0')}`;
    
    // Set default dates if not provided
    const today = new Date();
    const issueDate = data.issue_date || today.toISOString().split('T')[0];
    
    // Default due date is 30 days from issue date if not provided
    let dueDate = data.due_date;
    if (!dueDate) {
      const due = new Date(issueDate);
      due.setDate(due.getDate() + 30);
      dueDate = due.toISOString().split('T')[0];
    }
    
    // Calculate totals
    let subtotal = 0;
    const items = data.items.map(item => {
      const amount = item.quantity * item.unit_price;
      subtotal += amount;
      return {
        ...item,
        amount
      };
    });
    
    // Apply a default 20% tax rate (this should come from settings in a real app)
    const taxRate = 0.20;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;
    
    // Create the invoice object
    const invoice = {
      id: invoiceId,
      number: invoiceNumber,
      customer_id: data.customer_id,
      organization_id: data.organization_id,
      issue_date: issueDate,
      due_date: dueDate,
      items,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: 'draft',
      notes: data.notes || '',
      currency: data.currency || 'EUR',
      created_at: new Date().toISOString(),
    };
    
    // Insert into Supabase
    const { data: savedInvoice, error } = await supabase
      .from('invoices')
      .insert(invoice)
      .select()
      .single();
    
    if (error) {
      logger.error(`Error inserting invoice: ${error.message}`);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
    
    logger.info(`Invoice created successfully: ${invoiceId}`);
    return savedInvoice;
  } catch (error) {
    logger.error(`Error in handleCreateInvoice: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
