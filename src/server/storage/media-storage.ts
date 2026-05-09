import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { extensionForMimeType } from '@/server/whatsapp/media';

export type StoreVoiceMediaInput = {
  tenantId: string;
  messageId: string;
  mediaId: string;
  bytes: Uint8Array;
  contentType: string;
};

export type StoredVoiceMedia = {
  bucket: string;
  path: string;
  uri: string;
};

export interface TenantMediaStorage {
  storeVoiceMedia(input: StoreVoiceMediaInput): Promise<StoredVoiceMedia>;
}

export class SupabaseTenantMediaStorage implements TenantMediaStorage {
  private readonly supabase = createSupabaseAdminClient();

  constructor(private readonly bucket = env.SUPABASE_MEDIA_BUCKET) {}

  async storeVoiceMedia(input: StoreVoiceMediaInput): Promise<StoredVoiceMedia> {
    const path = [
      safePathSegment(input.tenantId),
      'whatsapp',
      'voice',
      safePathSegment(input.messageId),
      `${safePathSegment(input.mediaId)}.${extensionForMimeType(input.contentType)}`,
    ].join('/');

    const { error } = await this.supabase.storage.from(this.bucket).upload(path, input.bytes, {
      contentType: input.contentType,
      upsert: true,
    });

    if (error) {
      throw new AppError('upstream_error', 'Failed to store WhatsApp voice media', {
        cause: error,
        expose: false,
      });
    }

    return {
      bucket: this.bucket,
      path,
      uri: `supabase://${this.bucket}/${path}`,
    };
  }
}

export function createTenantMediaStorage(): TenantMediaStorage {
  return new SupabaseTenantMediaStorage();
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}
