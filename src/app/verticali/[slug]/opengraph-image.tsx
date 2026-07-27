import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const VERTICAL_META: Record<string, { label: string; metric: string; color: string }> = {
  dental: {
    label: 'Studi dentistici',
    metric: 'Risponde 24/7',
    color: 'oklch(45% 0.12 175)',
  },
  beauty: { label: 'Centri estetici', metric: 'Promemoria automatici', color: 'oklch(55% 0.1 80)' },
  fitness: { label: 'Palestre e PT', metric: 'Disponibilità live', color: 'oklch(45% 0.13 145)' },
  professional: {
    label: 'Studi professionali',
    metric: 'Lead pre-qualificati',
    color: 'oklch(40% 0.1 260)',
  },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function VerticalOpengraphImage({ params }: Props): Promise<ImageResponse> {
  const { slug } = await params;
  const meta = VERTICAL_META[slug];
  if (!meta) {
    notFound();
  }

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background:
          'linear-gradient(135deg, oklch(95% 0.02 175) 0%, oklch(94% 0.025 175) 60%, oklch(90% 0.04 175) 100%)',
        padding: '80px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'oklch(45% 0.12 175)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '32px',
            fontWeight: 800,
          }}
        >
          A
        </div>
        <div style={{ fontSize: '32px', fontWeight: 700, color: 'oklch(20% 0.015 175)' }}>
          Ambrogio<span style={{ color: 'oklch(45% 0.12 175)' }}>.ai</span>
        </div>
        <div
          style={{
            marginLeft: '16px',
            background: meta.color,
            color: 'white',
            borderRadius: '20px',
            padding: '6px 18px',
            fontSize: '18px',
            fontWeight: 600,
          }}
        >
          {meta.label}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: '72px',
            fontWeight: 700,
            color: 'oklch(20% 0.015 175)',
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            maxWidth: '900px',
          }}
        >
          AI Receptionist
          <br />
          <span style={{ color: meta.color }}>{meta.label}</span>
        </div>
        <div
          style={{
            fontSize: '28px',
            color: 'oklch(38% 0.018 175)',
            maxWidth: '850px',
            lineHeight: 1.4,
          }}
        >
          WhatsApp, voce, prenotazioni automatiche. Setup in 24h.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '32px',
          borderTop: '1px solid oklch(80% 0.015 150)',
        }}
      >
        <div style={{ display: 'flex', gap: '40px' }}>
          <div style={{ fontSize: '22px', color: meta.color, fontWeight: 700 }}>{meta.metric}</div>
          <div style={{ fontSize: '20px', color: 'oklch(45% 0.12 175)', fontWeight: 600 }}>
            GDPR ready
          </div>
          <div style={{ fontSize: '20px', color: 'oklch(45% 0.12 175)', fontWeight: 600 }}>
            Hosted EU
          </div>
        </div>
        <div style={{ fontSize: '20px', color: 'oklch(38% 0.018 175)', fontWeight: 500 }}>
          ambrogio.ai
        </div>
      </div>
    </div>,
    { ...size },
  );
}
