import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { readJsonBody } from '@/lib/api/body';
import { jsonHandler } from '@/lib/api/json';
import { requireSession } from '@/lib/auth/session';
import { AppError } from '@/lib/errors/app-error';
import { applyRateLimit } from '@/lib/rate-limit/apply';
import { createWhatsAppProvisioningService } from '@/server/whatsapp/provisioning';

export const runtime = 'nodejs';

const ConnectWhatsAppSchema = z
  .object({
    phoneNumberId: z.string().trim().min(1).max(120),
    displayPhoneNumber: z.string().trim().max(40).default(''),
    apiKey: z.string().trim().min(8).max(512),
  })
  .strict();

/** Collegare o scollegare il canale è una modifica di configurazione del tenant. */
function assertCanManageIntegrations(role: string): void {
  if (role !== 'owner' && role !== 'admin') {
    throw new AppError('forbidden', 'Solo owner e admin possono gestire le integrazioni');
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    const service = createWhatsAppProvisioningService();

    return service.getStatus(session.tenantId);
  }, request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    assertCanManageIntegrations(session.role);
    await applyRateLimit('settingsWrite', { kind: 'userId', value: session.userId });

    const parsed = ConnectWhatsAppSchema.parse(await readJsonBody(request));
    const service = createWhatsAppProvisioningService();

    // `tenantId` viene dalla sessione, mai dal body: accettarlo dal client
    // permetterebbe di collegare un numero al tenant di qualcun altro.
    return service.connect({
      tenantId: session.tenantId,
      phoneNumberId: parsed.phoneNumberId,
      displayPhoneNumber: parsed.displayPhoneNumber,
      apiKey: parsed.apiKey,
    });
  }, request);
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return jsonHandler(async () => {
    const session = await requireSession();
    assertCanManageIntegrations(session.role);
    await applyRateLimit('settingsWrite', { kind: 'userId', value: session.userId });

    const service = createWhatsAppProvisioningService();

    return service.disconnect(session.tenantId);
  }, request);
}
