import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const POST_META: Record<string, { title: string; category: string }> = {
  'come-uno-studio-dentistico-recupera-12k-anno': {
    title: 'Come uno studio dentistico recupera €12k/anno con la reception AI',
    category: 'Case study',
  },
  'whatsapp-business-vs-360dialog-quando-conviene': {
    title: 'WhatsApp Cloud API vs 360dialog: quando conviene cosa',
    category: 'Guida',
  },
  'gdpr-receptionist-ai-dpa-template': {
    title: 'GDPR e receptionist AI: il DPA che serve davvero',
    category: 'GDPR',
  },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BlogOpengraphImage({ params }: Props): Promise<ImageResponse> {
  const { slug } = await params;
  const meta = POST_META[slug];
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
        background: 'linear-gradient(135deg, oklch(97% 0.01 175) 0%, oklch(94% 0.025 175) 100%)',
        padding: '80px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '12px',
            background: 'oklch(45% 0.12 175)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '28px',
            fontWeight: 800,
          }}
        >
          A
        </div>
        <div style={{ fontSize: '28px', fontWeight: 700, color: 'oklch(20% 0.015 175)' }}>
          Ambrogio<span style={{ color: 'oklch(45% 0.12 175)' }}>.ai</span>
          <span
            style={{
              marginLeft: '16px',
              fontSize: '18px',
              color: 'oklch(48% 0.018 175)',
              fontWeight: 400,
            }}
          >
            Blog
          </span>
        </div>
        <div
          style={{
            marginLeft: '8px',
            background: 'oklch(93% 0.02 175)',
            color: 'oklch(35% 0.12 175)',
            borderRadius: '20px',
            padding: '5px 16px',
            fontSize: '16px',
            fontWeight: 600,
            border: '1px solid oklch(80% 0.04 175)',
          }}
        >
          {meta.category}
        </div>
      </div>

      <div
        style={{
          fontSize: '62px',
          fontWeight: 700,
          color: 'oklch(20% 0.015 175)',
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          maxWidth: '1000px',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {meta.title}
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
        <div style={{ display: 'flex', gap: '32px' }}>
          <div style={{ fontSize: '18px', color: 'oklch(45% 0.12 175)', fontWeight: 600 }}>
            ● Hosted EU
          </div>
          <div style={{ fontSize: '18px', color: 'oklch(45% 0.12 175)', fontWeight: 600 }}>
            ● GDPR ready
          </div>
        </div>
        <div style={{ fontSize: '18px', color: 'oklch(38% 0.018 175)', fontWeight: 500 }}>
          ambrogio.ai
        </div>
      </div>
    </div>,
    { ...size },
  );
}
