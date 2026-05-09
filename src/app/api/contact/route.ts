// Fatto da Claude Code l'8 maggio 2026.
// Contact form pubblico: niente sessione, rate-limit per IP.

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import { createContactSubmissionService } from '@/server/contact/contact-submission';

export const runtime = 'nodejs';

const ContactBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254),
    company: z.string().trim().max(160).nullable().optional(),
    topic: z.enum(['sales', 'support', 'agency', 'press', 'other']),
    message: z.string().trim().min(1).max(5000),
    consent: z.literal(true),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  return jsonHandler(async (context) => {
    // Rate limit anti-spam: 5 / minuto / IP. Applicato per primo per
    // evitare di toccare il DB quando un attaccante floodda.
    await applyRateLimit('contactForm', { kind: 'ip', value: context.ipAddress });

    const parsed = ContactBodySchema.parse(await readJsonBody(request));

    const service = createContactSubmissionService();
    const result = await service.submit({
      name: parsed.name,
      email: parsed.email,
      company: parsed.company ?? null,
      topic: parsed.topic,
      message: parsed.message,
      ipAddress: context.ipAddress,
      userAgent: request.headers.get('user-agent'),
    });

    return {
      submissionId: result.submissionId,
    };
  }, request);
}
