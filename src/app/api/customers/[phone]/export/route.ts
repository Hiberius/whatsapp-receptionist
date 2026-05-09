// Fatto da Claude Code l'8 maggio 2026.
// GDPR Art. 15 — customer-level data export (admin del tenant esporta
// i dati di un suo cliente finale).

import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { createGdprExportService } from '@/server/gdpr/data-export';

export const runtime = 'nodejs';

// Phone in path: accetta cifre (E.164 senza '+') o '+' iniziale; il
// servizio normalizza a cifre.
const PhoneParamSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/^\+?\d[\d\s().-]+$/, 'Invalid phone format');

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ phone: string }> },
): Promise<Response> {
  return jsonHandler(async (apiContext) => {
    const session = await requireSession();
    const { phone } = await context.params;
    const validatedPhone = PhoneParamSchema.parse(decodeURIComponent(phone));
    const service = createGdprExportService();

    return service.exportCustomerData({
      session,
      customerPhone: validatedPhone,
      actor: {
        ipAddress: apiContext.ipAddress,
        userAgent: request.headers.get('user-agent'),
      },
    });
  }, request);
}
