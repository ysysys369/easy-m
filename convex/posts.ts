import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

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

    return posts.map((post) => ({
      ...post,
      captionText: post.captionText ?? post.content,
    }));
  },
});
