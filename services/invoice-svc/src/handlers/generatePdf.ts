import { SupabaseClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

interface GeneratePdfRequest {
  invoice_id: string;
  organization_id: string;
}

/**
 * Handle generating a PDF for an invoice
 */
export async function handleGeneratePdf(request: GeneratePdfRequest, supabase: SupabaseClient) {
  try {
    const { invoice_id, organization_id } = request;
    
    logger.info(`Generating PDF for invoice ${invoice_id}`);
    
    // Fetch the invoice data with customer details
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customers:customer_id(id, name, email, address, phone)
      `)
      .eq('id', invoice_id)
      .eq('organization_id', organization_id)
      .single();
    
    if (error) {
      logger.error(`Error fetching invoice ${invoice_id}: ${error.message}`);
      throw new Error(`Failed to retrieve invoice: ${error.message}`);
    }
    
    if (!invoice) {
      throw new Error(`Invoice ${invoice_id} not found`);
    }
    
    // Fetch organization details
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organization_id)
      .single();
    
    if (orgError) {
      logger.error(`Error fetching organization ${organization_id}: ${orgError.message}`);
      throw new Error(`Failed to retrieve organization: ${orgError.message}`);
    }
    
    // Load invoice template
    const templateFilePath = path.join(__dirname, '../templates/invoice.html');
    
    let templateHtml;
    try {
      templateHtml = await fs.readFile(templateFilePath, 'utf-8');
    } catch (err) {
      // If template file doesn't exist (in development), use a default template
      templateHtml = getDefaultInvoiceTemplate();
    }
    
    // Compile the template
    const template = Handlebars.compile(templateHtml);
    
    // Prepare the data for the template
    const data = {
      invoice: {
        ...invoice,
        issue_date: formatDate(invoice.issue_date),
        due_date: formatDate(invoice.due_date),
        items: invoice.items || [],
        subtotal: formatCurrency(invoice.subtotal, invoice.currency),
        tax_amount: formatCurrency(invoice.tax_amount, invoice.currency),
        total_amount: formatCurrency(invoice.total_amount, invoice.currency),
        tax_rate_percentage: (invoice.tax_rate * 100).toFixed(0)
      },
      customer: invoice.customers,
      organization: organization || {
        name: 'My Company',
        address: 'Company Address',
        email: 'contact@company.com',
        phone: '+1234567890'
      }
    };
    
    // Generate HTML with the template
    const html = template(data);
    
    // Launch puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Create a new page
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      }
    });
    
    // Close the browser
    await browser.close();
    
    // Generate PDF filename
    const pdfFilename = `${invoice.number.replace(/\s+/g, '_')}.pdf`;
    
    // Store PDF in Supabase Storage
    const bucketName = process.env.PDF_STORAGE_BUCKET || 'invoices';
    const storagePath = process.env.PDF_STORAGE_PATH || 'pdfs';
    
    // Check if bucket exists and create it if not
    const { data: bucketData, error: bucketError } = await supabase
      .storage
      .listBuckets();
    
    if (bucketError) {
      logger.error(`Error checking buckets: ${bucketError.message}`);
      throw new Error(`Failed to check storage buckets: ${bucketError.message}`);
    }
    
    const bucketExists = bucketData.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      const { error: createBucketError } = await supabase
        .storage
        .createBucket(bucketName, {
          public: false
        });
      
      if (createBucketError) {
        logger.error(`Error creating bucket: ${createBucketError.message}`);
        throw new Error(`Failed to create storage bucket: ${createBucketError.message}`);
      }
    }
    
    // Upload PDF to storage
    const filePath = `${organization_id}/${storagePath}/${pdfFilename}`;
    const { error: uploadError } = await supabase
      .storage
      .from(bucketName)
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (uploadError) {
      logger.error(`Error uploading PDF: ${uploadError.message}`);
      throw new Error(`Failed to upload PDF: ${uploadError.message}`);
    }
    
    // Get public URL for the PDF
    const { data: { publicUrl } } = supabase
      .storage
      .from(bucketName)
      .getPublicUrl(filePath);
    
    // Update invoice with PDF URL
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ pdf_url: publicUrl })
      .eq('id', invoice_id);
    
    if (updateError) {
      logger.error(`Error updating invoice with PDF URL: ${updateError.message}`);
    }
    
    logger.info(`PDF generated successfully for invoice ${invoice_id}`);
    return {
      invoice_id,
      pdf_url: publicUrl,
      success: true
    };
  } catch (error) {
    logger.error(`Error in handleGeneratePdf: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Format currency based on the currency code
 */
function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR').format(date);
}

/**
 * Return a default invoice template for development
 */
function getDefaultInvoiceTemplate(): string {
  return `
  <!DOCTYPE html>
  <html lang="fr">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facture {{invoice.number}}</title>
    <style>
      body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        margin: 0;
        padding: 0;
        color: #333;
        background-color: #fff;
      }
      .invoice-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 30px;
      }
      .invoice-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 40px;
      }
      .company-logo {
        font-size: 24px;
        font-weight: bold;
        color: #2563eb;
      }
      .invoice-title {
        text-align: right;
      }
      .invoice-title h1 {
        color: #2563eb;
        margin: 0;
        font-size: 28px;
      }
      .invoice-title p {
        margin: 5px 0;
      }
      .invoice-details {
        display: flex;
        justify-content: space-between;
        margin-bottom: 30px;
      }
      .invoice-details-col {
        flex-basis: 45%;
      }
      .invoice-details-col h3 {
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 5px;
        margin-bottom: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 30px;
      }
      th {
        background-color: #f3f4f6;
        text-align: left;
        padding: 10px;
        border-bottom: 2px solid #e5e7eb;
      }
      td {
        padding: 10px;
        border-bottom: 1px solid #e5e7eb;
      }
      .text-right {
        text-align: right;
      }
      .invoice-totals {
        margin-top: 30px;
        display: flex;
        justify-content: flex-end;
      }
      .totals-table {
        width: 40%;
      }
      .totals-table td {
        padding: 5px 10px;
      }
      .totals-table tr.total td {
        font-weight: bold;
        border-top: 2px solid #e5e7eb;
      }
      .invoice-footer {
        margin-top: 50px;
        text-align: center;
        font-size: 14px;
        color: #6b7280;
        border-top: 1px solid #e5e7eb;
        padding-top: 20px;
      }
    </style>
  </head>
  <body>
    <div class="invoice-container">
      <div class="invoice-header">
        <div class="company-logo">
          {{organization.name}}
        </div>
        <div class="invoice-title">
          <h1>FACTURE</h1>
          <p>Facture n° {{invoice.number}}</p>
          <p>Date d'émission: {{invoice.issue_date}}</p>
          <p>Date d'échéance: {{invoice.due_date}}</p>
        </div>
      </div>
      
      <div class="invoice-details">
        <div class="invoice-details-col">
          <h3>De</h3>
          <p>{{organization.name}}</p>
          <p>{{organization.address}}</p>
          <p>Email: {{organization.email}}</p>
          <p>Tél: {{organization.phone}}</p>
        </div>
        <div class="invoice-details-col">
          <h3>À</h3>
          <p>{{customer.name}}</p>
          <p>{{customer.address}}</p>
          <p>Email: {{customer.email}}</p>
          <p>Tél: {{customer.phone}}</p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantité</th>
            <th>Prix unitaire</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          {{#each invoice.items}}
          <tr>
            <td>{{description}}</td>
            <td>{{quantity}}</td>
            <td>{{unit_price}} {{../invoice.currency}}</td>
            <td>{{amount}} {{../invoice.currency}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
      
      <div class="invoice-totals">
        <table class="totals-table">
          <tr>
            <td>Sous-total</td>
            <td class="text-right">{{invoice.subtotal}}</td>
          </tr>
          <tr>
            <td>TVA ({{invoice.tax_rate_percentage}}%)</td>
            <td class="text-right">{{invoice.tax_amount}}</td>
          </tr>
          <tr class="total">
            <td>Total</td>
            <td class="text-right">{{invoice.total_amount}}</td>
          </tr>
        </table>
      </div>
      
      {{#if invoice.notes}}
      <div style="margin-top: 30px;">
        <h3>Notes</h3>
        <p>{{invoice.notes}}</p>
      </div>
      {{/if}}
      
      <div class="invoice-footer">
        <p>Merci pour votre confiance!</p>
      </div>
    </div>
  </body>
  </html>`;
}
