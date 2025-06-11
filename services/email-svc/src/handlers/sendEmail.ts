import { Resend } from 'resend';
import Handlebars from 'handlebars';
import { logger } from '../utils/logger';
import { getEmailTemplate } from '../templates';

// Initialize Resend SDK
const resendApiKey = process.env.RESEND_API_KEY || '';
const resend = new Resend(resendApiKey);

// Default sender configuration
const defaultFromEmail = process.env.FROM_EMAIL || 'invoices@autoinvoice.app';
const defaultFromName = process.env.FROM_NAME || 'AutoInvoice';

interface SendEmailRequest {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
  requestId?: string;
}

/**
 * Handle sending an email using Resend API
 */
export async function handleSendEmail(request: SendEmailRequest) {
  try {
    const {
      to,
      subject,
      template,
      data,
      from = `${defaultFromName} <${defaultFromEmail}>`,
      cc,
      bcc,
      replyTo,
      attachments
    } = request;
    
    logger.info(`Preparing to send email to ${to} using template ${template}`);
    
    // Get the appropriate email template
    const templateContent = getEmailTemplate(template);
    
    // Compile the template with Handlebars
    const compiledTemplate = Handlebars.compile(templateContent);
    
    // Generate HTML content from template and data
    const html = compiledTemplate(data);
    
    // Prepare email options
    const emailOptions = {
      from,
      to,
      subject,
      html,
      text: stripHtml(html), // Plain text version
      cc,
      bcc,
      reply_to: replyTo,
      attachments
    };
    
    // Send using Resend API if in production or if API key is provided
    if (process.env.NODE_ENV === 'production' || resendApiKey) {
      logger.info(`Sending email to ${to} via Resend API`);
      
      const { data: responseData, error } = await resend.emails.send(emailOptions);
      
      if (error) {
        logger.error(`Error sending email: ${error.message}`);
        throw new Error(`Failed to send email: ${error.message}`);
      }
      
      logger.info(`Email sent successfully to ${to}, message ID: ${responseData?.id}`);
      
      return {
        success: true,
        messageId: responseData?.id
      };
    } else {
      // Log email details in development mode (don't actually send)
      logger.info(`[DEV MODE] Email would be sent to ${to}`);
      logger.info(`[DEV MODE] Subject: ${subject}`);
      logger.info(`[DEV MODE] Template: ${template}`);
      
      // In development, simulate a successful send
      const mockMessageId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      return {
        success: true,
        messageId: mockMessageId,
        mock: true
      };
    }
  } catch (error) {
    logger.error(`Error in handleSendEmail: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Simple function to strip HTML tags for plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ') // Replace tags with space
    .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
    .trim();
}
