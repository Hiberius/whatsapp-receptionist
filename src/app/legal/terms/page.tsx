import type { Metadata } from 'next';

import { LegalPageLayout } from '@/components/marketing/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Termini di Servizio',
  description:
    'Termini di servizio Ambrogio.ai: licenza, obblighi, SLA, recesso, fatturazione e foro competente. Aggiornato 8 maggio 2026.',
  alternates: { canonical: '/legal/terms' },
};

export default function TermsPage() {
  return (
    <LegalPageLayout title="Termini di Servizio" lastUpdated="8 maggio 2026">
      <p>
        Questi termini regolano l&apos;uso del servizio Ambrogio.ai. Iscrivendoti dichiari di
        accettarli integralmente.
      </p>

      <h2>1. Definizioni</h2>
      <ul>
        <li>
          <strong>Servizio:</strong> piattaforma SaaS Ambrogio.ai per la gestione automatizzata di
          reception via WhatsApp e voce.
        </li>
        <li>
          <strong>Tenant:</strong> azienda cliente che usa il Servizio.
        </li>
        <li>
          <strong>Utente finale:</strong> cliente del Tenant che interagisce via WhatsApp.
        </li>
      </ul>

      <h2>2. Oggetto</h2>
      <p>
        Ambrogio.ai concede al Tenant una licenza non esclusiva, non trasferibile, revocabile per
        accedere alle funzionalità descritte nel piano sottoscritto.
      </p>

      <h2>3. Obblighi del Tenant</h2>
      <ul>
        <li>Fornire dati veritieri durante l&apos;onboarding.</li>
        <li>Disporre di tutti i consensi richiesti dai propri Utenti finali.</li>
        <li>Non utilizzare il Servizio per scopi illeciti, spam, abusi.</li>
        <li>Rispettare le policy di Meta WhatsApp Business.</li>
      </ul>

      <h2>4. Limitazione di responsabilità</h2>
      <p>
        Ambrogio.ai fornisce il servizio &quot;as is&quot;. La nostra responsabilità massima è
        limitata all&apos;importo pagato dal Tenant nei 12 mesi precedenti l&apos;evento.
      </p>

      <h2>5. SLA</h2>
      <p>
        Uptime target: 99.5% mensile su misurazione esterna. Compensazioni come da{' '}
        <a href="/legal/sla">SLA pubblico</a>.
      </p>

      <h2>6. Pagamenti e fatturazione</h2>
      <ul>
        <li>Pagamento mensile o annuale via Stripe.</li>
        <li>Fatturazione elettronica SDI inclusa.</li>
        <li>Mancato pagamento → sospensione servizio dopo 14 giorni di solleciti.</li>
      </ul>

      <h2>7. Recesso</h2>
      <p>
        Puoi disdire in qualsiasi momento dalla dashboard. Nessun rimborso pro-rata salvo difetti
        gravi e dimostrati del Servizio.
      </p>

      <h2>8. Foro competente</h2>
      <p>Foro esclusivo di Roma, Italia. Legge applicabile: italiana.</p>
    </LegalPageLayout>
  );
}
