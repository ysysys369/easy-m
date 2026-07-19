import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
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

function normalizeEmail(email: string | undefined | null): string {
  return (email ?? '').trim().toLowerCase();
}

async function findUserByEmail(ctx: { db: any }, email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const exactRows = await ctx.db
    .query('users')
    .withIndex('by_email', (q: any) => q.eq('email', normalizedEmail))
    .collect();
  const rows =
    exactRows.length > 0
      ? exactRows
      : (await ctx.db.query('users').collect()).filter(
          (user: any) => normalizeEmail(user.email) === normalizedEmail,
        );
  if (rows.length === 0) return null;
  return rows.reduce((best: any, row: any) =>
    (row.updatedAt ?? row.createdAt ?? 0) > (best.updatedAt ?? best.createdAt ?? 0)
      ? row
      : best,
  );
}

async function resolveCurrentUserForGeneration(ctx: { db: any; auth: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return { identity: null, user: null, email: '' };
  }

  const authUserId = await getAuthUserId(ctx);
  const authUser: Doc<'users'> | null = authUserId
    ? await ctx.db.get(authUserId)
    : null;
  const identityEmail = normalizeEmail(identity.email);
  const emailUser = identityEmail
    ? await findUserByEmail(ctx, identityEmail)
    : null;
  const user = emailUser ?? authUser;
  const email = normalizeEmail(user?.email) || identityEmail;

  return { identity, user, email };
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

async function collectBusinessProfilesForGeneration(
  ctx: { db: any },
  stableUserId: string | null,
  legacySubject: string,
): Promise<Doc<'businessProfiles'>[]> {
  const byId = new Map<string, Doc<'businessProfiles'>>();
  const addRows = (rows: Doc<'businessProfiles'>[]) => {
    for (const row of rows) byId.set(row._id, row);
  };

  if (stableUserId) {
    addRows(
      await ctx.db
        .query('businessProfiles')
        .withIndex('by_userId', (q: any) => q.eq('userId', stableUserId))
        .collect(),
    );
  }

  addRows(
    await ctx.db
      .query('businessProfiles')
      .withIndex('by_userId', (q: any) => q.eq('userId', legacySubject))
      .collect(),
  );

  if (byId.size === 0 && stableUserId) {
    addRows(
      (await ctx.db.query('businessProfiles').collect()).filter(
        (row: Doc<'businessProfiles'>) =>
          row.userId === stableUserId ||
          row.userId === legacySubject ||
          row.userId.startsWith(`${stableUserId}|`),
      ),
    );
  }

  return [...byId.values()];
}

export const createGenerationJob = mutation({
  args: {
    topic: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, { topic, idempotencyKey }) => {
    const { identity, user: resolvedUser, email: resolvedEmail } =
      await resolveCurrentUserForGeneration(ctx);
    if (!identity) throw new Error('לא מחובר');

    const userId = identity.subject;
    const userEmail = resolvedEmail;
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

    let user = resolvedUser ?? (await findUserByEmail(ctx, userEmail));
    if (!user) {
      if (!userEmail) {
        throw new Error('AUTH_USER_NOT_RESOLVED');
      }
      const userRowId = await ctx.db.insert('users', {
        email: userEmail,
        emailVerified: identity.emailVerified ?? false,
        fullName: identity.name ?? 'User',
        role: 'user',
        userType: 'free',
        isActive: true,
        postsGenerated: 0,
        postsUsedThisWeek: 0,
        createdAt: now,
        updatedAt: now,
      });
      user = await ctx.db.get(userRowId);
    }
    if (!userEmail) {
      throw new Error('AUTH_USER_NOT_RESOLVED');
    }
    if (!hasQuota(user, now)) {
      throw new Error('WEEKLY_LIMIT_REACHED');
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

    const stableUserId = user?._id ? String(user._id) : null;
    const profiles = await collectBusinessProfilesForGeneration(
      ctx,
      stableUserId,
      userId,
    );
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
    if (job.startedAt) return null;
    const now = Date.now();
    await ctx.db.patch(jobId, {
      startedAt: now,
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
