import { describe, expect, test } from 'bun:test';
import {
  applyValidatedLogoInstruction,
  collectImageReferences,
  detectSupportedLogoImage,
  resolveSavedLogoUrl,
  withValidatedLogo,
} from './logoAssets.ts';

describe('business logo generation data flow', () => {
  test('resolves a saved Convex storage ID to an accessible URL', async () => {
    const requestedStorageIds = [];
    const ctx = {
      storage: {
        getUrl: async (storageId) => {
          requestedStorageIds.push(String(storageId));
          return 'https://example.convex.cloud/api/storage/logo.png';
        },
      },
    };

    const url = await resolveSavedLogoUrl(ctx, 'kg2recognizablelogo');

    expect(requestedStorageIds).toEqual(['kg2recognizablelogo']);
    expect(url).toBe('https://example.convex.cloud/api/storage/logo.png');
  });

  test('valid logo is retained and is the first visual image reference', () => {
    const savedProfile = {
      businessName: 'Recognizable Brand',
      logoUrl: 'kg2recognizablelogo',
    };
    const resolvedUrl = 'https://example.convex.cloud/api/storage/logo.png';
    const generationProfile = withValidatedLogo(savedProfile, resolvedUrl);
    const actualLogoFile = { name: 'logo.png', recognizable: true };
    const references = collectImageReferences(actualLogoFile, null);

    expect(generationProfile.logoUrl).toBe(resolvedUrl);
    expect(references).toEqual([actualLogoFile]);
    expect(references[0]).toBe(actualLogoFile);
  });

  test('no-logo profile keeps the existing generic-branding branch unchanged', () => {
    const noLogoProfile = { businessName: 'Generic Brand' };
    const generationProfile = withValidatedLogo(noLogoProfile, undefined);
    const references = collectImageReferences(null, null);

    expect(generationProfile).toBe(noLogoProfile);
    expect(generationProfile.logoUrl).toBeUndefined();
    expect(references).toEqual([]);
    expect(applyValidatedLogoInstruction('generic prompt', false)).toBe(
      'generic prompt'
    );
  });

  test('stale or inaccessible saved logo is treated as no valid logo', () => {
    const staleProfile = {
      businessName: 'Generic Brand',
      logoUrl: 'stale-storage-id',
    };

    expect(withValidatedLogo(staleProfile, undefined).logoUrl).toBeUndefined();
  });

  test('valid-logo prompt forbids redraws, duplicates, and business-name duplication', () => {
    const prompt = applyValidatedLogoInstruction('poster prompt', true);

    expect(prompt).toContain('first visual input');
    expect(prompt).toContain('original proportions');
    expect(prompt).toContain('Do not stretch, crop, distort');
    expect(prompt).toContain('Do not invent a second logo');
    expect(prompt).toContain('do not duplicate the business name');
  });

  test('accepts real PNG/JPEG/WEBP bytes and rejects non-images', () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);

    expect(detectSupportedLogoImage(png)?.contentType).toBe('image/png');
    expect(detectSupportedLogoImage(jpeg)?.contentType).toBe('image/jpeg');
    expect(detectSupportedLogoImage(webp)?.contentType).toBe('image/webp');
    expect(detectSupportedLogoImage(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
