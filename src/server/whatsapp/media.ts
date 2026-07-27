import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';
import { fetchWithTimeout } from '@/lib/http/fetch-with-timeout';
import { logger } from '@/lib/logging/logger';
import {
  whatsAppCredentialsResolver,
  type WhatsAppCredentialsResolver,
} from '@/server/whatsapp/client';

export type DownloadWhatsAppMediaInput = {
  mediaId: string;
  expectedMimeType?: string | null;
  /**
   * Tenant proprietario del media. Il media di 360dialog è leggibile solo con
   * la chiave del numero che lo ha ricevuto: senza tenant si ricade sulla
   * chiave globale, che funziona solo per i tenant non ancora migrati.
   */
  tenantId?: string;
};

export type DownloadedWhatsAppMedia = {
  mediaId: string;
  bytes: Uint8Array;
  contentType: string;
  sha256: string | null;
  rawMetadata: unknown;
};

export interface WhatsAppMediaDownloader {
  downloadMedia(input: DownloadWhatsAppMediaInput): Promise<DownloadedWhatsAppMedia>;
}

type FetchLike = typeof fetch;

export class Dialog360WhatsAppMediaClient implements WhatsAppMediaDownloader {
  constructor(
    private readonly config: {
      apiUrl?: string;
      apiKey?: string;
      maxBytes?: number;
      fetcher?: FetchLike;
      credentials?: WhatsAppCredentialsResolver;
    } = {},
  ) {}

  async downloadMedia(input: DownloadWhatsAppMediaInput): Promise<DownloadedWhatsAppMedia> {
    const apiKey = await this.resolveApiKey(input.tenantId);
    const metadata = await this.fetchMediaMetadata(input.mediaId, apiKey);
    const mediaUrl = extractMediaUrl(metadata);

    if (!mediaUrl) {
      throw new AppError('upstream_error', 'WhatsApp media metadata has no URL', {
        cause: metadata,
        expose: false,
      });
    }

    const mediaResponse = await fetchWithTimeout(
      mediaUrl,
      {
        headers: {
          'D360-API-KEY': apiKey,
        },
      },
      {
        label: 'WhatsApp media download',
        ...(this.config.fetcher !== undefined ? { fetchImpl: this.config.fetcher } : {}),
      },
    );

    if (!mediaResponse.ok) {
      throw new AppError('upstream_error', 'WhatsApp media download failed', {
        cause: {
          status: mediaResponse.status,
          body: await readJsonResponse(mediaResponse),
        },
        expose: false,
      });
    }

    const contentLength = Number(mediaResponse.headers.get('content-length'));
    const maxBytes = this.config.maxBytes ?? env.WHATSAPP_MEDIA_MAX_BYTES;

    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new AppError('bad_request', 'WhatsApp media file is too large', {
        expose: false,
      });
    }

    const bytes = new Uint8Array(await mediaResponse.arrayBuffer());

    if (bytes.byteLength > maxBytes) {
      throw new AppError('bad_request', 'WhatsApp media file is too large', {
        expose: false,
      });
    }

    return {
      mediaId: input.mediaId,
      bytes,
      contentType:
        mediaResponse.headers.get('content-type') ??
        extractMediaMimeType(metadata) ??
        input.expectedMimeType ??
        'application/octet-stream',
      sha256: extractMediaSha256(metadata),
      rawMetadata: metadata,
    };
  }

  private async resolveApiKey(tenantId: string | undefined): Promise<string> {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    if (tenantId && this.config.credentials) {
      return (await this.config.credentials.resolve(tenantId)).apiKey;
    }

    const globalApiKey = env.WHATSAPP_API_KEY.trim();

    if (!globalApiKey) {
      throw new AppError('internal', 'WhatsApp API key is not configured', {
        expose: false,
      });
    }

    logger.warn(
      { tenantId: tenantId ?? null },
      'Download media WhatsApp senza credenziali di tenant: fallback alla chiave globale',
    );

    return globalApiKey;
  }

  private async fetchMediaMetadata(mediaId: string, apiKey: string): Promise<unknown> {
    const response = await fetchWithTimeout(
      new URL(`/${encodeURIComponent(mediaId)}`, this.config.apiUrl ?? env.WHATSAPP_API_URL),
      {
        headers: {
          'D360-API-KEY': apiKey,
        },
      },
      {
        label: 'WhatsApp media metadata',
        ...(this.config.fetcher !== undefined ? { fetchImpl: this.config.fetcher } : {}),
      },
    );

    const body = await readJsonResponse(response);

    if (!response.ok) {
      throw new AppError('upstream_error', 'WhatsApp media metadata failed', {
        cause: {
          status: response.status,
          body,
        },
        expose: false,
      });
    }

    return body;
  }
}

export function createWhatsAppMediaDownloader(
  credentials: WhatsAppCredentialsResolver = whatsAppCredentialsResolver(),
): WhatsAppMediaDownloader {
  return new Dialog360WhatsAppMediaClient({ credentials });
}

export function extensionForMimeType(contentType: string): string {
  const normalized = contentType.toLowerCase().split(';')[0]?.trim();

  switch (normalized) {
    case 'audio/ogg':
    case 'audio/opus':
      return 'ogg';
    case 'audio/mpeg':
    case 'audio/mp3':
      return 'mp3';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/aac':
      return 'aac';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    default:
      return 'bin';
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractMediaUrl(metadata: unknown): string | null {
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    'url' in metadata &&
    typeof metadata.url === 'string'
  ) {
    return metadata.url;
  }

  return null;
}

function extractMediaMimeType(metadata: unknown): string | null {
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    'mime_type' in metadata &&
    typeof metadata.mime_type === 'string'
  ) {
    return metadata.mime_type;
  }

  return null;
}

function extractMediaSha256(metadata: unknown): string | null {
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    'sha256' in metadata &&
    typeof metadata.sha256 === 'string'
  ) {
    return metadata.sha256;
  }

  return null;
}
