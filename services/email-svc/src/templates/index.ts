import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

// Templates cache
const templates = new Map<string, string>();

// Load template from file if available
function loadTemplateFromFile(templateName: string): string | null {
  try {
    const templatePath = path.join(__dirname, `${templateName}.html`);
    if (fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, 'utf8');
    }
    return null;
  } catch (error) {
    logger.warn(`Could not load template file ${templateName}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get an email template by name
 */
export function getEmailTemplate(templateName: string = 'default'): string {
  // First check if we have the template cached
  if (templates.has(templateName)) {
    return templates.get(templateName)!;
  }
  
  // Try to load from file
  const fileTemplate = loadTemplateFromFile(templateName);
  if (fileTemplate) {
    templates.set(templateName, fileTemplate);
    return fileTemplate;
  }
  
  // Return default template based on type
  let template: string;
  
  switch (templateName) {
    case 'invoice':
      template = getInvoiceTemplate();
      break;
    case 'reminder':
      template = getReminderTemplate();
      break;
    case 'receipt':
      template = getReceiptTemplate();
      break;
    default:
      template = getDefaultTemplate();
  }
  
  // Cache the template
  templates.set(templateName, template);
  return template;
}

/**
 * Get the default email template
 */
function getDefaultTemplate(): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>{{subject}}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          border-bottom: 1px solid #eaeaea;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
          text-decoration: none;
        }
        .content {
          padding: 20px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eaeaea;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          background-color: #2563eb;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 4px;
          margin: 20px 0;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="https://autoinvoice.app" class="logo">AutoInvoice</a>
        </div>
        <div class="content">
          <h1>{{subject}}</h1>
          <p>Bonjour,</p>
          <p>{{message}}</p>
          {{#if action_url}}
          <div style="text-align: center;">
            <a href="{{action_url}}" class="button">{{action_text}}</a>
          </div>
          {{/if}}
          <p>Cordialement,<br>L'équipe AutoInvoice</p>
        </div>
        <div class="footer">
          <p>&copy; {{current_year}} AutoInvoice. Tous droits réservés.</p>
          <p>
            <a href="https://autoinvoice.app/privacy">Politique de confidentialité</a> | 
            <a href="https://autoinvoice.app/terms">Conditions d'utilisation</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get the invoice email template
 */
function getInvoiceTemplate(): string {
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
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          border-bottom: 1px solid #eaeaea;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
          text-decoration: none;
        }
        .content {
          padding: 20px 0;
        }
        .invoice-details {
          background-color: #f3f4f6;
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
        }
        .invoice-details p {
          margin: 5px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eaeaea;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          background-color: #2563eb;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 4px;
          margin: 20px 0;
          font-weight: bold;
        }
        .invoice-summary {
          margin: 20px 0;
        }
        .invoice-summary table {
          width: 100%;
          border-collapse: collapse;
        }
        .invoice-summary th, .invoice-summary td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #eaeaea;
        }
        .invoice-summary th {
          background-color: #f3f4f6;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="https://autoinvoice.app" class="logo">{{organization.name}}</a>
        </div>
        <div class="content">
          <h1>Facture {{invoice.number}}</h1>
          <p>Bonjour {{customer.name}},</p>
          <p>Veuillez trouver ci-joint votre facture {{invoice.number}}.</p>
          
          <div class="invoice-details">
            <p><strong>Facture N° :</strong> {{invoice.number}}</p>
            <p><strong>Date d'émission :</strong> {{invoice.issue_date}}</p>
            <p><strong>Date d'échéance :</strong> {{invoice.due_date}}</p>
            <p><strong>Montant total :</strong> {{invoice.total_amount}} {{invoice.currency}}</p>
          </div>
          
          <div class="invoice-summary">
            <h3>Résumé de la facture</h3>
            <table>
              <tr>
                <td><strong>Sous-total :</strong></td>
                <td>{{invoice.subtotal}} {{invoice.currency}}</td>
              </tr>
              <tr>
                <td><strong>TVA :</strong></td>
                <td>{{invoice.tax_amount}} {{invoice.currency}}</td>
              </tr>
              <tr>
                <td><strong>Total :</strong></td>
                <td>{{invoice.total_amount}} {{invoice.currency}}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center;">
            <a href="{{pdf_url}}" class="button">Télécharger la facture</a>
          </div>
          
          {{#if invoice.notes}}
          <div style="margin-top: 20px;">
            <h3>Notes</h3>
            <p>{{invoice.notes}}</p>
          </div>
          {{/if}}
          
          <p>Pour toute question concernant cette facture, n'hésitez pas à nous contacter.</p>
          
          <p>Cordialement,<br>L'équipe {{organization.name}}</p>
        </div>
        <div class="footer">
          <p>&copy; {{current_year}} {{organization.name}}. Tous droits réservés.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get the reminder email template
 */
function getReminderTemplate(): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rappel de paiement - Facture {{invoice.number}}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          border-bottom: 1px solid #eaeaea;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
          text-decoration: none;
        }
        .content {
          padding: 20px 0;
        }
        .invoice-details {
          background-color: #f3f4f6;
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
        }
        .invoice-details p {
          margin: 5px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eaeaea;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }
        .button {
          display: inline-block;
          background-color: #2563eb;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 4px;
          margin: 20px 0;
          font-weight: bold;
        }
        .reminder {
          border-left: 4px solid #f97316;
          padding-left: 15px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="https://autoinvoice.app" class="logo">{{organization.name}}</a>
        </div>
        <div class="content">
          <h1>Rappel de paiement</h1>
          <p>Bonjour {{customer.name}},</p>
          
          <div class="reminder">
            <p>Nous vous rappelons que la facture {{invoice.number}} d'un montant de {{invoice.total_amount}} {{invoice.currency}} est actuellement en attente de règlement.</p>
            <p>La date d'échéance était le <strong>{{invoice.due_date}}</strong>.</p>
          </div>
          
          <div class="invoice-details">
            <p><strong>Facture N° :</strong> {{invoice.number}}</p>
            <p><strong>Date d'émission :</strong> {{invoice.issue_date}}</p>
            <p><strong>Date d'échéance :</strong> {{invoice.due_date}}</p>
            <p><strong>Montant total :</strong> {{invoice.total_amount}} {{invoice.currency}}</p>
            <p><strong>Retard :</strong> {{days_overdue}} jours</p>
          </div>
          
          <div style="text-align: center;">
            <a href="{{pdf_url}}" class="button">Télécharger la facture</a>
          </div>
          
          <p>Si vous avez déjà effectué le règlement, nous vous prions de ne pas tenir compte de ce message et nous vous remercions.</p>
          
          <p>Pour toute question concernant cette facture, n'hésitez pas à nous contacter.</p>
          
          <p>Cordialement,<br>L'équipe {{organization.name}}</p>
        </div>
        <div class="footer">
          <p>&copy; {{current_year}} {{organization.name}}. Tous droits réservés.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Get the receipt email template
 */
function getReceiptTemplate(): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reçu de paiement - Facture {{invoice.number}}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f9f9f9;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #ffffff;
        }
        .header {
          text-align: center;
          padding: 20px 0;
          border-bottom: 1px solid #eaeaea;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #2563eb;
          text-decoration: none;
        }
        .content {
          padding: 20px 0;
        }
        .receipt-details {
          background-color: #f3f4f6;
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
        }
        .receipt-details p {
          margin: 5px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eaeaea;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }
        .confirmation {
          border-left: 4px solid #22c55e;
          padding-left: 15px;
          margin: 20px 0;
        }
        .button {
          display: inline-block;
          background-color: #2563eb;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 4px;
          margin: 20px 0;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <a href="https://autoinvoice.app" class="logo">{{organization.name}}</a>
        </div>
        <div class="content">
          <h1>Reçu de paiement</h1>
          <p>Bonjour {{customer.name}},</p>
          
          <div class="confirmation">
            <p>Nous vous confirmons la réception de votre paiement pour la facture {{invoice.number}} d'un montant de {{invoice.total_amount}} {{invoice.currency}}.</p>
            <p>Merci pour votre paiement.</p>
          </div>
          
          <div class="receipt-details">
            <p><strong>Facture N° :</strong> {{invoice.number}}</p>
            <p><strong>Date de paiement :</strong> {{payment_date}}</p>
            <p><strong>Montant payé :</strong> {{invoice.total_amount}} {{invoice.currency}}</p>
            <p><strong>Mode de paiement :</strong> {{payment_method}}</p>
            <p><strong>Référence :</strong> {{payment_reference}}</p>
          </div>
          
          <div style="text-align: center;">
            <a href="{{pdf_url}}" class="button">Télécharger la facture</a>
          </div>
          
          <p>Nous vous remercions pour votre confiance.</p>
          
          <p>Cordialement,<br>L'équipe {{organization.name}}</p>
        </div>
        <div class="footer">
          <p>&copy; {{current_year}} {{organization.name}}. Tous droits réservés.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
