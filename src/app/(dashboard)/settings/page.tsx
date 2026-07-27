import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Impostazioni · Ambrogio.ai',
};

interface SettingsLink {
  readonly href: string;
  readonly label: string;
  /**
   * `false` finché la pagina non esiste davvero nel router.
   *
   * L'elenco è nato come mappa del prodotto finito: quattordici voci su
   * quindici puntavano a rotte mai create, quindi a un 404. Una voce marcata
   * "In arrivo" dice la stessa cosa senza far sbattere l'utente contro un
   * errore. Quando la pagina viene creata, si alza questo flag.
   */
  readonly available: boolean;
}

interface SettingsGroup {
  readonly title: string;
  readonly description: string;
  readonly links: readonly SettingsLink[];
}

const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    title: 'Studio',
    description: 'Nome, settore, lingua, fuso orario.',
    links: [
      { href: '/settings/profile', label: 'Profilo studio', available: false },
      { href: '/settings/business-hours', label: 'Orari di apertura', available: false },
      { href: '/settings/services', label: 'Servizi e listino', available: false },
      { href: '/settings/team', label: 'Team e operatori', available: false },
    ],
  },
  {
    title: 'Integrazioni',
    description: 'Connetti i canali di comunicazione e gli strumenti che già usi.',
    links: [
      { href: '/settings/whatsapp', label: 'WhatsApp Business', available: true },
      { href: '/settings/calendar', label: 'Google Calendar', available: false },
      { href: '/settings/voice', label: 'Voce ElevenLabs', available: false },
      { href: '/settings/webhooks', label: 'Webhook custom', available: false },
    ],
  },
  {
    title: 'AI',
    description: 'Personalità, prompt, knowledge base.',
    links: [
      { href: '/settings/personality', label: 'Tono e personalità', available: false },
      { href: '/settings/knowledge', label: 'Knowledge base', available: false },
      { href: '/settings/escalation', label: 'Regole di escalation', available: false },
    ],
  },
  {
    title: 'Account e sicurezza',
    description: 'Piano, fatturazione, privacy, GDPR.',
    links: [
      { href: '/billing', label: 'Piano e fatturazione', available: true },
      { href: '/settings/security', label: 'Sicurezza', available: false },
      {
        href: '/settings/data-export',
        label: 'Esporta i tuoi dati (GDPR Art. 15)',
        available: false,
      },
      { href: '/settings/danger-zone', label: 'Cancella account', available: false },
    ],
  },
];

const ROW_STYLE = {
  padding: 'var(--space-3) var(--space-4)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface-sunken)',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
} as const;

export default function SettingsPage() {
  return (
    <>
      <div className="dashboard-header">
        <div className="stack stack-2">
          <span className="eyebrow">Impostazioni</span>
          <h1>Configura il tuo studio</h1>
          <p className="muted">
            Tutto quello che riguarda Ambrogio: come parla, come prenota, come ti notifica. Le voci
            marcate «In arrivo» non sono ancora attive.
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
                  {link.available ? (
                    <Link
                      href={link.href}
                      className="row-between"
                      style={{
                        ...ROW_STYLE,
                        transition: 'background var(--duration-normal) var(--ease-out)',
                      }}
                    >
                      <span>{link.label}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ) : (
                    <div className="row-between" style={{ ...ROW_STYLE, opacity: 0.65 }}>
                      <span className="muted">{link.label}</span>
                      <span className="badge badge-neutral">In arrivo</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
