import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Impostazioni · Ambrogio.ai',
};

const SETTINGS_GROUPS = [
  {
    title: 'Studio',
    description: 'Nome, settore, lingua, fuso orario.',
    links: [
      { href: '/settings/profile', label: 'Profilo studio' },
      { href: '/settings/business-hours', label: 'Orari di apertura' },
      { href: '/settings/services', label: 'Servizi e listino' },
      { href: '/settings/team', label: 'Team e operatori' },
    ],
  },
  {
    title: 'Integrazioni',
    description: 'Connetti i canali di comunicazione e gli strumenti che già usi.',
    links: [
      { href: '/settings/whatsapp', label: 'WhatsApp Business' },
      { href: '/settings/calendar', label: 'Google Calendar' },
      { href: '/settings/voice', label: 'Voce ElevenLabs' },
      { href: '/settings/webhooks', label: 'Webhook custom' },
    ],
  },
  {
    title: 'AI',
    description: 'Personalità, prompt, knowledge base.',
    links: [
      { href: '/settings/personality', label: 'Tono e personalità' },
      { href: '/settings/knowledge', label: 'Knowledge base' },
      { href: '/settings/escalation', label: 'Regole di escalation' },
    ],
  },
  {
    title: 'Account & sicurezza',
    description: 'Piano, fatturazione, privacy, GDPR.',
    links: [
      { href: '/billing', label: 'Piano e fatturazione' },
      { href: '/settings/security', label: 'Sicurezza' },
      { href: '/settings/data-export', label: 'Esporta i tuoi dati (GDPR Art. 15)' },
      { href: '/settings/danger-zone', label: 'Cancella account' },
    ],
  },
] as const;

export default function SettingsPage() {
  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">Impostazioni</span>
          <h1>Configura il tuo studio</h1>
          <p className="muted">
            Tutto quello che riguarda Ambrogio: come parla, come prenota, come ti notifica.
          </p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        {SETTINGS_GROUPS.map((group) => (
          <section key={group.title} className="card stack stack-4">
            <div className="stack stack-2">
              <h2 style={{ fontSize: 'var(--text-xl)' }}>{group.title}</h2>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                {group.description}
              </p>
            </div>
            <ul style={{ listStyle: 'none', padding: 0 }} className="stack stack-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="row-between"
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-surface-sunken)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500,
                      transition: 'background var(--duration-normal) var(--ease-out)',
                    }}
                  >
                    <span>{link.label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
