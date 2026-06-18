// Weekly AI marketing suggestions storage/query module.
// Keep this file in the default Convex runtime: queries and mutations must not
// live in a `"use node"` module.

import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { internalMutation, mutation, query } from './_generated/server';

function getCurrentWeekStart(now: number = Date.now()): number {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - dayOfWeek);
  return date.getTime();
}

export const persistBatch = internalMutation({
  args: {
    userId: v.string(),
    weekStartAt: v.number(),
    kind: v.union(
      v.literal('weekly'),
      v.literal('holiday'),
      v.literal('trend'),
      v.literal('seasonal'),
      v.literal('reminder'),
      v.literal('campaign'),
    ),
    suggestions: v.array(
      v.object({
        title: v.string(),
        description: v.string(),
        posterType: v.string(),
        visualStyle: v.string(),
        suggestedGoal: v.string(),
      }),
    ),
  },
  handler: async (ctx, { userId, weekStartAt, kind, suggestions }) => {
    const existing = await ctx.db
      .query('aiSuggestions')
      .withIndex('by_userId_and_weekStart', (q) =>
        q.eq('userId', userId).eq('weekStartAt', weekStartAt),
      )
      .collect();

    for (const row of existing) {
      if ((row.kind ?? 'weekly') === kind) {
        await ctx.db.delete(row._id);
      }
    }

    const now = Date.now();
    const insertedIds: Id<'aiSuggestions'>[] = [];
    for (const suggestion of suggestions) {
      const id = await ctx.db.insert('aiSuggestions', {
        userId,
        weekStartAt,
        kind,
        title: suggestion.title,
        description: suggestion.description,
        posterType: suggestion.posterType,
        visualStyle: suggestion.visualStyle,
        suggestedGoal: suggestion.suggestedGoal,
        used: false,
        createdAt: now,
      });
      insertedIds.push(id);
    }

    return insertedIds;
  },
});

export const getMyCurrentWeekSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const weekStartAt = getCurrentWeekStart();
    const profileRows = await ctx.db
      .query('businessProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', identity.subject))
      .collect();
    const latestProfile = profileRows.reduce<
      (typeof profileRows)[number] | null
    >(
      (best, row) =>
        !best || (row.updatedAt ?? 0) > (best.updatedAt ?? 0) ? row : best,
      null
    );

    const rows = await ctx.db
      .query('aiSuggestions')
      .withIndex('by_userId_and_weekStart', (q) =>
        q.eq('userId', identity.subject).eq('weekStartAt', weekStartAt),
      )
      .collect();

    const weeklyRows = rows
      .filter((row) => (row.kind ?? 'weekly') === 'weekly')
      .sort((a, b) => a.createdAt - b.createdAt);

    const latestSuggestionCreatedAt =
      weeklyRows.length > 0
        ? Math.max(...weeklyRows.map((row) => row.createdAt))
        : null;
    const profileUpdatedAt = latestProfile?.updatedAt ?? null;
    const staleBecauseProfileChanged =
      Boolean(profileUpdatedAt && latestSuggestionCreatedAt) &&
      latestSuggestionCreatedAt! < profileUpdatedAt!;

    if (staleBecauseProfileChanged) {
      return [];
    }

    return weeklyRows;
  },
});

export const markSuggestionUsed = mutation({
  args: {
    suggestionId: v.id('aiSuggestions'),
    postId: v.optional(v.id('posts')),
  },
  handler: async (ctx, { suggestionId, postId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר למערכת');

    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) throw new Error('SUGGESTION_NOT_FOUND');
    if (suggestion.userId !== identity.subject) {
      throw new Error('SUGGESTION_FORBIDDEN');
    }

    await ctx.db.patch(suggestionId, {
      used: true,
      usedAt: Date.now(),
      ...(postId ? { postId } : {}),
    });
  },
});
