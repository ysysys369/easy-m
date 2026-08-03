import type { Id } from './_generated/dataModel';

type LogoStorageContext = {
  storage: {
    getUrl: (storageId: Id<'_storage'>) => Promise<string | null>;
  };
};

type ProfileWithLogo = {
  logoUrl?: string;
};

export type SupportedLogoImage = {
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  extension: 'png' | 'jpg' | 'webp';
};

/** Resolve a saved Business Profile logo storage ref to a server-accessible URL. */
export async function resolveSavedLogoUrl(
  ctx: LogoStorageContext,
  savedLogoRef: string | undefined
): Promise<string | undefined> {
  const value = savedLogoRef?.trim();
  if (!value) return undefined;

  const legacyStorageMatch = value.match(/\/storage\/([^/?#]+)/);
  if (legacyStorageMatch) {
    try {
      return (
        (await ctx.storage.getUrl(legacyStorageMatch[1] as Id<'_storage'>)) ??
        undefined
      );
    } catch {
      return undefined;
    }
  }

  if (/^https?:\/\//i.test(value)) return value;

  try {
    return (await ctx.storage.getUrl(value as Id<'_storage'>)) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Make the generation profile reflect the logo that was actually validated.
 * A stale or inaccessible saved value is treated exactly like no saved logo.
 */
export function withValidatedLogo<T extends ProfileWithLogo>(
  profile: T,
  validLogoUrl: string | undefined
): T {
  const normalizedLogoUrl = validLogoUrl?.trim();
  if (normalizedLogoUrl) {
    if (profile.logoUrl === normalizedLogoUrl) return profile;
    return { ...profile, logoUrl: normalizedLogoUrl };
  }

  if (!profile.logoUrl) return profile;
  const withoutLogo = { ...profile };
  delete withoutLogo.logoUrl;
  return withoutLogo;
}

/** Validate image bytes rather than trusting a URL or Content-Type header. */
export function detectSupportedLogoImage(
  bytes: Uint8Array
): SupportedLogoImage | null {
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  if (isPng) return { contentType: 'image/png', extension: 'png' };

  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  if (isJpeg) return { contentType: 'image/jpeg', extension: 'jpg' };

  const isWebp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (isWebp) return { contentType: 'image/webp', extension: 'webp' };

  return null;
}

/** Keep the validated logo first so GPT Image gives it the richest fidelity. */
export function collectImageReferences<T>(
  logoReference: T | null | undefined,
  styleReference: T | null | undefined
): T[] {
  return [logoReference, styleReference].filter((reference): reference is T =>
    Boolean(reference)
  );
}

const EXACT_LOGO_INSTRUCTION =
  'The actual uploaded business logo is attached as the first visual input. Place that exact logo once, unchanged. Preserve its original proportions, colors, typography, transparency, and appearance. Do not stretch, crop, distort, translate, restyle, redraw, recreate, or replace it. Do not invent a second logo, do not duplicate the business name, and do not render a separate generic brand mark.';

/** Append a non-negotiable instruction only when a validated logo is attached. */
export function applyValidatedLogoInstruction(
  prompt: string,
  hasValidatedLogo: boolean
): string {
  if (!hasValidatedLogo) return prompt;
  return `${prompt}\n\nLOGO PRESERVATION — ${EXACT_LOGO_INSTRUCTION}`;
}
