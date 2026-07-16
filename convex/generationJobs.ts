import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';

const WEEKLY_POST_LIMIT = 3;
const FREE_POST_LIMIT = 1;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_JOB_WINDOW_MS = 30 * 60 * 1000;

function effectiveWeeklyUsed(
  user: { postsUsedThisWeek?: number; lastResetDate?: number } | null,
  now: number,
) {
  if (!user) return { used: 0, resetAt: now + WEEK_MS };
  const lastReset = user.lastResetDate ?? 0;
  const expired = now - lastReset >= WEEK_MS;
  if (expired) return { used: 0, resetAt: now + WEEK_MS };
  return {
    used: user.postsUsedThisWeek ?? 0,
    resetAt: lastReset + WEEK_MS,
  };
}

function hasQuota(user: Doc<'users'> | null, now: number): boolean {
  const isPaid = user?.userType === 'paid';
  if (isPaid) {
    const { used } = effectiveWeeklyUsed(user, now);
    return WEEKLY_POST_LIMIT - used > 0;
  }
  return FREE_POST_LIMIT - (user?.postsGenerated ?? 0) > 0;
}

function publicJob(job: Doc<'generationJobs'>) {
  return {
    _id: job._id,
    status: job.status,
    topic: job.topic,
    postId: job.postId,
    imageUri: job.imageUri,
    captionText: job.captionText,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
  };
}

export const createGenerationJob = mutation({
  args: {
    topic: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, { topic, idempotencyKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר');

    const userId = identity.subject;
    const userEmail = identity.email ?? '';
    const now = Date.now();
    const normalizedTopic = topic.trim();

    const existingByKey = await ctx.db
      .query('generationJobs')
      .withIndex('by_userId_idempotencyKey', (q) =>
        q.eq('userId', userId).eq('idempotencyKey', idempotencyKey),
      )
      .unique();
    if (existingByKey) return publicJob(existingByKey);

    const activeJob = await ctx.db
      .query('generationJobs')
      .withIndex('by_userId_status', (q) =>
        q.eq('userId', userId).eq('status', 'processing'),
      )
      .order('desc')
      .first();
    if (activeJob && now - activeJob.createdAt < ACTIVE_JOB_WINDOW_MS) {
      return publicJob(activeJob);
    }

    const latestJob = await ctx.db
      .query('generationJobs')
      .withIndex('by_userId_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .first();
    if (
      latestJob &&
      latestJob.status === 'completed' &&
      latestJob.topic === normalizedTopic &&
      now - latestJob.createdAt < ACTIVE_JOB_WINDOW_MS
    ) {
      return publicJob(latestJob);
    }

    const user = await ctx.db.get(userId as Id<'users'>);
    if (!hasQuota(user, now)) {
      throw new Error('WEEKLY_LIMIT_REACHED');
    }

    const profiles = await ctx.db
      .query('businessProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    const profile = profiles.reduce<Doc<'businessProfiles'> | null>(
      (best, candidate) =>
        !best || (candidate.updatedAt ?? 0) > (best.updatedAt ?? 0)
          ? candidate
          : best,
      null,
    );
    if (!profile?.businessName) {
      throw new Error('NO_BUSINESS_PROFILE');
    }

    const jobId = await ctx.db.insert('generationJobs', {
      userId,
      userEmail: userEmail || undefined,
      topic: normalizedTopic,
      idempotencyKey,
      status: 'processing',
      businessProfileSnapshot: profile,
      postImageType: profile.postImageType ?? 'premium_ad',
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.generatePost.processGenerationJob, {
      jobId,
    });

    const job = await ctx.db.get(jobId);
    if (!job) throw new Error('GENERATION_JOB_NOT_FOUND');
    return publicJob(job);
  },
});

export const getGenerationJob = query({
  args: { jobId: v.id('generationJobs') },
  handler: async (ctx, { jobId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const job = await ctx.db.get(jobId);
    if (!job || job.userId !== identity.subject) return null;
    return publicJob(job);
  },
});

export const getMyLatestGenerationJob = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const job = await ctx.db
      .query('generationJobs')
      .withIndex('by_userId_createdAt', (q) => q.eq('userId', identity.subject))
      .order('desc')
      .first();
    if (!job || Date.now() - job.createdAt > ACTIVE_JOB_WINDOW_MS) return null;
    return publicJob(job);
  },
});

export const getGenerationJobForProcessing = internalQuery({
  args: { jobId: v.id('generationJobs') },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

export const markGenerationJobStarted = internalMutation({
  args: { jobId: v.id('generationJobs') },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== 'processing') return null;
    const now = Date.now();
    await ctx.db.patch(jobId, {
      startedAt: job.startedAt ?? now,
      updatedAt: now,
    });
    return jobId;
  },
});

export const completeGenerationJob = internalMutation({
  args: {
    jobId: v.id('generationJobs'),
    postId: v.id('posts'),
    imageUri: v.string(),
    captionText: v.string(),
  },
  handler: async (ctx, { jobId, postId, imageUri, captionText }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status === 'completed') return null;
    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: 'completed',
      postId,
      imageUri,
      captionText,
      completedAt: now,
      updatedAt: now,
    });
    return jobId;
  },
});

export const failGenerationJob = internalMutation({
  args: {
    jobId: v.id('generationJobs'),
    errorMessage: v.string(),
  },
  handler: async (ctx, { jobId, errorMessage }) => {
    const job = await ctx.db.get(jobId);
    if (!job || job.status === 'completed') return null;
    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: 'failed',
      errorMessage,
      failedAt: now,
      updatedAt: now,
    });
    return jobId;
  },
});
