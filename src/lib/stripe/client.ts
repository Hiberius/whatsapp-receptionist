// Fatto da Claude Code il 27 aprile 2026.
// Wrapper SDK Stripe centralizzato. La apiVersion e' allineata ai tipi
// distribuiti dal pacchetto stripe-node installato (vedi
// node_modules/stripe/types/apiVersion.d.ts) per evitare disallineamento dei
// tipi TypeScript con la versione effettivamente usata a runtime.

import Stripe from 'stripe';

import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';

export const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2026-02-25.clover';

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cachedClient) {
    return cachedClient;
  }

  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError('internal', 'Stripe secret key is not configured', {
      expose: false,
    });
  }

  cachedClient = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
    appInfo: {
      name: 'Ambrogio.ai',
      version: '1.0.0',
    },
  });

  return cachedClient;
}

export function resetStripeClientForTests(): void {
  cachedClient = null;
}
