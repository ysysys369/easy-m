import { v } from 'convex/values';
import { mutation } from './_generated/server';

export const saveOnboardingAnswers = mutation({
  args: {
    businessType:    v.optional(v.string()),
    experienceLevel: v.optional(v.string()),
    goal:            v.optional(v.string()),
    tone:            v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('לא מחובר למערכת');
    }
    const userId = identity.subject;
    const now = Date.now();

    const existing = await ctx.db
      .query('onboardingAnswers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert('onboardingAnswers', {
      ...args,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});
