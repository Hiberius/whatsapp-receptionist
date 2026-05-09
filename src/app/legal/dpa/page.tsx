import type { Metadata } from 'next';

import { LegalPageLayout } from '@/components/marketing/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Data Processing Agreement',
  description:
    'DPA Ambrogio.ai conforme Art. 28 GDPR. Hosting EU, sub-processori dichiarati, audit log immutabile, breach notification 24h.',
  alternates: { canonical: '/legal/dpa' },
};

export default function DpaPage() {
  return (
    <LegalPageLayout title="Data Processing Agreement (DPA)" lastUpdated="8 maggio 2026">
      <p>
        Il presente accordo regola il trattamento dei dati personali ai sensi dell&apos;Art. 28 GDPR
        tra Ambrogio.ai (Responsabile del trattamento) e il Tenant (Titolare).
      </p>

      <h2>1. Oggetto del trattamento</h2>
      <p>
        Ambrogio.ai elabora i dati personali degli Utenti finali del Tenant esclusivamente per
        l&apos;erogazione del Servizio.
      </p>

      <h2>2. Categorie di dati</h2>
      <ul>
        <li>Dati di contatto: nome, telefono, email.</li>
        <li>Contenuto messaggi: testo e vocali.</li>
        <li>Dati transazionali: appuntamenti, prenotazioni, pagamenti.</li>
      </ul>

      <h2>3. Misure tecniche e organizzative</h2>
      <ul>
        <li>TLS 1.3 in transito, AES-256 a riposo.</li>
        <li>Multi-tenancy con RLS Postgres.</li>
        <li>Audit log immutabile.</li>
        <li>Backup criptati EU, retention 30 giorni.</li>
        <li>Disaster recovery RTO 4h, RPO 1h.</li>
      </ul>

      <h2>4. Sub-processori</h2>
      <p>
        Lista aggiornata in <a href="/legal/sub-processors">/legal/sub-processors</a>. Notifica
        scritta 30 giorni prima di aggiunte.
      </p>

      <h2>5. Diritti degli interessati</h2>
      <p>
        Ambrogio.ai assiste il Titolare nell&apos;adempimento delle richieste degli Interessati
        (Art. 15-22 GDPR) tramite gli endpoint di export e delete disponibili in dashboard.
      </p>

      <h2>6. Data breach</h2>
      <p>
        Notifica al Titolare entro 24 ore dalla scoperta. Notifica al Garante a cura del Titolare
        entro 72 ore.
      </p>

      <h2>7. Audit</h2>
      <p>
        Il Titolare può richiedere audit annuali con preavviso di 30 giorni. Costi a carico del
        Titolare salvo diversa accordo.
      </p>

      <h2>8. Termine</h2>
      <p>
        Alla cessazione del rapporto, restituzione o cancellazione dei dati entro 30 giorni
        (configurabile dal Tenant).
      </p>

      <p
        style={{
          padding: 'var(--space-4)',
          background: 'var(--color-accent-soft)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <strong>DPA firmabile:</strong> versione PDF disponibile dalla dashboard, sezione{' '}
        <em>Account &gt; Sicurezza &gt; DPA</em>. Contattaci per stipula formale via PEC.
      </p>
    </LegalPageLayout>
  );
}
