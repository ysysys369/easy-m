import { v } from 'convex/values';
import { internalMutation, internalQuery } from './_generated/server';

export const saveGenerationCost = internalMutation({
  args: {
    userId: v.string(),
    estimatedTotalUsd: v.number(),
    estimatedTextUsd: v.number(),
    estimatedImageUsd: v.number(),
    textInputTokens: v.number(),
    textOutputTokens: v.number(),
    textModels: v.string(),
    imageModels: v.string(),
    qualityBoostEnabled: v.boolean(),
    postImageType: v.string(),
    totalGenerationMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert('generationCosts', { ...args, createdAt: Date.now() });
  },
});

export const getRecentGenerationCosts = internalQuery({
  args: { userId: v.string(), limit: v.number() },
  handler: async (ctx, { userId, limit }) => {
    return ctx.db
      .query('generationCosts')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .take(limit);
  },
});
