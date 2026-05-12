import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt =
  'WhatsApp Receptionist — open-source AI receptionist that books real appointments';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Dynamic Open Graph image. Renders with satori — only flex layouts and hex
 * colors. No oklch(), no emoji glyphs, no SVG dynamic fonts: all rendered as
 * plain text and CSS-painted shapes.
 */
export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #ebf3f2 0%, #e0eceb 60%, #cce0de 100%)',
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
            background: '#1f6862',
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
            display: 'flex',
            fontSize: '36px',
            fontWeight: 700,
            color: '#0d2926',
            letterSpacing: '-0.02em',
          }}
        >
          WhatsApp Receptionist
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
            display: 'flex',
            fontSize: '76px',
            fontWeight: 700,
            color: '#0d2926',
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            maxWidth: '1040px',
          }}
        >
          AI that books real appointments on WhatsApp.
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '28px',
            color: '#3d524f',
            maxWidth: '950px',
            lineHeight: 1.4,
          }}
        >
          Open source. Multi-tenant. GDPR-ready. Crafted in Italy.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '32px',
          borderTop: '1px solid #b8c8c5',
        }}
      >
        <div style={{ display: 'flex', gap: '32px' }}>
          <div style={{ display: 'flex', fontSize: '20px', color: '#1f6862', fontWeight: 600 }}>
            Hosted EU
          </div>
          <div style={{ display: 'flex', fontSize: '20px', color: '#1f6862', fontWeight: 600 }}>
            MIT licensed
          </div>
          <div style={{ display: 'flex', fontSize: '20px', color: '#1f6862', fontWeight: 600 }}>
            369 tests
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: '20px',
            color: '#3d524f',
            fontWeight: 500,
          }}
        >
          github.com/Hiberius
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
