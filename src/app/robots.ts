import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ambrogio.ai';

const PUBLIC_ALLOW = [
  '/',
  '/pricing',
  '/verticali',
  '/about',
  '/case-studies',
  '/legal',
  '/help',
  '/blog',
  '/docs',
  '/changelog',
  '/contact',
  '/status',
];

const PRIVATE_DISALLOW = [
  '/api/',
  '/dashboard',
  '/conversations',
  '/calendar',
  '/settings',
  '/billing',
  '/onboarding',
  '/admin',
  '/login',
  '/register',
  '/dev/',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: 'Googlebot',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: 'Bingbot',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        userAgent: 'DuckDuckBot',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_DISALLOW,
      },
      {
        // Block AI training crawlers that don't respect noindex
        userAgent: ['GPTBot', 'Google-Extended', 'CCBot', 'anthropic-ai', 'Omgilibot', 'ClaudeBot'],
        disallow: ['/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
