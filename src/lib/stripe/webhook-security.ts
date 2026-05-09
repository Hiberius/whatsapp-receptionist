// Fatto da Claude Code il 27 aprile 2026.
// Verifica della signature webhook Stripe con stripe.webhooks.constructEvent.
// Mappa errori a AppError('webhook_rejected') per non leakare dettagli al
// client. La chiave webhook viene letta da env e in produzione e' obbligatoria.

import type Stripe from 'stripe';

import { env } from '@/lib/env';
import { AppError } from '@/lib/errors/app-error';

import { getStripeClient } from './client';

export const STRIPE_SIGNATURE_HEADER = 'stripe-signature';

export function constructStripeEvent(rawBody: string, signature: string | null): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError('internal', 'Stripe webhook secret is not configured', {
      expose: false,
    });
  }

  if (!signature) {
    throw new AppError('webhook_rejected', 'Missing Stripe signature header');
  }

  try {
    return getStripeClient().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    throw new AppError('webhook_rejected', 'Invalid Stripe webhook signature', {
      cause: error,
      expose: true,
    });
  }
}
