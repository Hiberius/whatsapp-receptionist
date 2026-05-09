import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@/lib/errors/app-error';

// Mock il client admin Supabase: il SupabaseTenantMediaStorage lo costruisce in
// modo eager, quindi forniamo un fake con la sola superficie storage.from().upload().
const uploadMock = vi.fn();
const fromMock = vi.fn(() => ({ upload: uploadMock }));
const adminClientMock = {
  storage: {
    from: fromMock,
  },
};

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(() => adminClientMock),
}));

// Importazione differita: deve avvenire DOPO vi.mock per essere intercettata.
const { SupabaseTenantMediaStorage, createTenantMediaStorage } =
  await import('@/server/storage/media-storage');

describe('SupabaseTenantMediaStorage.storeVoiceMedia', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    fromMock.mockClear();
  });

  it('uploads bytes to a deterministic path and returns bucket + supabase URI', async () => {
    // Arrange
    uploadMock.mockResolvedValueOnce({ error: null });
    const storage = new SupabaseTenantMediaStorage('test-bucket');
    const bytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53]); // 'OggS' magic header

    // Act
    const result = await storage.storeVoiceMedia({
      tenantId: 'tenant_1',
      messageId: 'message_42',
      mediaId: 'media_abc',
      bytes,
      contentType: 'audio/ogg',
    });

    // Assert — il bucket e l'URI rispecchiano l'estensione derivata dal mime type
    expect(result).toEqual({
      bucket: 'test-bucket',
      path: 'tenant_1/whatsapp/voice/message_42/media_abc.ogg',
      uri: 'supabase://test-bucket/tenant_1/whatsapp/voice/message_42/media_abc.ogg',
    });
    expect(fromMock).toHaveBeenCalledWith('test-bucket');
    expect(uploadMock).toHaveBeenCalledWith(
      'tenant_1/whatsapp/voice/message_42/media_abc.ogg',
      bytes,
      { contentType: 'audio/ogg', upsert: true },
    );
  });

  it('sanitizes path segments with non-alphanumeric chars to prevent traversal', async () => {
    // Arrange — input contiene slash/dot-dot e caratteri illegali
    uploadMock.mockResolvedValueOnce({ error: null });
    const storage = new SupabaseTenantMediaStorage('safe-bucket');

    // Act
    const result = await storage.storeVoiceMedia({
      tenantId: '../tenant/x',
      messageId: 'msg/with/slash',
      mediaId: 'media id 9',
      bytes: new Uint8Array([1, 2, 3]),
      contentType: 'audio/mpeg',
    });

    // Assert — tutti i caratteri non sicuri diventano `_`
    expect(result.path).toBe('.._tenant_x/whatsapp/voice/msg_with_slash/media_id_9.mp3');
    expect(result.uri).toBe(
      'supabase://safe-bucket/.._tenant_x/whatsapp/voice/msg_with_slash/media_id_9.mp3',
    );
  });

  it('selects the correct file extension based on the content type', async () => {
    // Arrange
    uploadMock.mockResolvedValue({ error: null });
    const storage = new SupabaseTenantMediaStorage('bucket');

    // Act + Assert — coverage delle varianti supportate da extensionForMimeType
    const cases: Array<{ contentType: string; expectedExt: string }> = [
      { contentType: 'audio/ogg', expectedExt: 'ogg' },
      { contentType: 'audio/mpeg', expectedExt: 'mp3' },
      { contentType: 'audio/mp4', expectedExt: 'm4a' },
      { contentType: 'audio/aac', expectedExt: 'aac' },
      { contentType: 'audio/wav', expectedExt: 'wav' },
      { contentType: 'application/octet-stream', expectedExt: 'bin' },
    ];

    for (const { contentType, expectedExt } of cases) {
      const result = await storage.storeVoiceMedia({
        tenantId: 't',
        messageId: 'm',
        mediaId: 'x',
        bytes: new Uint8Array([0]),
        contentType,
      });

      expect(result.path).toBe(`t/whatsapp/voice/m/x.${expectedExt}`);
    }
  });

  it('handles content types with charset parameter (audio/ogg; codecs=opus)', async () => {
    // Arrange
    uploadMock.mockResolvedValueOnce({ error: null });
    const storage = new SupabaseTenantMediaStorage('bucket');

    // Act
    const result = await storage.storeVoiceMedia({
      tenantId: 't',
      messageId: 'm',
      mediaId: 'x',
      bytes: new Uint8Array([0]),
      contentType: 'audio/ogg; codecs=opus',
    });

    // Assert — il parametro dopo `;` viene scartato dall'helper
    expect(result.path).toBe('t/whatsapp/voice/m/x.ogg');
  });

  it('throws AppError(upstream_error) when the upload fails', async () => {
    // Arrange
    uploadMock.mockResolvedValueOnce({
      error: { message: 'storage quota exceeded', name: 'StorageError' },
    });
    const storage = new SupabaseTenantMediaStorage('bucket');

    // Act + Assert
    let caught: unknown;
    try {
      await storage.storeVoiceMedia({
        tenantId: 't1',
        messageId: 'm1',
        mediaId: 'a1',
        bytes: new Uint8Array([1]),
        contentType: 'audio/ogg',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe('upstream_error');
    expect((caught as AppError).message).toBe('Failed to store WhatsApp voice media');
    expect((caught as AppError).expose).toBe(false);
  });

  it('uses the default bucket from env when none is provided to the constructor', async () => {
    // Arrange — costruttore senza argomenti deve cadere sul default env
    uploadMock.mockResolvedValueOnce({ error: null });
    const storage = new SupabaseTenantMediaStorage();

    // Act
    const result = await storage.storeVoiceMedia({
      tenantId: 't',
      messageId: 'm',
      mediaId: 'x',
      bytes: new Uint8Array([0]),
      contentType: 'audio/ogg',
    });

    // Assert — il bucket del risultato deve essere stringa non vuota e
    // la chiamata a `from` deve usare lo stesso valore del bucket del result.
    expect(typeof result.bucket).toBe('string');
    expect(result.bucket.length).toBeGreaterThan(0);
    expect(fromMock).toHaveBeenCalledWith(result.bucket);
  });
});

describe('createTenantMediaStorage', () => {
  it('returns a TenantMediaStorage instance backed by the Supabase implementation', () => {
    // Act
    const storage = createTenantMediaStorage();

    // Assert — la factory deve produrre l'implementazione Supabase
    expect(storage).toBeInstanceOf(SupabaseTenantMediaStorage);
  });
});
