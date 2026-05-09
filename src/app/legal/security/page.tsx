import type { Metadata } from 'next';

import { LegalPageLayout } from '@/components/marketing/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Sicurezza e Compliance',
  description:
    'Architettura di sicurezza Ambrogio.ai: CSP nonce-based, RLS Postgres, redact PII, pen test annuale, bug bounty, GDPR Art. 15/17.',
  alternates: { canonical: '/legal/security' },
};

export default function SecurityPage() {
  return (
    <LegalPageLayout title="Sicurezza e Compliance" lastUpdated="8 maggio 2026">
      <p>
        La sicurezza non è un add-on. È parte dell&apos;architettura sin dal primo commit. Questa
        pagina riassume le misure tecniche e organizzative in produzione.
      </p>

      <h2>Architettura</h2>
      <ul>
        <li>
          <strong>Next.js 15</strong> App Router con CSP nonce-based per protezione XSS.
        </li>
        <li>
          <strong>Supabase EU</strong> Postgres con Row-Level Security su tutte le 21 tabelle.
        </li>
        <li>
          <strong>Multi-tenancy</strong> con isolamento garantito a livello DB.
        </li>
        <li>
          <strong>Edge runtime</strong> per webhook e middleware.
        </li>
      </ul>

      <h2>Crittografia</h2>
      <ul>
        <li>TLS 1.3 in transito.</li>
        <li>AES-256 a riposo (Supabase managed).</li>
        <li>Cookie httpOnly, secure (in prod), sameSite=Lax.</li>
        <li>Webhook signature verification timing-safe (Stripe, WhatsApp).</li>
      </ul>

      <h2>Headers di sicurezza</h2>
      <ul>
        <li>Content-Security-Policy con nonce per-request</li>
        <li>Strict-Transport-Security (1 anno, includeSubDomains)</li>
        <li>X-Content-Type-Options: nosniff</li>
        <li>X-Frame-Options: DENY</li>
        <li>Referrer-Policy: strict-origin-when-cross-origin</li>
        <li>Permissions-Policy: camera/mic/geo disabled</li>
        <li>Cross-Origin-Embedder-Policy: credentialless</li>
        <li>Cross-Origin-Opener-Policy: same-origin</li>
      </ul>

      <h2>Rate limiting</h2>
      <p>
        Upstash Redis con sliding window. Policy nominate per scenario: auth login, magic link,
        onboarding, settings write, GDPR export. Burst protection su tutti i webhook.
      </p>

      <h2>Logging e PII</h2>
      <ul>
        <li>Logger Pino strutturato.</li>
        <li>
          Redact automatico di: password, token, apiKey, email, phone, whatsapp_number, fiscal_code,
          vat_number, iban, customer_name, address, body messaggio.
        </li>
        <li>
          Nessun <code>console.log</code> in produzione.
        </li>
      </ul>

      <h2>GDPR</h2>
      <ul>
        <li>Endpoint Art. 15 (export) per Tenant e Customers.</li>
        <li>Endpoint Art. 17 (delete) con grace period 30 giorni.</li>
        <li>Audit log immutabile per ogni azione sensibile.</li>
        <li>DPA firmabile, sub-processors lista pubblica.</li>
      </ul>

      <h2>Incident response</h2>
      <p>
        Notifica al Titolare entro 24 ore dalla scoperta di data breach. Runbook pubblico
        disponibile per i clienti Enterprise.
      </p>

      <h2>Penetration testing</h2>
      <p>
        Pen test annuale con vendor terzo. Report disponibile sotto NDA per piani Professional e
        Agency.
      </p>

      <h2>Bug bounty</h2>
      <p>
        Programma responsible disclosure attivo. Per segnalare vulnerabilità:{' '}
        <a href="mailto:security@ambrogio.ai">security@ambrogio.ai</a>. Tempi di risposta: critical
        24h, high 3 giorni.
      </p>
    </LegalPageLayout>
  );
}
