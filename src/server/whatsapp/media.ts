import { AppError } from '@/lib/errors/app-error';
import { env } from '@/lib/env';

export type DownloadWhatsAppMediaInput = {
  mediaId: string;
  expectedMimeType?: string | null;
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
    } = {},
  ) {}

  async downloadMedia(input: DownloadWhatsAppMediaInput): Promise<DownloadedWhatsAppMedia> {
    const apiKey = this.config.apiKey ?? env.WHATSAPP_API_KEY;

    if (!apiKey) {
      throw new AppError('internal', 'WhatsApp API key is not configured', {
        expose: false,
      });
    }

    const metadata = await this.fetchMediaMetadata(input.mediaId, apiKey);
    const mediaUrl = extractMediaUrl(metadata);

    if (!mediaUrl) {
      throw new AppError('upstream_error', 'WhatsApp media metadata has no URL', {
        cause: metadata,
        expose: false,
      });
    }

    const mediaResponse = await (this.config.fetcher ?? fetch)(mediaUrl, {
      headers: {
        'D360-API-KEY': apiKey,
      },
    });

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

  private async fetchMediaMetadata(mediaId: string, apiKey: string): Promise<unknown> {
    const response = await (this.config.fetcher ?? fetch)(
      new URL(`/${encodeURIComponent(mediaId)}`, this.config.apiUrl ?? env.WHATSAPP_API_URL),
      {
        headers: {
          'D360-API-KEY': apiKey,
        },
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

export function createWhatsAppMediaDownloader(): WhatsAppMediaDownloader {
  return new Dialog360WhatsAppMediaClient();
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
