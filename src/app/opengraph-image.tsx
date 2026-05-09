import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Ambrogio.ai — Reception AI sempre attiva';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage(): ImageResponse {
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '40px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'oklch(45% 0.12 175)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '36px',
            fontWeight: 800,
          }}
        >
          A
        </div>
        <div
          style={{
            fontSize: '36px',
            fontWeight: 700,
            color: 'oklch(20% 0.015 175)',
            letterSpacing: '-0.02em',
          }}
        >
          Ambrogio<span style={{ color: 'oklch(45% 0.12 175)' }}>.ai</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: '76px',
            fontWeight: 700,
            color: 'oklch(20% 0.015 175)',
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            maxWidth: '900px',
          }}
        >
          La reception AI
          <br />
          che non dorme mai.
        </div>
        <div
          style={{
            fontSize: '28px',
            color: 'oklch(38% 0.018 175)',
            maxWidth: '850px',
            lineHeight: 1.4,
          }}
        >
          WhatsApp, voce, prenotazioni automatiche per studi e PMI italiane.
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
        <div style={{ display: 'flex', gap: '32px' }}>
          <div style={{ fontSize: '20px', color: 'oklch(45% 0.12 175)', fontWeight: 600 }}>
            ● Hosted EU
          </div>
          <div style={{ fontSize: '20px', color: 'oklch(45% 0.12 175)', fontWeight: 600 }}>
            ● GDPR ready
          </div>
          <div style={{ fontSize: '20px', color: 'oklch(45% 0.12 175)', fontWeight: 600 }}>
            ● Beta Italia 2026
          </div>
        </div>
        <div
          style={{
            fontSize: '20px',
            color: 'oklch(38% 0.018 175)',
            fontWeight: 500,
          }}
        >
          ambrogio.ai
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
