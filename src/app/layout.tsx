import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
});

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  preload: true,
  variable: '--font-fraunces',
  axes: ['opsz', 'SOFT'],
});

const SITE_URL = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://ambrogio.ai';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Ambrogio.ai — AI Receptionist Italia per studi e PMI',
    template: '%s · Ambrogio.ai',
  },
  description:
    'WhatsApp, voce, prenotazioni automatiche. Niente più chiamate perse, niente clienti persi. Setup in 24h.',
  applicationName: 'Ambrogio.ai',
  authors: [{ name: 'Ambrogio.ai Team', url: SITE_URL }],
  creator: 'Ambrogio.ai Team',
  publisher: 'Ambrogio.ai',
  generator: 'Next.js',
  keywords: [
    'AI receptionist Italia',
    'reception virtuale',
    'WhatsApp business automatico',
    'prenotazioni automatiche',
    'AI per studi dentistici',
    'AI per estetisti',
    'AI per palestre',
    'studi professionali',
    'Italia',
    'GDPR',
  ],
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    url: SITE_URL,
    siteName: 'Ambrogio.ai',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ambrogio_ai',
    creator: '@ambrogio_ai',
  },
  alternates: {
    canonical: '/',
    languages: {
      'it-IT': SITE_URL,
      'x-default': SITE_URL,
    },
    types: {
      'application/rss+xml': `${SITE_URL}/changelog/feed.xml`,
    },
  },
  appleWebApp: {
    capable: true,
    title: 'Ambrogio.ai',
    statusBarStyle: 'default',
  },
  other: {
    'msapplication-TileColor': '#0d766e',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d766e',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}#website`,
  name: 'Ambrogio.ai',
  url: SITE_URL,
  inLanguage: 'it-IT',
  publisher: { '@id': `${SITE_URL}#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/help?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const headerList = await headers();
  const nonce = headerList.get('x-nonce') ?? undefined;

  return (
    <html lang="it" className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <link rel="preconnect" href="https://api.anthropic.com" />
        <link rel="dns-prefetch" href="https://api.stripe.com" />
        <link rel="dns-prefetch" href="https://api.elevenlabs.io" />
        <link rel="dns-prefetch" href="https://graph.facebook.com" />
        <link rel="me" href="https://twitter.com/ambrogio_ai" />
        <link rel="me" href="https://linkedin.com/company/ambrogio-ai" />
        <link rel="alternate" hrefLang="it-IT" href={SITE_URL} />
        <link rel="alternate" hrefLang="x-default" href={SITE_URL} />
        <meta name="author" content="Ambrogio.ai Team" />
        <meta name="application-name" content="Ambrogio.ai" />
        <meta name="apple-mobile-web-app-title" content="Ambrogio.ai" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0d766e" />
        <meta name="format-detection" content="telephone=no" />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body data-csp-nonce={nonce}>
        <a href="#main" className="skip-link">
          Salta al contenuto
        </a>
        {children}
      </body>
    </html>
  );
}
