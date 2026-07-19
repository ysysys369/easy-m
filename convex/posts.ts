import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';

const POST_RETENTION_DAYS = 30;
const POST_RETENTION_MS = POST_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function isPostWithinRetention(createdAt: number, now = Date.now()): boolean {
  return now - createdAt <= POST_RETENTION_MS;
}

type Owner = {
  userId: string;
  legacySubject: string;
};

async function getOwner(ctx: { auth: any }): Promise<Owner | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || typeof identity !== 'object' || !('subject' in identity)) {
    return null;
  }
  const authUserId = await getAuthUserId(ctx);
  if (!authUserId) return null;
  return {
    userId: String(authUserId),
    legacySubject: (identity as { subject: string }).subject,
  };
}

function ownerMatches(userId: string, owner: Owner): boolean {
  return (
    userId === owner.userId ||
    userId === owner.legacySubject ||
    userId.startsWith(`${owner.userId}|`)
  );
}

async function collectPostsForOwner(ctx: { db: any }, owner: Owner) {
  const byId = new Map<string, any>();
  const addRows = (rows: any[]) => {
    for (const row of rows) byId.set(row._id, row);
  };

  addRows(
    await ctx.db
      .query('posts')
      .withIndex('by_userId', (q: any) => q.eq('userId', owner.userId))
      .order('desc')
      .collect(),
  );

  if (owner.legacySubject !== owner.userId) {
    addRows(
      await ctx.db
        .query('posts')
        .withIndex('by_userId', (q: any) => q.eq('userId', owner.legacySubject))
        .order('desc')
        .collect(),
    );
  }

  if (byId.size === 0) {
    const legacyRows = (await ctx.db.query('posts').collect()).filter((post: { userId: string }) =>
      ownerMatches(post.userId, owner),
    );
    addRows(legacyRows);
  }

  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export const deletePost = mutation({
  args: { id: v.id('posts') },
  handler: async (ctx, { id }) => {
    const owner = await getOwner(ctx);
    if (!owner) throw new Error('לא מחובר למערכת');
    const post = await ctx.db.get(id);
    if (!post || !ownerMatches(post.userId, owner)) throw new Error('אין הרשאה');
    await ctx.db.delete(id);
  },
});

export const createPost = mutation({
  args: {
    content:        v.optional(v.string()),
    captionText:    v.optional(v.string()),
    imageUri:       v.optional(v.string()),
    businessName:   v.optional(v.string()),
    businessType:   v.optional(v.string()),
    generationMode: v.optional(v.union(v.literal('auto'), v.literal('manual'))),
  },
  handler: async (ctx, { content, captionText, imageUri, businessName, businessType, generationMode }) => {
    const owner = await getOwner(ctx);
    if (!owner) throw new Error('לא מחובר למערכת');

    const resolvedCaptionText = captionText ?? content;
    if (!resolvedCaptionText?.trim()) throw new Error('חסר טקסט לפוסט');

    return await ctx.db.insert('posts', {
      userId:    owner.userId,
      content:   resolvedCaptionText,
      captionText: resolvedCaptionText,
      imageUri,
      businessName,
      businessType,
      generationMode,
      status:    'draft',
      createdAt: Date.now(),
    });
  },
});

export const createPostForUser = internalMutation({
  args: {
    userId: v.string(),
    content: v.optional(v.string()),
    captionText: v.optional(v.string()),
    imageUri: v.optional(v.string()),
    businessName: v.optional(v.string()),
    businessType: v.optional(v.string()),
    generationMode: v.optional(v.union(v.literal('auto'), v.literal('manual'))),
  },
  handler: async (
    ctx,
    { userId, content, captionText, imageUri, businessName, businessType, generationMode },
  ) => {
    const resolvedCaptionText = captionText ?? content;
    if (!resolvedCaptionText?.trim()) throw new Error('חסר טקסט לפוסט');

    return await ctx.db.insert('posts', {
      userId,
      content: resolvedCaptionText,
      captionText: resolvedCaptionText,
      imageUri,
      businessName,
      businessType,
      generationMode,
      status: 'draft',
      createdAt: Date.now(),
    });
  },
});

export const listRecentPostsForUser = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit }) => {
    const cap = Math.max(1, Math.min(50, limit ?? 8));
    const ownerPrefix = userId.split('|')[0] ?? userId;
    const posts = (await ctx.db.query('posts').collect())
      .filter(
        (post: { userId: string }) =>
          post.userId === userId ||
          post.userId === ownerPrefix ||
          post.userId.startsWith(`${ownerPrefix}|`),
      )
      .sort((a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt)
      .slice(0, cap * 2);

    return posts
      .filter((post) => isPostWithinRetention(post.createdAt))
      .slice(0, cap)
      .map((post) => ({
        _id: post._id,
        content: post.content,
        captionText: post.captionText ?? post.content,
        createdAt: post.createdAt,
      }));
  },
});

// Recent posts for the current user. Used by weekly AI suggestion generation
// so the model can avoid repeating recent ideas.
export const listMyRecentPosts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const owner = await getOwner(ctx);
    if (!owner) return [];

    const cap = Math.max(1, Math.min(50, limit ?? 8));
    const posts = (await collectPostsForOwner(ctx, owner)).slice(0, cap * 2);

    return posts
      .filter((post) => isPostWithinRetention(post.createdAt))
      .slice(0, cap)
      .map((post) => ({
        _id: post._id,
        content: post.content,
        captionText: post.captionText ?? post.content,
        createdAt: post.createdAt,
      }));
  },
});

export const getUserPosts = query({
  args: {},
  handler: async (ctx) => {
    const owner = await getOwner(ctx);
    if (!owner) return [];

    const posts = await collectPostsForOwner(ctx, owner);

    return posts
      .filter((post) => isPostWithinRetention(post.createdAt))
      .map((post) => ({
        ...post,
        captionText: post.captionText ?? post.content,
        retentionExpiresAt: post.createdAt + POST_RETENTION_MS,
      }));
  },
});
