import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const getFullUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const [businessProfile, onboardingAnswers] = await Promise.all([
      ctx.db.query('businessProfiles').withIndex('by_userId', (q) => q.eq('userId', userId)).unique(),
      ctx.db.query('onboardingAnswers').withIndex('by_userId', (q) => q.eq('userId', userId)).unique(),
    ]);

    return { businessProfile, onboardingAnswers };
  },
});

export const saveBusinessProfile = mutation({
  args: {
    businessName: v.string(),
    businessType: v.optional(v.string()),
    description: v.optional(v.string()),
    audience: v.optional(v.string()),
    style: v.optional(v.string()),
    city: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    socialInstagram: v.optional(v.string()),
    socialFacebook: v.optional(v.string()),
    goal: v.optional(v.string()),
    services: v.optional(v.string()),
    uniqueness: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('לא מחובר למערכת');
    }
    const userId = identity.subject;
    const now = Date.now();

    const existing = await ctx.db
      .query('businessProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert('businessProfiles', {
      ...args,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getMyBusinessProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query('businessProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .unique();
  },
});
