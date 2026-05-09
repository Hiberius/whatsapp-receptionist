/**
 * Email templates for transactional emails.
 *
 * Each template returns { subject, text, html } and accepts strongly-typed params.
 * Stylesheet inlined for max client compatibility.
 *
 * Mailer is wired separately (Resend integration TODO). These templates are
 * the rendering layer only.
 */

const BRAND_TEAL = '#0d766e';
const BRAND_BG = '#f8faf8';
const BRAND_TEXT = '#16211c';
const BRAND_MUTED = '#5e6b64';

interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

function wrapHtml(title: string, body: string, ctaUrl?: string, ctaLabel?: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:Inter,system-ui,-apple-system,sans-serif;color:${BRAND_TEXT};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};padding:40px 16px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe7e2;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:32px 40px 16px;">
        <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;">
          Ambrogio<span style="color:${BRAND_TEAL};">.ai</span>
        </div>
      </td></tr>
      <tr><td style="padding:0 40px 32px;font-size:15px;line-height:1.6;">
        ${body}
        ${ctaUrl && ctaLabel ? `<p style="margin:32px 0 0;"><a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background:${BRAND_TEAL};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${ctaLabel}</a></p>` : ''}
      </td></tr>
      <tr><td style="padding:24px 40px;border-top:1px solid #dfe7e2;color:${BRAND_MUTED};font-size:12px;">
        Ambrogio.ai — Reception AI per PMI italiane · Hosted EU · GDPR ready<br/>
        Per qualsiasi richiesta: <a href="mailto:hello@ambrogio.ai" style="color:${BRAND_TEAL};">hello@ambrogio.ai</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

export interface MagicLinkParams {
  email: string;
  link: string;
  expiresInMinutes: number;
}

export function magicLinkEmail(params: MagicLinkParams): EmailContent {
  return {
    subject: 'Il tuo link di accesso ad Ambrogio.ai',
    text: `Ciao,

ecco il tuo link di accesso ad Ambrogio.ai. Scade tra ${params.expiresInMinutes} minuti.

${params.link}

Se non hai richiesto tu questo link, ignora questa email — nessuno può accedere senza riceverla.

Ambrogio.ai`,
    html: wrapHtml(
      'Il tuo link di accesso',
      `<p>Ciao,</p>
       <p>ecco il tuo link di accesso ad Ambrogio.ai. Scade tra <strong>${params.expiresInMinutes} minuti</strong>.</p>
       <p style="color:${BRAND_MUTED};font-size:13px;">Se non hai richiesto tu questo link, ignora questa email — nessuno può accedere senza riceverla.</p>`,
      params.link,
      'Accedi ad Ambrogio.ai',
    ),
  };
}

export interface WelcomeParams {
  email: string;
  businessName: string;
  onboardingUrl: string;
}

export function welcomeEmail(params: WelcomeParams): EmailContent {
  return {
    subject: `Benvenuto in Ambrogio.ai, ${params.businessName}!`,
    text: `Ciao,

benvenuto in Ambrogio.ai! Stiamo preparando la tua reception AI per ${params.businessName}.

Continua il setup qui: ${params.onboardingUrl}

In 24 ore Ambrogio sarà operativo. Se hai bisogno scrivi a hello@ambrogio.ai.

Ambrogio.ai`,
    html: wrapHtml(
      'Benvenuto in Ambrogio.ai',
      `<p>Ciao,</p>
       <p>benvenuto! Stiamo preparando la tua reception AI per <strong>${params.businessName}</strong>.</p>
       <p>In 24 ore Ambrogio sarà operativo. Bastano pochi minuti di setup per iniziare:</p>
       <ul style="padding-left:20px;line-height:1.8;">
         <li>Collega il numero WhatsApp Business</li>
         <li>Autorizza Google Calendar</li>
         <li>Carica il listino servizi</li>
       </ul>`,
      params.onboardingUrl,
      'Continua il setup',
    ),
  };
}

export interface BookingConfirmationParams {
  customerName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  studioName: string;
  studioAddress: string;
}

export function bookingConfirmationEmail(params: BookingConfirmationParams): EmailContent {
  return {
    subject: `Appuntamento confermato — ${params.appointmentDate} ore ${params.appointmentTime}`,
    text: `Ciao ${params.customerName},

il tuo appuntamento è confermato.

Servizio: ${params.serviceName}
Data: ${params.appointmentDate}
Orario: ${params.appointmentTime}

Studio: ${params.studioName}
${params.studioAddress}

Ti aspettiamo!

Ambrogio.ai per ${params.studioName}`,
    html: wrapHtml(
      'Appuntamento confermato',
      `<p>Ciao ${params.customerName},</p>
       <p>il tuo appuntamento è <strong>confermato</strong>.</p>
       <table cellpadding="8" cellspacing="0" style="margin:16px 0;border-collapse:collapse;font-size:14px;">
         <tr><td style="color:${BRAND_MUTED};">Servizio:</td><td><strong>${params.serviceName}</strong></td></tr>
         <tr><td style="color:${BRAND_MUTED};">Data:</td><td><strong>${params.appointmentDate}</strong></td></tr>
         <tr><td style="color:${BRAND_MUTED};">Orario:</td><td><strong>${params.appointmentTime}</strong></td></tr>
         <tr><td style="color:${BRAND_MUTED};">Studio:</td><td>${params.studioName}<br/><span style="color:${BRAND_MUTED};font-size:13px;">${params.studioAddress}</span></td></tr>
       </table>
       <p>Ti aspettiamo!</p>`,
    ),
  };
}

export interface InvoiceReadyParams {
  invoiceNumber: string;
  amount: string;
  pdfUrl: string;
  customerName: string;
  period: string;
}

export function invoiceReadyEmail(params: InvoiceReadyParams): EmailContent {
  return {
    subject: `Fattura ${params.invoiceNumber} — Ambrogio.ai`,
    text: `Ciao ${params.customerName},

la tua fattura per il periodo ${params.period} è disponibile.

Numero: ${params.invoiceNumber}
Importo: ${params.amount}

Scarica PDF: ${params.pdfUrl}

La fattura elettronica è stata trasmessa al Sistema di Interscambio.

Ambrogio.ai`,
    html: wrapHtml(
      'Fattura disponibile',
      `<p>Ciao ${params.customerName},</p>
       <p>la tua fattura per il periodo <strong>${params.period}</strong> è disponibile.</p>
       <table cellpadding="8" cellspacing="0" style="margin:16px 0;font-size:14px;">
         <tr><td style="color:${BRAND_MUTED};">Numero:</td><td><strong>${params.invoiceNumber}</strong></td></tr>
         <tr><td style="color:${BRAND_MUTED};">Importo:</td><td><strong>${params.amount}</strong></td></tr>
       </table>
       <p style="color:${BRAND_MUTED};font-size:13px;">La fattura elettronica è stata trasmessa al Sistema di Interscambio (SDI) come da normativa italiana.</p>`,
      params.pdfUrl,
      'Scarica PDF fattura',
    ),
  };
}

export interface GdprExportReadyParams {
  customerEmail: string;
  downloadUrl: string;
  expiresInHours: number;
}

export function gdprExportReadyEmail(params: GdprExportReadyParams): EmailContent {
  return {
    subject: 'Il tuo export dati GDPR è pronto',
    text: `Ciao,

l'export dei tuoi dati personali è pronto.

Scarica qui: ${params.downloadUrl}

Il link scade tra ${params.expiresInHours} ore. Dopo dovrai richiedere un nuovo export.

Ambrogio.ai · Privacy: privacy@ambrogio.ai`,
    html: wrapHtml(
      'Export dati GDPR pronto',
      `<p>Ciao,</p>
       <p>l'export dei tuoi dati personali (Art. 15 GDPR) è pronto.</p>
       <p style="color:${BRAND_MUTED};font-size:13px;">Il link scade tra <strong>${params.expiresInHours} ore</strong> per motivi di sicurezza.</p>`,
      params.downloadUrl,
      'Scarica export',
    ),
  };
}
