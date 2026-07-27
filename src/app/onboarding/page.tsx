import type { Metadata } from 'next';
import Link from 'next/link';

import { buildHowToEnrichedSchema, JsonLd } from '@/components/marketing/JsonLd';
import { OnboardingForm } from '@/components/onboarding/OnboardingForm';

export const metadata: Metadata = {
  title: 'Onboarding · Ambrogio.ai',
  robots: { index: false, follow: false },
};

const ONBOARDING_HOWTO_SCHEMA = buildHowToEnrichedSchema({
  name: 'Come configurare Ambrogio.ai per il tuo studio',
  description:
    'Quattro step guidati per attivare il tuo AI Receptionist: profilo studio, orari e servizi, canali (WhatsApp + Calendar), test conversazione.',
  url: '/onboarding',
  totalTime: 'PT24H',
  tool: ['Account Meta Business Manager', 'Google Calendar', 'Numero WhatsApp Business'],
  supply: [
    'Listino servizi',
    'Orari di apertura',
    'Dati fatturazione (P.IVA, Codice Destinatario SDI)',
  ],
  steps: [
    {
      name: 'Profilo studio',
      text: 'Inserisci nome studio, settore (dental, beauty, fitness, professional), fuso orario e lingua. Tempo: 30 secondi.',
    },
    {
      name: 'Orari e servizi',
      text: 'Configura gli orari di apertura per ogni giorno della settimana e carica il listino servizi (manuale o tramite import CSV).',
    },
    {
      name: 'Connetti canali',
      text: 'Autorizza il numero WhatsApp Business tramite Meta Business Manager e collega Google Calendar per i booking automatici.',
    },
    {
      name: 'Test conversazione',
      text: 'Invia un messaggio di prova al tuo numero WhatsApp e verifica che Ambrogio risponda correttamente. Setup completo in 24h.',
    },
  ],
});

const STEPS = [
  { n: 1, label: 'Profilo studio', current: true, done: false },
  { n: 2, label: 'Orari e servizi', current: false, done: false },
  { n: 3, label: 'Connetti canali', current: false, done: false },
  { n: 4, label: 'Test conversazione', current: false, done: false },
] as const;

const VERTICALS = [
  { value: 'dental', label: 'Studio dentistico' },
  { value: 'beauty', label: 'Centro estetico / SPA' },
  { value: 'fitness', label: 'Palestra / personal trainer' },
  { value: 'professional', label: 'Studio professionale' },
  { value: 'other', label: 'Altro' },
] as const;

const VALID_VERTICALS: readonly string[] = VERTICALS.map((v) => v.value);

const TIMEZONES = [
  { value: 'Europe/Rome', label: 'Europe/Rome (Italia)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
] as const;

interface OnboardingSearchParams {
  business_name?: string;
  vertical?: string;
}

interface OnboardingPageProps {
  searchParams: Promise<OnboardingSearchParams>;
}

const CURRENT_STEP = 1;
const TOTAL_STEPS = STEPS.length;

export default async function OnboardingPage({ searchParams }: Readonly<OnboardingPageProps>) {
  const params = await searchParams;
  // Pre-popoliamo da register form per evitare redundant entry (WCAG 2.2 SC 3.3.7).
  const prefilledBusinessName =
    typeof params.business_name === 'string' ? params.business_name : '';
  const prefilledVertical =
    typeof params.vertical === 'string' && VALID_VERTICALS.includes(params.vertical)
      ? params.vertical
      : '';
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <JsonLd data={ONBOARDING_HOWTO_SCHEMA} />
      <header
        style={{
          padding: 'var(--space-4) clamp(1.25rem, 4vw, 2.5rem)',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <div className="container row-between">
          <Link href="/" className="site-logo">
            Ambrogio<span style={{ color: 'var(--color-accent)' }}>.ai</span>
          </Link>
          <Link href="/help" className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Hai bisogno di aiuto? Contattaci →
          </Link>
        </div>
      </header>

      <main
        id="main"
        className="container"
        style={{ paddingBlock: 'var(--space-12)', maxWidth: '720px' }}
      >
        {/* Progress indicator: ol con role="progressbar" per screen reader,
            aria-current="step" sull'<li> corrente, span sr-only "corrente". */}
        <ol
          aria-label={`Onboarding step ${CURRENT_STEP} di ${TOTAL_STEPS}`}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={CURRENT_STEP}
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-12)',
            position: 'relative',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '14px',
              left: '14px',
              right: '14px',
              height: '2px',
              background: 'var(--color-border)',
              zIndex: 0,
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '14px',
              left: '14px',
              width: '0%',
              height: '2px',
              background: 'var(--color-accent)',
              zIndex: 1,
              transition: 'width var(--duration-slow) var(--ease-out)',
            }}
          />
          {STEPS.map((step) => (
            <li
              key={step.n}
              aria-current={step.current ? 'step' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-2)',
                position: 'relative',
                zIndex: 2,
              }}
            >
              <span
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: step.current
                    ? 'var(--color-accent)'
                    : step.done
                      ? 'var(--color-success)'
                      : 'var(--color-surface)',
                  color:
                    step.current || step.done
                      ? 'var(--color-accent-fg)'
                      : 'var(--color-text-muted)',
                  border: '2px solid',
                  borderColor: step.current
                    ? 'var(--color-accent)'
                    : step.done
                      ? 'var(--color-success)'
                      : 'var(--color-border-strong)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                {step.done ? '✓' : step.n}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: step.current ? 600 : 500,
                  color: step.current ? 'var(--color-text)' : 'var(--color-text-muted)',
                  textAlign: 'center',
                  maxWidth: '110px',
                }}
              >
                {step.label}
              </span>
              {step.current ? <span className="sr-only">Step corrente.</span> : null}
            </li>
          ))}
        </ol>

        <div className="card card-padded stack stack-6">
          <div className="stack stack-2">
            <span className="eyebrow">Step 1 di 4</span>
            <h1 style={{ fontSize: 'var(--text-3xl)' }}>Parlaci del tuo studio</h1>
            <p className="muted">
              Le info di base per personalizzare Ambrogio. Puoi cambiarle in qualsiasi momento.
            </p>
          </div>

          <OnboardingForm
            verticals={VERTICALS}
            timezones={TIMEZONES}
            prefilledBusinessName={prefilledBusinessName}
            prefilledVertical={prefilledVertical}
          />
        </div>

        <p
          className="muted text-center"
          style={{ marginTop: 'var(--space-6)', fontSize: 'var(--text-sm)' }}
        >
          I tuoi dati sono criptati e ospitati in EU. Vedi{' '}
          <Link href="/legal/privacy" className="btn-link">
            privacy policy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
