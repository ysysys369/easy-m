import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';

const POST_RETENTION_DAYS = 30;
const POST_RETENTION_MS = POST_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function isPostWithinRetention(createdAt: number, now = Date.now()): boolean {
  return now - createdAt <= POST_RETENTION_MS;
}

export const deletePost = mutation({
  args: { id: v.id('posts') },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר למערכת');
    const post = await ctx.db.get(id);
    if (!post || post.userId !== identity.subject) throw new Error('אין הרשאה');
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר למערכת');

    const resolvedCaptionText = captionText ?? content;
    if (!resolvedCaptionText?.trim()) throw new Error('חסר טקסט לפוסט');

    return await ctx.db.insert('posts', {
      userId:    identity.subject,
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
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(cap * 2);

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const cap = Math.max(1, Math.min(50, limit ?? 8));
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .take(cap * 2);

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const posts = await ctx.db
      .query('posts')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .collect();

    return posts
      .filter((post) => isPostWithinRetention(post.createdAt))
      .map((post) => ({
        ...post,
        captionText: post.captionText ?? post.content,
        retentionExpiresAt: post.createdAt + POST_RETENTION_MS,
      }));
  },
});
