import type { Metadata } from 'next';

import { LegalPageLayout } from '@/components/marketing/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy policy Ambrogio.ai conforme GDPR. Hosting EU, redact PII automatico, retention 24 mesi, diritti Art. 15-22.',
  alternates: { canonical: '/legal/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="8 maggio 2026">
      <p>
        La presente Privacy Policy descrive come Ambrogio.ai (di seguito{' '}
        <strong>&quot;Ambrogio&quot;</strong>, <strong>&quot;noi&quot;</strong>) raccoglie, utilizza
        e protegge i dati personali degli utenti dei propri servizi B2B.
      </p>

      <h2>1. Titolare del trattamento</h2>
      <p>
        Il titolare del trattamento è Ambrogio.ai, con sede in [da definire in fase di
        costituzione], P.IVA [da inserire]. Per ogni questione relativa al trattamento dei dati:{' '}
        <a href="mailto:privacy@ambrogio.ai">privacy@ambrogio.ai</a>.
      </p>

      <h2>2. Categorie di dati raccolti</h2>
      <ul>
        <li>
          <strong>Dati account business:</strong> nome studio, email, telefono, P.IVA, codice
          fiscale, codice destinatario SDI.
        </li>
        <li>
          <strong>Dati conversazione:</strong> messaggi WhatsApp scambiati con i clienti finali del
          tenant, vocali trascritti, metadati.
        </li>
        <li>
          <strong>Dati operativi:</strong> log tecnici, request id, tempo risposta, stato job.
        </li>
        <li>
          <strong>Dati di pagamento:</strong> processati direttamente da Stripe (EU). Non
          conserviamo numeri carta o CVV.
        </li>
      </ul>

      <h2>3. Finalità e basi giuridiche</h2>
      <ul>
        <li>
          <strong>Erogazione del servizio</strong> (Art. 6.1.b GDPR — esecuzione contratto).
        </li>
        <li>
          <strong>Compliance fiscale</strong> (Art. 6.1.c — obbligo legale): fatturazione
          elettronica SDI, conservazione 10 anni.
        </li>
        <li>
          <strong>Sicurezza e prevenzione abusi</strong> (Art. 6.1.f — interesse legittimo): rate
          limiting, audit log, fraud detection.
        </li>
        <li>
          <strong>Comunicazioni di servizio</strong> (Art. 6.1.b): notifiche operative non
          marketing.
        </li>
      </ul>

      <h2>4. Localizzazione dei dati</h2>
      <p>
        Tutti i dati sono ospitati in <strong>Unione Europea</strong>:
      </p>
      <ul>
        <li>Database: Supabase Frankfurt (EU)</li>
        <li>Hosting: Vercel EU region</li>
        <li>Cache &amp; rate limit: Upstash EU</li>
        <li>AI inference: Anthropic API EU region</li>
        <li>Voce: ElevenLabs EU</li>
      </ul>
      <p>Nessun trasferimento verso paesi terzi senza adeguate garanzie (SCC ove applicabile).</p>

      <h2>5. Conservazione</h2>
      <ul>
        <li>Dati account: per tutta la durata del rapporto + 12 mesi.</li>
        <li>Conversazioni: 24 mesi rolling, salvo richieste legali.</li>
        <li>Vocali audio: 90 giorni dalla trascrizione.</li>
        <li>Dati fiscali (fatture): 10 anni come da normativa italiana.</li>
        <li>Log tecnici: 12 mesi.</li>
      </ul>

      <h2>6. I tuoi diritti (Art. 15-22 GDPR)</h2>
      <p>Hai diritto di:</p>
      <ul>
        <li>
          <strong>Accedere</strong> ai tuoi dati e ottenere una copia (Art. 15) — disponibile dalla
          dashboard, sezione &quot;Esporta dati&quot;.
        </li>
        <li>
          <strong>Rettificare</strong> dati inesatti (Art. 16) — modifiche dirette dalla dashboard.
        </li>
        <li>
          <strong>Cancellare</strong> i tuoi dati (Art. 17) — disponibile come &quot;Cancella
          account&quot;, con grace period di 30 giorni.
        </li>
        <li>
          <strong>Limitare</strong> o <strong>opporsi</strong> al trattamento (Art. 18, 21).
        </li>
        <li>
          <strong>Portabilità</strong> in formato JSON strutturato (Art. 20).
        </li>
      </ul>
      <p>
        Per esercitare questi diritti su clienti finali del tuo studio (i tuoi pazienti / clienti
        WhatsApp), usa la sezione &quot;Customers&quot; della dashboard.
      </p>

      <h2>7. Sicurezza tecnica</h2>
      <ul>
        <li>Crittografia in transito (TLS 1.3) e a riposo (AES-256).</li>
        <li>Multi-tenancy con Row-Level Security su ogni tabella.</li>
        <li>PII redatti automaticamente nei log applicativi.</li>
        <li>Rate limiting per prevenzione abusi.</li>
        <li>CSP nonce-based per protezione XSS.</li>
        <li>Webhook signature verification timing-safe.</li>
        <li>Audit log immutabile per azioni sensibili.</li>
      </ul>

      <h2>8. Sub-processori</h2>
      <p>
        Lista pubblica e aggiornata in <a href="/legal/sub-processors">/legal/sub-processors</a>.
        Notifica scritta minimo 30 giorni prima di aggiungere nuovi sub-processori.
      </p>

      <h2>9. Reclami</h2>
      <p>
        Hai diritto di proporre reclamo al{' '}
        <strong>Garante per la Protezione dei Dati Personali</strong> (
        <a href="https://www.garanteprivacy.it/">www.garanteprivacy.it</a>) se ritieni che il
        trattamento violi il GDPR.
      </p>

      <h2>10. Modifiche</h2>
      <p>
        Aggiorniamo questa policy quando cambiano le tecnologie, i sub-processori o la normativa. Le
        modifiche sostanziali ti vengono notificate via email almeno 30 giorni prima.
      </p>

      <hr className="divider" />
      <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
        Per richieste GDPR specifiche scrivi a <a href="mailto:dpo@ambrogio.ai">dpo@ambrogio.ai</a>.
        Tempo di risposta: 30 giorni massimo.
      </p>
    </LegalPageLayout>
  );
}
