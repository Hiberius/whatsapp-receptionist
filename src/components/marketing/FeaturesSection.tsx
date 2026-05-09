import Image from 'next/image';

interface Feature {
  title: string;
  description: string;
  icon: string;
  /** Bento sizing — 'wide' = full row, 'half' = 50%, 'third' = 33% */
  size: 'wide' | 'half' | 'third';
  isHighlight?: boolean;
}

const FEATURES: ReadonlyArray<Feature> = [
  {
    title: 'WhatsApp e voce, end-to-end',
    description:
      'Riceve e gestisce messaggi testo e vocali. Trascrive, capisce, risponde in italiano naturale. ElevenLabs per voci umane.',
    icon: '/assets/site-images/ambrogio/svg/02-whatsapp-voice-transcript.svg',
    size: 'wide',
    isHighlight: true,
  },
  {
    title: 'Agenda Google Calendar',
    description:
      'Prende appuntamenti reali, controlla disponibilità, evita conflitti. Niente doppia-prenotazione mai più.',
    icon: '/assets/site-images/ambrogio/svg/03-calendar-booking-flow.svg',
    size: 'half',
  },
  {
    title: 'Escalation umana fluida',
    description:
      'Quando serve, passa la palla a te. Senza imbarazzo, senza perdere il filo della conversazione.',
    icon: '/assets/site-images/ambrogio/svg/04-human-escalation.svg',
    size: 'half',
  },
  {
    title: 'Privacy vault GDPR',
    description:
      'Server EU. RLS multi-tenant. PII redatti in log. DPA pronto. Articolo 15/17 a portata di un click.',
    icon: '/assets/site-images/ambrogio/svg/05-privacy-vault.svg',
    size: 'third',
  },
  {
    title: 'Tutti i canali, una sola coda',
    description: 'WhatsApp, Instagram DM, web chat, telefono. Una memoria sola.',
    icon: '/assets/site-images/ambrogio/svg/10-multi-channel-orbit.svg',
    size: 'third',
  },
  {
    title: 'Dashboard chiara, dati onesti',
    description: 'KPI in tempo reale. Conversazioni, booking, voce, fatturato — in una schermata.',
    icon: '/assets/site-images/ambrogio/svg/11-dashboard-command-center.svg',
    size: 'third',
  },
] as const;

const sizeClass = {
  wide: 'feature-card-wide',
  half: 'feature-card-half',
  third: 'feature-card-third',
} as const;

export function FeaturesSection() {
  return (
    <section className="section" id="features" aria-labelledby="features-heading">
      <div className="container stack stack-12">
        <div className="stack stack-4" style={{ maxWidth: '52ch' }}>
          <span className="eyebrow">Cosa fa Ambrogio</span>
          <h2 id="features-heading" className="text-balance">
            Sei capacità che funzionano insieme, non sei feature da spuntare.
          </h2>
          <p className="lead">
            Costruito da chi ha gestito reception reali per cliniche e palestre. Ogni funzionalità
            risolve un problema quotidiano misurabile.
          </p>
        </div>

        <ul className="features-bento stagger-children" style={{ listStyle: 'none', padding: 0 }}>
          {FEATURES.map((feature, index) => (
            <li
              key={feature.title}
              className={`card card-interactive feature-card ${sizeClass[feature.size]} ${
                feature.isHighlight ? 'feature-card-highlight' : ''
              }`}
              style={{ '--i': index } as React.CSSProperties}
            >
              <div className="feature-icon-tile" aria-hidden="true">
                <Image src={feature.icon} alt="" width={40} height={40} />
              </div>
              <div className="stack stack-3">
                <h3 className="feature-card-title">{feature.title}</h3>
                <p className="feature-card-body">{feature.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
