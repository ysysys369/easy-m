"use node";

import { v } from 'convex/values';
import OpenAI from 'openai';
import { api } from './_generated/api';
import { action } from './_generated/server';

type WebsiteInsights = {
  websiteSummary: string;
  websiteServices: string[];
  websiteKeywords: string[];
  websiteTone: string;
};

type ScanResult =
  | (WebsiteInsights & {
      success: true;
      message: string;
      partial?: boolean;
    })
  | {
      success: false;
      message: string;
      debug?: string;
    };

type WebsiteSnapshot = {
  url: string;
  title: string;
  metaDescription: string;
  headings: string[];
  paragraphs: string[];
  listItems: string[];
  links: string[];
  colorHints: string[];
  text: string;
  openGraphTitle: string;
  openGraphDescription: string;
  jsonLdTexts: string[];
  metaKeywords: string[];
  truncated: boolean;
  contentLength: number | null;
};

// Hard cap on HTML we ever pull into memory. We aim for 250KB which is
// enough for title, meta, og:*, headings, JSON-LD, and a good slice of
// visible text on every real-world site, while staying far under any
// Convex runtime fetch size limit.
const PARTIAL_FETCH_BYTES = 250_000;
const MAX_TEXT_CHARS = 18_000;
const WEBSITE_SCAN_FAILURE_MESSAGE =
  'לא הצלחנו לסרוק את האתר, אבל אפשר להמשיך עם הפרטים שהזנת';
const WEBSITE_SCAN_PARTIAL_SUCCESS_MESSAGE =
  'האתר נסרק חלקית ונשמרו פרטים חשובים';

const ENABLE_DEV_WEBSITE_SCAN_LOGS =
  process.env.EASY_M_DEV_WEBSITE_SCAN_LOGS === 'true' &&
  process.env.EASY_M_RUNTIME_ENV === 'development' &&
  process.env.NODE_ENV !== 'production';

function devInfo(message: string, payload?: unknown): void {
  if (ENABLE_DEV_WEBSITE_SCAN_LOGS) {
    console.info(message, payload ?? '');
  }
}

function devWarn(message: string, payload?: unknown): void {
  if (ENABLE_DEV_WEBSITE_SCAN_LOGS) {
    console.warn(message, payload ?? '');
  }
}

function devError(message: string, payload?: unknown): void {
  if (ENABLE_DEV_WEBSITE_SCAN_LOGS) {
    console.error(message, payload ?? '');
  }
}

const FETCH_HEADER_VARIANTS: Array<Record<string, string>> = [
  {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  },
  {
    'User-Agent':
      'Mozilla/5.0 (compatible; EasyMWebsiteScanner/1.0; +https://easym.local)',
    Accept: 'text/html,application/xhtml+xml',
  },
];
const COMMON_FALLBACK_PATHS = [
  '/',
  '/about',
  '/menu',
  '/collections',
  '/collections/all',
  '/collections/judaica',
  '/collections/mezuzah',
  '/collections/menorah',
  '/products',
  '/services',
  '/contact',
  '/pages/about',
  '/pages/about-us',
  '/pages/contact',
  '/he',
  '/he/about',
  '/he/menu',
  '/he/collections',
  '/he/collections/all',
  '/he/products',
  '/he/contact',
];

function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Website URL is required');
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  url.hash = '';
  return url.toString();
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html: string): string {
  return collapseWhitespace(
    decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    )
  );
}

function collectMatches(
  html: string,
  regex: RegExp,
  limit: number,
  groupIndex = 1
): string[] {
  const results: string[] = [];
  for (const match of html.matchAll(regex)) {
    const cleaned = stripHtml(match[groupIndex] ?? '');
    if (!cleaned) continue;
    results.push(cleaned);
    if (results.length >= limit) break;
  }
  return results;
}

function collectRawMatches(
  html: string,
  regex: RegExp,
  limit: number,
  groupIndex = 1
): string[] {
  const results: string[] = [];
  for (const match of html.matchAll(regex)) {
    const value = collapseWhitespace(match[groupIndex] ?? '');
    if (!value) continue;
    results.push(value);
    if (results.length >= limit) break;
  }
  return results;
}

function collectColorHints(html: string): string[] {
  const matches = html.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  const unique = Array.from(new Set(matches.map((value) => value.toLowerCase())));
  return unique.slice(0, 8);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => collapseWhitespace(value)).filter(Boolean)));
}

function collectMetaContents(
  html: string,
  attribute: 'name' | 'property',
  value: string
): string[] {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patternA = new RegExp(
    `<meta[^>]+${attribute}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'gi'
  );
  const patternB = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${escaped}["'][^>]*>`,
    'gi'
  );

  return [
    ...collectMatches(html, patternA, 8),
    ...collectMatches(html, patternB, 8),
  ];
}

function collectJsonLdTexts(html: string): string[] {
  const blocks = collectRawMatches(
    html,
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    10
  );

  const extracted: string[] = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length > 0 && extracted.length < 20) {
        const current = queue.shift();
        if (!current) continue;
        if (typeof current === 'string') {
          const cleaned = collapseWhitespace(current);
          if (cleaned.length > 2) extracted.push(cleaned);
          continue;
        }
        if (Array.isArray(current)) {
          queue.push(...current);
          continue;
        }
        if (typeof current === 'object') {
          for (const value of Object.values(current)) {
            queue.push(value);
          }
        }
      }
    } catch {}
  }

  return Array.from(new Set(extracted)).slice(0, 20);
}

function collectLinks(html: string): string[] {
  const hrefs = collectRawMatches(
    html,
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    60,
    1
  );
  const labels = collectMatches(
    html,
    /<a[^>]+href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/gi,
    60,
    1
  );

  return dedupe([
    ...hrefs.filter((href) => !href.startsWith('#') && !href.startsWith('javascript:')),
    ...labels,
  ]).slice(0, 40);
}

function buildFetchVariants(url: string): string[] {
  const normalized = normalizeWebsiteUrl(url);
  const parsed = new URL(normalized);
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  parsed.search = '';
  parsed.hash = '';
  const hostnameWithoutWww = parsed.hostname.replace(/^www\./, '');
  const hostnames = dedupe([hostnameWithoutWww, `www.${hostnameWithoutWww}`]);
  const protocols = ['https:', 'http:'];
  const pathVariants = dedupe([
    parsed.pathname,
    parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, ''),
  ]);

  const variants: string[] = [];
  for (const protocol of protocols) {
    for (const hostname of hostnames) {
      for (const pathname of pathVariants) {
        const next = new URL(parsed.toString());
        next.protocol = protocol;
        next.hostname = hostname;
        next.pathname = pathname || '/';
        variants.push(next.toString());
        if (pathname === '/') {
          variants.push(next.toString().replace(/\/$/, ''));
        }
      }
    }
  }

  return Array.from(new Set([parsed.toString(), ...variants]));
}

function buildCommonPageVariants(url: string): string[] {
  const parsed = new URL(url);
  return Array.from(
    new Set(
      COMMON_FALLBACK_PATHS.map((suffix) => {
        const next = new URL(parsed.toString());
        next.pathname = suffix;
        next.search = '';
        next.hash = '';
        return next.toString();
      })
    )
  );
}

function isHomePageUrl(url: string): boolean {
  const parsed = new URL(url);
  return parsed.pathname === '/' || parsed.pathname === '';
}

function formatErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    // Access `cause` defensively — older lib targets may not type it.
    const rawCause = (error as Error & { cause?: unknown }).cause;
    const cause =
      typeof rawCause === 'object' && rawCause !== null
        ? JSON.stringify(rawCause)
        : rawCause
          ? String(rawCause)
          : '';
    return cause ? `${error.message} | cause: ${cause}` : error.message;
  }
  return String(error);
}

/**
 * Bulletproof partial HTML fetcher.
 *
 * Strategy (in order):
 *  1. Best-effort HEAD request to peek at Content-Length without downloading
 *     the body. If the server doesn't support HEAD, we silently move on.
 *  2. If size is unknown OR the resource is larger than PARTIAL_FETCH_BYTES,
 *     issue a GET with `Range: bytes=0-N` so the server sends us only the
 *     first slice. Most modern servers (Cloudflare, NGINX, Apache, Shopify,
 *     WooCommerce, etc.) honor this for HTML and return 206 Partial Content.
 *  3. If the server ignores Range and returns the full body anyway, the
 *     streaming reader caps it locally at PARTIAL_FETCH_BYTES.
 *  4. If ANY fetch/read error occurs (Convex size limits, network failure,
 *     timeout, etc.) we catch it and return whatever we already collected —
 *     possibly an empty string. This guarantees we NEVER throw a size error
 *     to the caller.
 */
type PartialHtml = {
  text: string;
  truncated: boolean;
  status: number;
  contentType: string;
  /** Original Content-Length advertised by the server (null if unknown). */
  originalSize: number | null;
  /** Number of bytes we actually pulled before stopping. */
  readSize: number;
  /** Reason we stopped reading early (for logs). */
  truncationReason?: string;
};

function buildRequestHeaders(
  url: string,
  variantIndex: number,
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    ...FETCH_HEADER_VARIANTS[variantIndex % FETCH_HEADER_VARIANTS.length],
    Referer: new URL(url).origin,
    ...extra,
  };
}

async function fetchPartialHtml(url: string): Promise<PartialHtml> {
  // ── Step 1: HEAD peek to learn content-length (best effort) ────────────────
  let originalSize: number | null = null;
  let headContentType = '';
  try {
    const headController = new AbortController();
    const headTimeout = setTimeout(() => headController.abort(), 5_000);
    try {
      const headResp = await fetch(url, {
        method: 'HEAD',
        headers: buildRequestHeaders(url, 0),
        redirect: 'follow',
        signal: headController.signal,
      });
      const len = Number(headResp.headers.get('content-length') ?? '0');
      if (len > 0) originalSize = len;
      headContentType = headResp.headers.get('content-type') ?? '';
      devInfo('fetchPartialHtml HEAD result', {
        url,
        status: headResp.status,
        contentLength: originalSize,
        contentType: headContentType,
      });
    } finally {
      clearTimeout(headTimeout);
    }
  } catch (err) {
    // Many sites/CDNs don't allow HEAD — this is fine, fall through.
    devInfo('fetchPartialHtml HEAD unavailable (continuing)', {
      url,
      reason: formatErrorDetails(err),
    });
  }

  // ── Step 2: GET with Range when we don't know it's small ──────────────────
  const useRange =
    originalSize === null || originalSize > PARTIAL_FETCH_BYTES;
  const rangeHeader = `bytes=0-${PARTIAL_FETCH_BYTES - 1}`;
  const getHeaders = useRange
    ? buildRequestHeaders(url, 0, { Range: rangeHeader })
    : buildRequestHeaders(url, 0);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: getHeaders,
      redirect: 'follow',
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    devError('fetchPartialHtml GET failed entirely', {
      url,
      useRange,
      error: formatErrorDetails(err),
    });
    return {
      text: '',
      truncated: true,
      status: 0,
      contentType: headContentType,
      originalSize,
      readSize: 0,
      truncationReason: 'fetch-threw',
    };
  }

  const status = response.status;
  const contentType =
    response.headers.get('content-type') ?? headContentType ?? '';
  const respLen = Number(response.headers.get('content-length') ?? '0');
  if (originalSize === null && respLen > 0) originalSize = respLen;

  devInfo('fetchPartialHtml GET result', {
    url,
    status,
    contentType,
    respContentLength: respLen || null,
    rangeRequested: useRange,
    rangeHonored: status === 206,
    originalSize,
  });

  // 206 Partial Content = server honored our Range (intentional truncation).
  // Anything else 2xx means it sent us a body we'll cap ourselves.
  const acceptableStatuses = new Set([200, 206]);
  if (!acceptableStatuses.has(status)) {
    clearTimeout(timeout);
    return {
      text: '',
      truncated: true,
      status,
      contentType,
      originalSize,
      readSize: 0,
      truncationReason: `unacceptable-status-${status}`,
    };
  }

  // ── Step 3: stream body with hard cap. Catch ALL read errors. ─────────────
  let text = '';
  let readSize = 0;
  let truncated = useRange && status === 206; // honored Range → truncated by design
  let truncationReason: string | undefined = truncated ? 'range-honored' : undefined;

  try {
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let total = 0;
      // biome-ignore lint/correctness/noConstantCondition: streaming loop
      while (true) {
        let chunk: { done: boolean; value?: Uint8Array };
        try {
          chunk = (await reader.read()) as { done: boolean; value?: Uint8Array };
        } catch (readErr) {
          truncated = true;
          truncationReason = `read-error: ${formatErrorDetails(readErr).slice(0, 120)}`;
          devWarn('fetchPartialHtml: chunk read failed mid-stream', {
            url,
            bytesReadSoFar: total,
            error: formatErrorDetails(readErr),
          });
          break;
        }
        if (chunk.done) break;
        const value = chunk.value;
        if (!value) continue;

        const remaining = PARTIAL_FETCH_BYTES - total;
        if (remaining <= 0) {
          truncated = true;
          truncationReason ??= 'local-cap-reached';
          try { await reader.cancel(); } catch { /* ignore */ }
          break;
        }
        if (value.byteLength > remaining) {
          const slice = value.slice(0, remaining);
          text += decoder.decode(slice, { stream: false });
          total += slice.byteLength;
          truncated = true;
          truncationReason ??= 'local-cap-reached';
          try { await reader.cancel(); } catch { /* ignore */ }
          break;
        }
        text += decoder.decode(value, { stream: true });
        total += value.byteLength;
      }
      text += decoder.decode();
      readSize = total;
    } else {
      // No streamable body — last resort fallback. Convex could reject this
      // for huge responses; wrap defensively.
      const full = await response.text();
      const sliced = full.slice(0, PARTIAL_FETCH_BYTES);
      text = sliced;
      readSize = sliced.length;
      if (full.length > PARTIAL_FETCH_BYTES) {
        truncated = true;
        truncationReason = 'no-body-fallback-truncated';
      }
    }
  } catch (err) {
    // Convex "Website response exceeded size limit" or any other reader/decode error.
    // We deliberately swallow it — we'll work with what we have.
    truncated = true;
    truncationReason = `body-exception: ${formatErrorDetails(err).slice(0, 120)}`;
    readSize = text.length;
    devWarn('fetchPartialHtml: body extraction caught error', {
      url,
      error: formatErrorDetails(err),
      bytesSalvaged: text.length,
    });
  } finally {
    clearTimeout(timeout);
  }

  return {
    text,
    truncated,
    status,
    contentType,
    originalSize,
    readSize,
    truncationReason,
  };
}

async function fetchWebsiteSnapshot(url: string): Promise<WebsiteSnapshot> {
  // Bulletproof partial fetch — never throws on size, always returns
  // a PartialHtml object (possibly with empty text).
  const partial = await fetchPartialHtml(url);

  devInfo('Website scanner partial fetch result', {
    url,
    status: partial.status,
    contentType: partial.contentType,
    originalSize: partial.originalSize,
    readSize: partial.readSize,
    truncated: partial.truncated,
    truncationReason: partial.truncationReason,
  });

  // Reject non-2xx (4xx/5xx) — variant fallbacks will try other URLs
  if (partial.status === 0 || (partial.status >= 400 && partial.status < 600)) {
    throw new Error(
      `Website fetch failed: status=${partial.status} reason=${partial.truncationReason ?? 'unknown'}`
    );
  }

  // Non-HTML content type → not useful for scraping
  const lowerType = partial.contentType.toLowerCase();
  if (lowerType && !lowerType.includes('text/html') && !lowerType.includes('application/xhtml')) {
    throw new Error(`Website did not return HTML (content-type=${partial.contentType})`);
  }

  // Even if we got 0 bytes (server stalled, etc.) we proceed — extraction
  // will simply yield empty fields, and the caller can decide whether to
  // accept the partial snapshot.
  const html = partial.text;
  const truncated = partial.truncated;
    const title = collapseWhitespace(
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ''
    );
    const metaDescription = collapseWhitespace(
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
      )?.[1] ??
        html.match(
          /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
        )?.[1] ??
        ''
    );
    const openGraphTitle = collectMetaContents(html, 'property', 'og:title')[0] ?? '';
    const openGraphDescription =
      collectMetaContents(html, 'property', 'og:description')[0] ?? '';
    const metaKeywords = collapseWhitespace(
      collectMetaContents(html, 'name', 'keywords')[0] ?? ''
    )
      .split(/[,|]/)
      .map((value) => collapseWhitespace(value))
      .filter((value) => value.length > 1)
      .slice(0, 12);
    const headings = collectMatches(
      html,
      /<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi,
      12,
      2
    ).map((value) => collapseWhitespace(value));
    const paragraphs = collectMatches(html, /<p[^>]*>([\s\S]*?)<\/p>/gi, 24);
    const listItems = collectMatches(html, /<li[^>]*>([\s\S]*?)<\/li>/gi, 24);
    const links = collectLinks(html);
    const jsonLdTexts = collectJsonLdTexts(html);
    const text = stripHtml(
      [
        title,
        openGraphTitle,
        metaDescription,
        openGraphDescription,
        ...headings,
        ...paragraphs,
        ...listItems,
        ...links,
        ...jsonLdTexts,
      ].join('\n')
    ).slice(0, MAX_TEXT_CHARS);
    devInfo('Website scanner extracted metadata', {
      url,
      truncated,
      title,
      description: metaDescription || openGraphDescription,
      extractedFields: {
        headings: headings.length,
        paragraphs: paragraphs.length,
        listItems: listItems.length,
        links: links.length,
        jsonLdTexts: jsonLdTexts.length,
      },
    });

    return {
      url,
      title,
      metaDescription,
      headings,
      paragraphs,
      listItems,
      links,
      colorHints: collectColorHints(html),
      text,
      openGraphTitle,
      openGraphDescription,
      jsonLdTexts,
      metaKeywords,
      truncated,
      contentLength: partial.originalSize,
    };
}

function mergeSnapshots(snapshots: WebsiteSnapshot[]): WebsiteSnapshot {
  const [first, ...rest] = snapshots;
  const merged = {
    ...first,
    headings: [...first.headings],
    paragraphs: [...first.paragraphs],
    listItems: [...first.listItems],
    links: [...first.links],
    colorHints: [...first.colorHints],
    jsonLdTexts: [...first.jsonLdTexts],
    metaKeywords: [...first.metaKeywords],
    text: first.text,
    truncated: first.truncated,
    contentLength: first.contentLength,
  };

  for (const snapshot of rest) {
    merged.headings = dedupe([...merged.headings, ...snapshot.headings]).slice(0, 24);
    merged.paragraphs = dedupe([...merged.paragraphs, ...snapshot.paragraphs]).slice(0, 32);
    merged.listItems = dedupe([...merged.listItems, ...snapshot.listItems]).slice(0, 32);
    merged.links = dedupe([...merged.links, ...snapshot.links]).slice(0, 60);
    merged.colorHints = dedupe([...merged.colorHints, ...snapshot.colorHints]).slice(0, 12);
    merged.jsonLdTexts = dedupe([...merged.jsonLdTexts, ...snapshot.jsonLdTexts]).slice(0, 30);
    merged.metaKeywords = dedupe([...merged.metaKeywords, ...snapshot.metaKeywords]).slice(0, 16);
    merged.text = stripHtml([merged.text, snapshot.text].join('\n')).slice(0, MAX_TEXT_CHARS);
    merged.truncated = merged.truncated || snapshot.truncated;
    merged.contentLength = merged.contentLength ?? snapshot.contentLength;
    if (!merged.metaDescription && snapshot.metaDescription) merged.metaDescription = snapshot.metaDescription;
    if (!merged.openGraphTitle && snapshot.openGraphTitle) merged.openGraphTitle = snapshot.openGraphTitle;
    if (!merged.openGraphDescription && snapshot.openGraphDescription) {
      merged.openGraphDescription = snapshot.openGraphDescription;
    }
  }

  return merged;
}

function hasUsefulContent(snapshot: WebsiteSnapshot): boolean {
  return Boolean(
    snapshot.title ||
      snapshot.metaDescription ||
      snapshot.openGraphTitle ||
      snapshot.openGraphDescription ||
      snapshot.headings.length ||
      snapshot.paragraphs.length ||
      snapshot.listItems.length ||
      snapshot.links.length ||
      snapshot.metaKeywords.length ||
      snapshot.text.length > 80 ||
      snapshot.jsonLdTexts.length
  );
}

async function fetchWebsiteSnapshotWithFallbacks(
  inputUrl: string
): Promise<{ snapshot: WebsiteSnapshot; resolvedUrl: string; partial: boolean }> {
  const variants = buildFetchVariants(inputUrl);
  const allVariants = [
    ...variants,
    ...variants.flatMap((variant) => buildCommonPageVariants(variant)),
  ];
  let lastError: unknown;
  devInfo('Website scanner variants', { inputUrl, variants: allVariants });

  for (const variant of allVariants) {
    try {
      const primarySnapshot = await fetchWebsiteSnapshot(variant);
      if (!hasUsefulContent(primarySnapshot)) {
        throw new Error('No useful content extracted from page');
      }

      const siblingPages = buildCommonPageVariants(variant).filter(
        (page) => page !== variant
      );
      const siblingResults = await Promise.all(
        siblingPages.map(async (page) => {
          try {
            return await fetchWebsiteSnapshot(page);
          } catch (error) {
            devWarn('Website scanner sibling page failed', {
              attemptedUrl: page,
              reasonFailed: formatErrorDetails(error),
            });
            return null;
          }
        })
      );
      const successfulSiblings = siblingResults.filter(
        (snapshot): snapshot is WebsiteSnapshot => Boolean(snapshot && hasUsefulContent(snapshot))
      );
      const mergedSnapshot = mergeSnapshots([primarySnapshot, ...successfulSiblings]);
      return {
        snapshot: mergedSnapshot,
        resolvedUrl: variant,
        partial:
          mergedSnapshot.truncated ||
          !isHomePageUrl(variant),
      };
    } catch (error) {
      lastError = error;
      devWarn('Website scanner variant failed', {
        attemptedUrl: variant,
        reasonFailed: formatErrorDetails(error),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Website fetch failed');
}

function isRestaurantLike(snapshot: WebsiteSnapshot): boolean {
  const corpus = [
    snapshot.title,
    snapshot.openGraphTitle,
    snapshot.metaDescription,
    snapshot.openGraphDescription,
    ...snapshot.headings,
    ...snapshot.listItems,
    ...snapshot.jsonLdTexts,
  ]
    .join(' ')
    .toLowerCase();

  return [
    'menu',
    'reservation',
    'reservations',
    'restaurant',
    'cafe',
    'food',
    'dish',
    'kitchen',
    'chef',
    'תפריט',
    'מסעדה',
    'אוכל',
    'מנות',
    'מטבח',
    'הזמנה',
    'הזמנת מקום',
  ].some((token) => corpus.includes(token));
}

function collectRestaurantTerms(snapshot: WebsiteSnapshot): string[] {
  const combined = [
    ...snapshot.headings,
    ...snapshot.listItems,
    ...snapshot.metaKeywords,
    ...snapshot.links,
    ...snapshot.jsonLdTexts,
  ];
  const detectedCuisineTypes = [
    'italian',
    'asian',
    'japanese',
    'thai',
    'mexican',
    'indian',
    'mediterranean',
    'burger',
    'pizza',
    'sushi',
    'vegan',
    'vegetarian',
    'איטלקי',
    'אסייתי',
    'יפני',
    'מקסיקני',
    'הודי',
    'ים תיכוני',
    'בורגר',
    'פיצה',
    'סושי',
    'טבעוני',
    'צמחוני',
  ];

  const keywordHits = combined.filter((value) =>
    /(menu|reservation|reservations|dish|food|cuisine|chef|תפריט|מסעדה|מנות|הזמנה|מטבח)/i.test(
      value
    )
  );

  const cuisineHits = detectedCuisineTypes.filter((value) =>
    combined.some((text) => text.toLowerCase().includes(value.toLowerCase()))
  );

  return Array.from(new Set([...keywordHits, ...cuisineHits]))
    .map((value) => collapseWhitespace(value))
    .filter((value) => value.length > 2)
    .slice(0, 10);
}

function collectProductCategoryTerms(snapshot: WebsiteSnapshot): string[] {
  const combined = [
    snapshot.title,
    snapshot.openGraphTitle,
    snapshot.metaDescription,
    snapshot.openGraphDescription,
    ...snapshot.headings,
    ...snapshot.listItems,
    ...snapshot.links,
    ...snapshot.metaKeywords,
    ...snapshot.jsonLdTexts,
  ];
  const corpus = combined.join(' ').toLowerCase();
  const categoryTerms = [
    'luxury Judaica brand',
    'handmade Jewish art',
    'Judaica',
    'mezuzahs',
    'mezuzah',
    'menorahs',
    'menorah',
    'shofar stands',
    'shofar stand',
    'Shabbat',
    'Jewish holidays',
    'made in Israel',
    'premium gifts',
    'elegant traditional design',
    'Jewish art',
    'יודאיקה',
    'מזוזה',
    'מזוזות',
    'חנוכייה',
    'חנוכיות',
    'שופר',
    'שבת',
    'חגים',
    'מתנות יוקרה',
    'עבודת יד',
    'תוצרת ישראל',
  ];
  const directHits = categoryTerms.filter((term) =>
    corpus.includes(term.toLowerCase())
  );
  const commerceHits = combined.filter((value) =>
    /(collection|collections|product|products|gift|gifts|shop|judaica|mezuzah|menorah|shofar|shabbat|holiday|handmade|israel|קולקציה|מוצר|מתנה|יודאיקה|מזוז|חנוכ|שופר|שבת|חגים|ישראל)/i.test(
      value
    )
  );

  return dedupe([...directHits, ...commerceHits])
    .filter((value) => value.length > 2)
    .slice(0, 12);
}

function detectBusinessType(snapshot: WebsiteSnapshot): string {
  const corpus = [
    snapshot.title,
    snapshot.openGraphTitle,
    snapshot.metaDescription,
    snapshot.openGraphDescription,
    ...snapshot.headings,
    ...snapshot.listItems,
    ...snapshot.links,
    ...snapshot.jsonLdTexts,
    ...snapshot.metaKeywords,
  ]
    .join(' ')
    .toLowerCase();

  const checks: Array<{ type: string; tokens: string[] }> = [
    {
      type: 'luxury Judaica brand',
      tokens: [
        'judaica',
        'mezuzah',
        'menorah',
        'shofar',
        'shabbat',
        'jewish holidays',
        'made in israel',
        'יודאיקה',
        'מזוז',
        'חנוכ',
        'שופר',
      ],
    },
    {
      type: 'restaurant',
      tokens: ['menu', 'restaurant', 'dish', 'food', 'chef', 'תפריט', 'מסעדה', 'מנות', 'סושי'],
    },
    {
      type: 'beauty',
      tokens: ['beauty', 'skin', 'cosmetic', 'spa', 'facial', 'יופי', 'קוסמטיקה', 'טיפולי פנים'],
    },
    {
      type: 'fitness',
      tokens: ['fitness', 'gym', 'training', 'workout', 'כושר', 'אימון', 'פילאטיס'],
    },
    {
      type: 'ecommerce',
      tokens: ['shop', 'store', 'cart', 'checkout', 'product', 'מוצר', 'קנייה', 'עגלה'],
    },
    {
      type: 'clinic',
      tokens: ['clinic', 'treatment', 'doctor', 'medical', 'קליניקה', 'רופא', 'טיפול'],
    },
    {
      type: 'local service',
      tokens: ['service', 'booking', 'appointment', 'contact', 'שירות', 'קביעת תור', 'הזמנת שירות'],
    },
    {
      type: 'product brand',
      tokens: ['brand', 'collection', 'signature', 'מותג', 'קולקציה', 'מוצרי הדגל'],
    },
  ];

  return checks.find((check) => check.tokens.some((token) => corpus.includes(token)))?.type ?? 'business';
}

function heuristicInsights(
  url: string,
  snapshot: WebsiteSnapshot
): WebsiteInsights {
  const name =
    snapshot.headings[0] ??
    snapshot.openGraphTitle ??
    snapshot.title.split('|')[0]?.split('-')[0]?.trim() ??
    new URL(url).hostname.replace(/^www\./, '');
  const restaurantTerms = isRestaurantLike(snapshot)
    ? collectRestaurantTerms(snapshot)
    : [];
  const productCategoryTerms = collectProductCategoryTerms(snapshot);
  const services = Array.from(
    new Set(
      [
        ...snapshot.headings.slice(1),
        ...snapshot.listItems,
        ...restaurantTerms,
        ...productCategoryTerms,
      ]
        .map((value) => collapseWhitespace(value))
        .filter((value) => value.length > 2)
        .slice(0, 10)
    )
  );
  const keywords = Array.from(
    new Set(
      [
        ...services.flatMap((value) => value.split(/[,/-]/)),
        ...snapshot.metaDescription.split(/[,/-]/),
        ...snapshot.openGraphDescription.split(/[,/-]/),
        ...snapshot.metaKeywords,
        ...restaurantTerms,
        ...productCategoryTerms,
      ]
        .map((value) => collapseWhitespace(value))
        .filter((value) => value.length > 2)
        .slice(0, 16)
    )
  );
  const branding = snapshot.colorHints.length
    ? ` רמזי מיתוג וצבעים: ${snapshot.colorHints.join(', ')}.`
    : '';
  const restaurantSummary = restaurantTerms.length
    ? ` רמזי מסעדה שזוהו: ${restaurantTerms.join(', ')}.`
    : '';
  const businessType = detectBusinessType(snapshot);
  const productSummary = productCategoryTerms.length
    ? ` קטגוריות ומוצרים שזוהו: ${productCategoryTerms.slice(0, 8).join(', ')}.`
    : '';
  const partialSummary = snapshot.truncated
    ? ' הסריקה בוצעה על חלק מהאתר בגלל גודל הדף, אך נשמרו פרטים חשובים.'
    : '';

  return {
    websiteSummary:
      `שם העסק כנראה: ${name}. קטגוריית העסק כנראה: ${businessType}. ` +
      `האתר מדגיש את השירותים/המוצרים הבאים: ${
        services.length ? services.join(', ') : 'לא זוהו במדויק'
      }. ` +
      `תיאור כללי: ${
        snapshot.metaDescription ||
        snapshot.openGraphDescription ||
        snapshot.paragraphs[0] ||
        snapshot.title
      }.` +
      branding +
      restaurantSummary +
      productSummary +
      partialSummary,
    websiteServices: services,
    websiteKeywords: dedupe([...keywords, businessType]),
    websiteTone:
      snapshot.metaDescription.includes('יוקרה') ||
      snapshot.openGraphDescription.includes('יוקרה')
        ? 'יוקרתי'
        : 'מקצועי',
  };
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? value;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function buildWebsiteInsightsWithAi(
  snapshot: WebsiteSnapshot,
  websiteUrl: string
): Promise<WebsiteInsights> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return heuristicInsights(websiteUrl, snapshot);

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You extract structured business intelligence from website content. ' +
          'Return valid JSON only with keys: websiteSummary, websiteServices, websiteKeywords, websiteTone. ' +
          'websiteSummary must be a concise Hebrew summary with the business name, category, services/products, target audience, location/contact if present, and branding clues if visible. ' +
          'websiteServices and websiteKeywords must be arrays of short Hebrew phrases. ' +
          'websiteTone must be one short Hebrew style phrase like "יוקרתי", "מקצועי", "צעיר", or "ידידותי".',
      },
      {
        role: 'user',
        content:
          `Website URL: ${websiteUrl}\n` +
          `Title: ${snapshot.title}\n` +
          `Open Graph title: ${snapshot.openGraphTitle}\n` +
          `Meta description: ${snapshot.metaDescription}\n` +
          `Open Graph description: ${snapshot.openGraphDescription}\n` +
          `Meta keywords: ${snapshot.metaKeywords.join(' | ')}\n` +
          `Headings: ${snapshot.headings.join(' | ')}\n` +
          `Paragraph samples: ${snapshot.paragraphs.slice(0, 8).join(' | ')}\n` +
          `List items: ${snapshot.listItems.slice(0, 8).join(' | ')}\n` +
          `Links and navigation labels: ${snapshot.links.slice(0, 20).join(' | ')}\n` +
          `JSON-LD text: ${snapshot.jsonLdTexts.slice(0, 8).join(' | ')}\n` +
          `Detected business type: ${detectBusinessType(snapshot)}\n` +
          `Detected product/category hints: ${collectProductCategoryTerms(snapshot).join(' | ')}\n` +
          `Color hints: ${snapshot.colorHints.join(', ')}\n` +
          `Visible text: ${snapshot.text}`,
      },
    ],
    max_tokens: 700,
  });

  const parsed = parseJsonObject(
    response.choices[0]?.message?.content?.trim() ?? ''
  );
  if (!parsed) return heuristicInsights(websiteUrl, snapshot);

  const websiteSummary = String(parsed.websiteSummary ?? '').trim();
  const websiteServices = Array.isArray(parsed.websiteServices)
    ? parsed.websiteServices
        .map((value) => collapseWhitespace(String(value)))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const websiteKeywords = Array.isArray(parsed.websiteKeywords)
    ? parsed.websiteKeywords
        .map((value) => collapseWhitespace(String(value)))
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const websiteTone = collapseWhitespace(String(parsed.websiteTone ?? ''));

  if (!websiteSummary) return heuristicInsights(websiteUrl, snapshot);
  const fallbackInsights = heuristicInsights(websiteUrl, snapshot);

  return {
    websiteSummary,
    websiteServices: dedupe([
      ...websiteServices,
      ...fallbackInsights.websiteServices,
    ]).slice(0, 12),
    websiteKeywords: dedupe([
      ...websiteKeywords,
      ...fallbackInsights.websiteKeywords,
    ]).slice(0, 18),
    websiteTone: websiteTone || fallbackInsights.websiteTone || 'מקצועי',
  };
}

export const scanBusinessWebsite = action({
  args: { websiteUrl: v.optional(v.string()) },
  handler: async (ctx, { websiteUrl }): Promise<ScanResult> => {
    try {
      const profile = await ctx.runQuery(api.businessProfiles.getMyBusinessProfile);

      if (!profile?.businessName) {
        throw new Error('NO_BUSINESS_PROFILE');
      }

      const normalizedWebsiteUrl = normalizeWebsiteUrl(
        websiteUrl ?? profile.websiteUrl ?? profile.website ?? ''
      );
      devInfo('Website scanner starting', {
        inputUrl: websiteUrl ?? '',
        savedWebsiteUrl: profile.websiteUrl ?? profile.website ?? '',
        normalizedUrl: normalizedWebsiteUrl,
      });

      const { snapshot, resolvedUrl, partial } =
        await fetchWebsiteSnapshotWithFallbacks(normalizedWebsiteUrl);
      const insights = await buildWebsiteInsightsWithAi(
        snapshot,
        resolvedUrl
      );
      // Detailed size + truncation diagnostics (required by spec)
      devInfo('Website scanner final insights', {
        resolvedUrl,
        extractedTitle: snapshot.title || snapshot.openGraphTitle,
        extractedDescription:
          snapshot.metaDescription || snapshot.openGraphDescription,
        finalSummary: insights.websiteSummary,
        partial,
        truncated: snapshot.truncated,
        originalContentSize: snapshot.contentLength,
        truncatedToBytes: snapshot.truncated ? PARTIAL_FETCH_BYTES : snapshot.contentLength,
        partialScanSucceeded: Boolean(insights.websiteSummary),
        extractedFields: {
          headings: snapshot.headings.length,
          paragraphs: snapshot.paragraphs.length,
          listItems: snapshot.listItems.length,
          links: snapshot.links.length,
          jsonLdTexts: snapshot.jsonLdTexts.length,
        },
      });

      // Always save — even when partial — so the user gets value from the scan
      await ctx.runMutation(api.businessProfiles.saveWebsiteScanResults, {
        websiteUrl: resolvedUrl,
        websiteSummary: insights.websiteSummary,
        websiteServices: insights.websiteServices,
        websiteKeywords: insights.websiteKeywords,
        websiteTone: insights.websiteTone,
        lastWebsiteScanAt: Date.now(),
        websiteScanTruncated: snapshot.truncated,
      });
      devInfo('Website scanner summary saved', {
        websiteUrl: resolvedUrl,
        finalSummary: insights.websiteSummary,
        partialSummarySaved: partial,
        truncated: snapshot.truncated,
      });

      return {
        success: true,
        message: partial || snapshot.truncated
          ? WEBSITE_SCAN_PARTIAL_SUCCESS_MESSAGE
          : 'האתר נסרק בהצלחה',
        partial: partial || snapshot.truncated,
        ...insights,
      };
    } catch (error) {
      devError('Website scanner failed', {
        error: formatErrorDetails(error),
        requestedWebsiteUrl: websiteUrl,
      });
      return {
        success: false,
        message: WEBSITE_SCAN_FAILURE_MESSAGE,
        debug: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
