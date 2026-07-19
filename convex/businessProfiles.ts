import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';

const imageLabelValidator = v.union(
  v.literal('logo'),
  v.literal('product'),
  v.literal('mood'),
  v.literal('team'),
  v.literal('place'),
  v.literal('food'),
  v.literal('workout'),
  v.literal('before_after')
);

const imageMetadataValidator = v.object({
  storageRef: v.string(),
  label: v.optional(imageLabelValidator),
  rating: v.optional(v.number()),
  aiRecommended: v.optional(v.boolean()),
  featured: v.optional(v.boolean()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
});

type BusinessImageMetadata = {
  storageRef: string;
  label?:
    | 'logo'
    | 'product'
    | 'mood'
    | 'team'
    | 'place'
    | 'food'
    | 'workout'
    | 'before_after';
  rating?: number;
  aiRecommended?: boolean;
  featured?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

type ResolvedStorageCtx = {
  storage: { getUrl: (id: Id<'_storage'>) => Promise<string | null> };
};

async function resolveStorageRef(
  ctx: ResolvedStorageCtx,
  value: string | undefined
): Promise<string | undefined> {
  if (!value) return undefined;

  const legacyMatch = value.match(/\/storage\/([^/?#]+)/);
  if (legacyMatch) {
    try {
      const url = await ctx.storage.getUrl(legacyMatch[1] as Id<'_storage'>);
      return url ?? undefined;
    } catch {
      return undefined;
    }
  }

  if (/^(https?|file|data):/.test(value)) return value;

  try {
    const url = await ctx.storage.getUrl(value as Id<'_storage'>);
    return url ?? undefined;
  } catch {
    return undefined;
  }
}

function sanitizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function clampRating(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function normalizeImageMetadata(
  imageRefs: string[] | undefined,
  incoming: BusinessImageMetadata[] | undefined,
  existing: BusinessImageMetadata[] | undefined,
  now?: number
): BusinessImageMetadata[] | undefined {
  if (!imageRefs?.length) return undefined;

  const incomingByRef = new Map(
    (incoming ?? []).map((item) => [item.storageRef, item])
  );
  const existingByRef = new Map(
    (existing ?? []).map((item) => [item.storageRef, item])
  );
  const featuredRef =
    incoming?.find((item) => item.featured)?.storageRef ??
    existing?.find((item) => item.featured)?.storageRef;

  return imageRefs.map((storageRef) => {
    const source =
      incomingByRef.get(storageRef) ?? existingByRef.get(storageRef);
    const next: BusinessImageMetadata = { storageRef };
    if (source?.label) next.label = source.label;
    const rating = clampRating(source?.rating);
    if (typeof rating === 'number') next.rating = rating;
    next.aiRecommended = source?.aiRecommended ?? false;
    next.featured = featuredRef ? storageRef === featuredRef : false;
    const createdAt = source?.createdAt ?? now;
    const updatedAt = source?.updatedAt ?? now;
    if (typeof createdAt === 'number') next.createdAt = createdAt;
    if (typeof updatedAt === 'number') next.updatedAt = updatedAt;
    return next;
  });
}

function getRelevantLabelBoost(
  label: BusinessImageMetadata['label'],
  businessType: string | undefined
): number {
  if (!label || !businessType) return 0;
  const normalized = businessType.toLowerCase();

  if (
    /מסעד|קפה|סושי|אוכל|פיצה|food|restaurant|cafe|sushi|pizza/.test(normalized)
  ) {
    return label === 'food' || label === 'product' || label === 'place'
      ? 40
      : 0;
  }
  if (/כושר|אימון|gym|fitness|sport/.test(normalized)) {
    return label === 'workout' || label === 'team' || label === 'place'
      ? 40
      : 0;
  }
  if (/יופי|קוסמט|ציפור|מספר|beauty|cosmetic|nail|hair/.test(normalized)) {
    return label === 'before_after' || label === 'product' || label === 'mood'
      ? 40
      : 0;
  }

  return label === 'product' || label === 'mood' ? 20 : 0;
}

function getImagePriority(
  item: BusinessImageMetadata | undefined,
  businessType: string | undefined
): number {
  return (
    (item?.featured ? 1000 : 0) +
    (item?.aiRecommended ? 500 : 0) +
    (item?.rating ?? 0) * 10 +
    getRelevantLabelBoost(item?.label, businessType)
  );
}

function sortImageRefsForGeneration(
  imageRefs: string[] | undefined,
  metadata: BusinessImageMetadata[] | undefined,
  businessType: string | undefined
): string[] | undefined {
  if (!imageRefs?.length) return undefined;
  const metadataByRef = new Map(
    (metadata ?? []).map((item) => [item.storageRef, item])
  );

  return imageRefs
    .map((storageRef, index) => ({
      storageRef,
      index,
      priority: getImagePriority(metadataByRef.get(storageRef), businessType),
    }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .map((item) => item.storageRef);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Pick the most recently updated row from a list of businessProfiles documents.
// Using .collect() + manual reduce instead of .unique() makes every query
// resilient to duplicate rows that could have been created by old onboarding
// flows or any other historical code path.
function pickLatest<T extends { updatedAt: number; _id: string }>(
  rows: T[],
): T | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, p) =>
    (p.updatedAt ?? 0) > (best.updatedAt ?? 0) ? p : best,
  );
}

type AuthenticatedOwner = {
  identity: { subject: string };
  userId: string;
  legacySubject: string;
};

async function getAuthenticatedOwner(ctx: {
  auth: any;
}): Promise<AuthenticatedOwner | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || typeof identity !== 'object' || !('subject' in identity)) {
    return null;
  }
  const authUserId = await getAuthUserId(ctx);
  if (!authUserId) return null;
  const legacySubject = (identity as { subject: string }).subject;
  return {
    identity: { subject: legacySubject },
    userId: String(authUserId),
    legacySubject,
  };
}

function ownerMatches(userId: string, owner: AuthenticatedOwner): boolean {
  return (
    userId === owner.userId ||
    userId === owner.legacySubject ||
    userId.startsWith(`${owner.userId}|`)
  );
}

async function collectBusinessProfilesForOwner(
  ctx: { db: any },
  owner: AuthenticatedOwner,
): Promise<Doc<'businessProfiles'>[]> {
  const byId = new Map<string, Doc<'businessProfiles'>>();
  const addRows = (rows: Doc<'businessProfiles'>[]) => {
    for (const row of rows) byId.set(row._id, row);
  };

  addRows(
    await ctx.db
      .query('businessProfiles')
      .withIndex('by_userId', (q: any) => q.eq('userId', owner.userId))
      .collect(),
  );

  if (owner.legacySubject !== owner.userId) {
    addRows(
      await ctx.db
        .query('businessProfiles')
        .withIndex('by_userId', (q: any) => q.eq('userId', owner.legacySubject))
        .collect(),
    );
  }

  if (byId.size === 0) {
    const legacyRows = (await ctx.db.query('businessProfiles').collect()).filter(
      (row: Doc<'businessProfiles'>) => ownerMatches(row.userId, owner),
    );
    addRows(legacyRows);
  }

  return [...byId.values()];
}

async function migrateBusinessProfilesToOwner(
  ctx: { db: any },
  owner: AuthenticatedOwner,
  rows: Doc<'businessProfiles'>[],
): Promise<Doc<'businessProfiles'> | null> {
  const latest = pickLatest(rows);
  if (!latest) return null;

  if (latest.userId !== owner.userId) {
    await ctx.db.patch(latest._id, {
      userId: owner.userId,
      updatedAt: latest.updatedAt ?? Date.now(),
    });
  }

  for (const row of rows) {
    if (row._id !== latest._id) {
      await ctx.db.delete(row._id);
    }
  }

  return { ...latest, userId: owner.userId };
}

export const getFullUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const owner = await getAuthenticatedOwner(ctx);
    if (!owner) return null;

    const allProfiles = await collectBusinessProfilesForOwner(ctx, owner);
    const onboardingRows = await ctx.db.query('onboardingAnswers').collect();
    const onboardingAnswers = onboardingRows
      .filter((row: { userId: string }) => ownerMatches(row.userId, owner))
      .sort(
        (a: { updatedAt?: number; createdAt: number }, b: { updatedAt?: number; createdAt: number }) =>
          (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
      )[0] ?? null;

    const businessProfile = pickLatest(allProfiles);
    return { businessProfile, onboardingAnswers };
  },
});

async function deleteCurrentWeekSuggestionsForOwner(
  ctx: { db: any },
  owner: AuthenticatedOwner,
) {
  const weekStart = getCurrentWeekStart();
  const allRows = await ctx.db
    .query('aiSuggestions')
    .withIndex('by_userId_and_weekStart', (q: any) =>
      q.eq('userId', owner.userId).eq('weekStartAt', weekStart),
    )
    .collect();
  const legacyRows =
    owner.legacySubject === owner.userId
      ? []
      : await ctx.db
          .query('aiSuggestions')
          .withIndex('by_userId_and_weekStart', (q: any) =>
            q.eq('userId', owner.legacySubject).eq('weekStartAt', weekStart),
          )
          .collect();
  const extraLegacyRows = (await ctx.db.query('aiSuggestions').collect()).filter(
    (row: { userId: string; weekStartAt: number }) =>
      row.weekStartAt === weekStart && ownerMatches(row.userId, owner),
  );
  const byId = new Map<string, { _id: Id<'aiSuggestions'> }>();
  for (const row of [...allRows, ...legacyRows, ...extraLegacyRows]) {
    byId.set(row._id, row);
  }
  for (const row of byId.values()) {
    await ctx.db.delete(row._id);
  }
}

function getCurrentWeekStart(): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
}

export const saveBusinessProfile = mutation({
  args: {
    businessName: v.string(),
    businessType: v.optional(v.string()),
    description: v.optional(v.string()),
    audience: v.optional(v.string()),
    style: v.optional(v.string()),
    city: v.optional(v.string()),
    website: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    socialInstagram: v.optional(v.string()),
    socialFacebook: v.optional(v.string()),
    goal: v.optional(v.string()),
    services: v.optional(v.string()),
    uniqueness: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    imageMetadata: v.optional(v.array(imageMetadataValidator)),
    image: v.optional(v.string()),
    postImageType: v.optional(
      v.union(
        v.literal('photo'),
        v.literal('designed'),
        v.literal('premium_ad')
      )
    ),
  },
  handler: async (ctx, args) => {
    const owner = await getAuthenticatedOwner(ctx);
    if (!owner) {
      throw new Error('לא מחובר למערכת');
    }
    const userId = owner.userId;
    const now = Date.now();

    const normalizedWebsite = sanitizeOptionalString(
      args.websiteUrl ?? args.website
    );

    // Use .collect() instead of .unique() so the mutation is resilient to
    // duplicate rows. Pick the most recent row as the canonical profile and
    // delete any extras atomically within this transaction.
    const allExisting = await collectBusinessProfilesForOwner(ctx, owner);
    const existing = await migrateBusinessProfilesToOwner(ctx, owner, allExisting);

    const websiteChanged =
      normalizedWebsite !==
      sanitizeOptionalString(existing?.websiteUrl ?? existing?.website);

    const imageMetadata = normalizeImageMetadata(
      args.images,
      args.imageMetadata,
      existing?.imageMetadata,
      now
    );

    const payload = {
      ...args,
      imageMetadata,
      website: normalizedWebsite,
      websiteUrl: normalizedWebsite,
      ...(websiteChanged
        ? {
            websiteSummary: undefined,
            websiteServices: undefined,
            websiteKeywords: undefined,
            websiteTone: undefined,
            lastWebsiteScanAt: undefined,
          }
        : {}),
    };

    if (existing) {
      // When key identity fields change, delete this week's cached suggestions so
      // the home screen auto-regenerates them using the updated business profile.
      const businessTypeChanged =
        sanitizeOptionalString(args.businessType) !== sanitizeOptionalString(existing.businessType);
      const businessNameChanged =
        args.businessName.trim() !== (existing.businessName ?? '').trim();

      if (businessTypeChanged || businessNameChanged) {
        await deleteCurrentWeekSuggestionsForOwner(ctx, owner);
      }

      await ctx.db.patch(existing._id, { ...payload, updatedAt: now });
      return existing._id;
    }

    const newId = await ctx.db.insert('businessProfiles', {
      ...payload,
      userId,
      createdAt: now,
      updatedAt: now,
    });
    return newId;
  },
});

export const saveWebsiteScanResults = mutation({
  args: {
    websiteUrl: v.string(),
    websiteSummary: v.string(),
    websiteServices: v.array(v.string()),
    websiteKeywords: v.array(v.string()),
    websiteTone: v.string(),
    lastWebsiteScanAt: v.number(),
    websiteScanTruncated: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const owner = await getAuthenticatedOwner(ctx);
    if (!owner) throw new Error('לא מחובר למערכת');

    const all = await collectBusinessProfilesForOwner(ctx, owner);
    const profile = await migrateBusinessProfilesToOwner(ctx, owner, all);
    if (!profile) throw new Error('NO_BUSINESS_PROFILE');

    await ctx.db.patch(profile._id, {
      website: args.websiteUrl,
      websiteUrl: args.websiteUrl,
      websiteSummary: args.websiteSummary,
      websiteServices: args.websiteServices,
      websiteKeywords: args.websiteKeywords,
      websiteTone: args.websiteTone,
      lastWebsiteScanAt: args.lastWebsiteScanAt,
      websiteScanTruncated: args.websiteScanTruncated ?? false,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});

export const updatePostImageType = mutation({
  args: {
    postImageType: v.union(
      v.literal('photo'),
      v.literal('designed'),
      v.literal('premium_ad')
    ),
  },
  handler: async (ctx, { postImageType }) => {
    const owner = await getAuthenticatedOwner(ctx);
    if (!owner) throw new Error('לא מחובר למערכת');

    const all = await collectBusinessProfilesForOwner(ctx, owner);
    const profile = await migrateBusinessProfilesToOwner(ctx, owner, all);
    if (!profile) throw new Error('NO_BUSINESS_PROFILE');

    await ctx.db.patch(profile._id, {
      postImageType,
      updatedAt: Date.now(),
    });

    return profile._id;
  },
});

// ─── Image media manager — per-image atomic mutations ──────────────────────
// These mutations replace round-tripping the whole business profile every
// time the user tweaks one image. The Media Manager screen calls them
// directly. Each enforces the same single-featured invariant + metadata
// normalization that `saveBusinessProfile` does.
//
// `storageRef` is the Convex storage ID. Order of `profile.images` is
// preserved on every operation except `delete` (which removes one row).

async function loadMyProfile(
  ctx: { auth: any; db: any },
) {
  const owner = await getAuthenticatedOwner(ctx);
  if (!owner) {
    throw new Error('לא מחובר למערכת');
  }
  const all = await collectBusinessProfilesForOwner(ctx, owner);
  const profile = (await migrateBusinessProfilesToOwner(ctx, owner, all)) as any;
  if (!profile) throw new Error('NO_BUSINESS_PROFILE');
  return profile;
}

// Add one or more uploaded images to the profile. Storage refs that are
// already present are ignored so the call is idempotent.
export const addBusinessImages = mutation({
  args: {
    storageRefs: v.array(v.string()),
  },
  handler: async (ctx, { storageRefs }) => {
    const profile = await loadMyProfile(ctx);
    const existingImages = profile.images ?? [];
    const existingMetadata = profile.imageMetadata ?? [];
    const seen = new Set(existingImages);
    const additions = storageRefs.filter((ref) => ref && !seen.has(ref));
    if (additions.length === 0) return profile._id;

    const now = Date.now();
    const nextImages = [...existingImages, ...additions];
    const nextMetadata = normalizeImageMetadata(
      nextImages,
      [
        ...existingMetadata,
        ...additions.map((storageRef) => ({
          storageRef,
          createdAt: now,
          updatedAt: now,
        })),
      ],
      existingMetadata,
      now,
    );

    await ctx.db.patch(profile._id, {
      images: nextImages,
      imageMetadata: nextMetadata,
      updatedAt: now,
    });
    return profile._id;
  },
});

// Remove one image from the profile. Removes both the storage ref and the
// matching metadata row. If the deleted image was featured, no replacement
// is auto-promoted (the user picks the next featured explicitly).
export const deleteBusinessImage = mutation({
  args: { storageRef: v.string() },
  handler: async (ctx, { storageRef }) => {
    const profile = await loadMyProfile(ctx);
    const existingImages = profile.images ?? [];
    if (!existingImages.includes(storageRef)) return profile._id;

    const now = Date.now();
    const nextImages = existingImages.filter((ref: string) => ref !== storageRef);
    const nextMetadata = normalizeImageMetadata(
      nextImages,
      undefined,
      (profile.imageMetadata ?? []).filter(
        (item: BusinessImageMetadata) => item.storageRef !== storageRef,
      ),
      now,
    );

    await ctx.db.patch(profile._id, {
      images: nextImages.length ? nextImages : undefined,
      imageMetadata: nextImages.length ? nextMetadata : undefined,
      updatedAt: now,
    });
    return profile._id;
  },
});

// Swap one storage ref for another at the same position, preserving the
// metadata (label / rating / aiRecommended / featured) so a "replace image"
// action keeps the image's role in the profile.
export const replaceBusinessImage = mutation({
  args: {
    storageRef: v.string(),
    newStorageRef: v.string(),
  },
  handler: async (ctx, { storageRef, newStorageRef }) => {
    if (storageRef === newStorageRef) return null;
    const profile = await loadMyProfile(ctx);
    const existingImages = profile.images ?? [];
    const index = existingImages.indexOf(storageRef);
    if (index === -1) throw new Error('IMAGE_NOT_FOUND');

    const now = Date.now();
    const nextImages = [...existingImages];
    nextImages[index] = newStorageRef;

    const existingMetadata = (profile.imageMetadata ?? []) as BusinessImageMetadata[];
    const migrated = existingMetadata.map((item) =>
      item.storageRef === storageRef
        ? { ...item, storageRef: newStorageRef, updatedAt: now }
        : item,
    );
    const nextMetadata = normalizeImageMetadata(
      nextImages,
      migrated,
      migrated,
      now,
    );

    await ctx.db.patch(profile._id, {
      images: nextImages,
      imageMetadata: nextMetadata,
      updatedAt: now,
    });
    return profile._id;
  },
});

// Mark a single image as the featured/main image. Other images are
// automatically un-featured by `normalizeImageMetadata`'s single-featured
// invariant.
export const setFeaturedBusinessImage = mutation({
  args: {
    // null clears the featured selection (no image is marked as main).
    storageRef: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { storageRef }) => {
    const profile = await loadMyProfile(ctx);
    const existingImages = profile.images ?? [];
    if (storageRef && !existingImages.includes(storageRef)) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const now = Date.now();
    const existingMetadata = (profile.imageMetadata ?? []) as BusinessImageMetadata[];
    const patched = existingMetadata.map((item) => ({
      ...item,
      featured: storageRef ? item.storageRef === storageRef : false,
      updatedAt: item.storageRef === storageRef ? now : item.updatedAt,
    }));
    const nextMetadata = normalizeImageMetadata(
      existingImages,
      patched,
      patched,
      now,
    );

    await ctx.db.patch(profile._id, {
      imageMetadata: nextMetadata,
      updatedAt: now,
    });
    return profile._id;
  },
});

// Update one image's metadata (label / rating / AI-recommended).
// All three fields are optional — pass only what you want to change.
export const updateBusinessImageMeta = mutation({
  args: {
    storageRef: v.string(),
    label: v.optional(v.union(imageLabelValidator, v.null())),
    rating: v.optional(v.union(v.number(), v.null())),
    aiRecommended: v.optional(v.boolean()),
  },
  handler: async (ctx, { storageRef, label, rating, aiRecommended }) => {
    const profile = await loadMyProfile(ctx);
    const existingImages = profile.images ?? [];
    if (!existingImages.includes(storageRef)) {
      throw new Error('IMAGE_NOT_FOUND');
    }

    const now = Date.now();
    const existingMetadata = (profile.imageMetadata ?? []) as BusinessImageMetadata[];
    const hadEntry = existingMetadata.some((item) => item.storageRef === storageRef);
    const patched: BusinessImageMetadata[] = hadEntry
      ? existingMetadata.map((item) => {
          if (item.storageRef !== storageRef) return item;
          const next: BusinessImageMetadata = { ...item, updatedAt: now };
          if (label !== undefined) {
            next.label = label === null ? undefined : label;
          }
          if (rating !== undefined) {
            const clamped = clampRating(rating === null ? undefined : rating);
            next.rating = clamped;
          }
          if (aiRecommended !== undefined) {
            next.aiRecommended = aiRecommended;
          }
          return next;
        })
      : [
          ...existingMetadata,
          {
            storageRef,
            label: label === null ? undefined : label ?? undefined,
            rating: clampRating(rating === null ? undefined : rating),
            aiRecommended: aiRecommended ?? false,
            featured: false,
            createdAt: now,
            updatedAt: now,
          },
        ];

    const nextMetadata = normalizeImageMetadata(
      existingImages,
      patched,
      patched,
      now,
    );

    await ctx.db.patch(profile._id, {
      imageMetadata: nextMetadata,
      updatedAt: now,
    });
    return profile._id;
  },
});

export const getMyBusinessProfile = query({
  args: {},
  handler: async (ctx) => {
    const owner = await getAuthenticatedOwner(ctx);
    if (!owner) {
      return null;
    }

    const allProfiles = await collectBusinessProfilesForOwner(ctx, owner);
    const profile = pickLatest(allProfiles);

    if (!profile) return null;

    const imageMetadata = normalizeImageMetadata(
      profile.images,
      profile.imageMetadata,
      profile.imageMetadata
    );
    const prioritizedImageRefs = sortImageRefsForGeneration(
      profile.images,
      imageMetadata,
      profile.businessType
    );

    const [logoUrl, images, image] = await Promise.all([
      resolveStorageRef(ctx, profile.logoUrl),
      prioritizedImageRefs
        ? Promise.all(
            prioritizedImageRefs.map((ref) => resolveStorageRef(ctx, ref))
          ).then((arr) => arr.filter((url): url is string => Boolean(url)))
        : Promise.resolve(undefined),
      resolveStorageRef(ctx, profile.image),
    ]);

    const imageMedia = prioritizedImageRefs
      ? await Promise.all(
          prioritizedImageRefs.map(async (storageRef) => ({
            storageRef,
            url: await resolveStorageRef(ctx, storageRef),
            ...(imageMetadata?.find((item) => item.storageRef === storageRef) ??
              {}),
          }))
        ).then((items) => items.filter((item) => Boolean(item.url)))
      : undefined;

    return {
      ...profile,
      website: profile.websiteUrl ?? profile.website,
      websiteUrl: profile.websiteUrl ?? profile.website,
      logoUrl,
      logoStorageRef: profile.logoUrl,
      images,
      imageStorageRefs: prioritizedImageRefs,
      imageMetadata,
      imageMedia,
      image,
    };
  },
});
