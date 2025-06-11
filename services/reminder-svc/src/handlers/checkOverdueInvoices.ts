import { SupabaseClient } from '@supabase/supabase-js';
import { NatsConnection, JSONCodec } from 'nats';
import { logger } from '../utils/logger';

interface ReminderThresholds {
  first: number;
  second: number;
  third: number;
}

// Interface utilisée pour typer les données de Supabase
export interface Invoice {
  id: string;
  number: string;
  user_id: string;
  customer_id: string;
  organization_id: string;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  notes?: string;
  pdf_url?: string;
  customers: {
    id: string;
    email: string;
    name: string;
    address?: string;
    phone?: string;
  };
  organizations: {
    id: string;
    name: string;
    email: string;
  };
}

// Interface utilisée pour l'insertion dans la base de données
export interface Reminder {
  invoice_id: string;
  reminder_level: 'first' | 'second' | 'third';
  days_overdue: number;
  sent_at: string;
  email_id?: string;
}

interface EmailResponse {
  messageId: string;
  error?: string;
}

export async function checkOverdueInvoices(
  supabase: SupabaseClient,
  natsClient: NatsConnection,
  thresholds: ReminderThresholds
): Promise<{ overdueCount: number; remindersTriggered: number }> {
  // Créer le codec JSON pour NATS
  const jsonCodec = JSONCodec<Record<string, any>>();
  try {
    logger.info('Starting scheduled check for overdue invoices');
    
    // Current date for comparison
    const today = new Date();
    
    // Query for unpaid invoices with due date in the past
    const { data: overdueInvoices, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customers:customer_id(id, name, email, address, phone),
        organizations:organization_id(id, name, email)
      `)
      .in('status', ['sent', 'overdue'])
      .lt('due_date', today.toISOString().split('T')[0]); // Compare only the date part
    
    if (error) {
      logger.error(`Error fetching overdue invoices: ${error.message}`);
      throw error;
    }
    
    logger.info(`Found ${overdueInvoices?.length || 0} potentially overdue invoices`);
    
    if (!overdueInvoices || overdueInvoices.length === 0) {
      logger.info('No overdue invoices found');
      return { 
        overdueCount: 0, 
        remindersTriggered: 0
      };
    }
    
    let remindersTriggered = 0;
    
    // Process each overdue invoice
    for (const invoice of overdueInvoices) {
      try {
        // Skip if no customer email
        if (!invoice.customers?.email) {
          logger.warn(`Invoice ${invoice.id} has no customer email, skipping reminder`);
          continue;
        }
        
        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        logger.debug(`Invoice ${invoice.id} is ${daysOverdue} days overdue`);
        
        // Skip if not matching reminder thresholds or already has reminder
        // We want to send reminders exactly at these thresholds
        let reminderLevel: 'first' | 'second' | 'third' | '' = '';
        if (daysOverdue === thresholds.first) {
          reminderLevel = 'first';
        } else if (daysOverdue === thresholds.second) {
          reminderLevel = 'second';
        } else if (daysOverdue === thresholds.third) {
          reminderLevel = 'third';
        } else {
          // Not at a threshold day, skip
          continue;
        }
        
        // Check if we've already sent this level of reminder
        const { data: existingReminders, error: reminderError } = await supabase
          .from('invoice_reminders')
          .select('id')
          .eq('invoice_id', invoice.id)
          .eq('reminder_level', reminderLevel)
          .limit(1);
          
        if (reminderError) {
          logger.error(`Error checking existing reminders: ${reminderError.message}`);
          continue;
        }
        
        if (existingReminders && existingReminders.length > 0) {
          logger.info(`${reminderLevel} reminder already sent for invoice ${invoice.id}, skipping`);
          continue;
        }
        
        // Update invoice status to overdue if not already
        if (invoice.status !== 'overdue') {
          const { error: updateError } = await supabase
            .from('invoices')
            .update({ status: 'overdue' })
            .eq('id', invoice.id);
            
          if (updateError) {
            logger.error(`Error updating invoice status to overdue: ${updateError.message}`);
          }
        }
        
        // Send reminder email
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        const emailData = {
          to: invoice.customers.email,
          subject: `Rappel de paiement - Facture ${invoice.number}`,
          template: 'reminder',
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
            organization: invoice.organizations,
            days_overdue: daysOverdue,
            pdf_url: invoice.pdf_url,
            reminder_level: reminderLevel,
            current_year: today.getFullYear()
          },
          requestId
        };
        
        // Create a promise to wait for the response from the email service
        const emailPromise = new Promise<EmailResponse>((resolve, reject) => {
          // Set up a timeout
          const timeout = setTimeout(() => {
            reject(new Error('Request to email service timed out'));
          }, 10000);
          
          // Subscribe to the response subject
          const subscription = natsClient.subscribe(`email.send.response.${requestId}`);
          
          // Process responses asynchronously
          (async () => {
            for await (const msg of subscription) {
              clearTimeout(timeout);
              subscription.unsubscribe();
              
              try {
                const response = jsonCodec.decode(msg.data) as EmailResponse;
                if (response.error) {
                  reject(new Error(response.error));
                } else {
                  resolve(response);
                }
              } catch (error) {
                reject(error);
              }
              break; // Important: break after processing the first message
            }
          })();
          
          // Publish the email request
          natsClient.publish('email.send.request', jsonCodec.encode(emailData));
          logger.info(`Published reminder email request for invoice ${invoice.id} (${reminderLevel} reminder)`);
        });
        
        try {
          // Wait for email response
          const emailResult = await emailPromise;
          
          // Record the reminder in database
          const { error: insertError } = await supabase
            .from('invoice_reminders')
            .insert({
              invoice_id: invoice.id,
              reminder_level: reminderLevel,
              days_overdue: daysOverdue,
              sent_at: new Date().toISOString(),
              email_id: emailResult.messageId
            });
            
          if (insertError) {
            logger.error(`Error recording reminder: ${insertError.message}`);
          }
          
          // Publish reminder event
          natsClient.publish('reminder.sent', jsonCodec.encode({
            invoice_id: invoice.id,
            customer_id: invoice.customer_id,
            organization_id: invoice.organization_id,
            reminder_level: reminderLevel,
            days_overdue: daysOverdue,
            email_id: emailResult.messageId,
            sent_at: new Date().toISOString()
          }));
          
          logger.info(`Successfully sent ${reminderLevel} reminder for invoice ${invoice.id}`);
          remindersTriggered++;
        } catch (error) {
          logger.error(`Error sending reminder for invoice ${invoice.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      } catch (invoiceError) {
        logger.error(`Error processing invoice ${invoice.id}: ${invoiceError instanceof Error ? invoiceError.message : String(invoiceError)}`);
      }
    }
    
    logger.info(`Completed overdue invoice check, sent ${remindersTriggered} reminders`);
    
    return {
      overdueCount: overdueInvoices.length,
      remindersTriggered
    };
  } catch (error) {
    logger.error(`Error in checkOverdueInvoices: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
