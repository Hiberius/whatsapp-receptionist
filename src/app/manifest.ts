import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ambrogio.ai',
    short_name: 'Ambrogio',
    description:
      'Reception AI sempre attiva per studi e PMI italiane. WhatsApp, voce, prenotazioni automatiche.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8faf8',
    theme_color: '#0d766e',
    lang: 'it-IT',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
    categories: ['business', 'productivity'],
  };
}
