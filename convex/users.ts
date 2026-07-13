import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ─── Post limit config ───────────────────────────────────────────────────────
export const WEEKLY_POST_LIMIT = 3;  // paid users: 3 per rolling 7-day window
export const FREE_POST_LIMIT = 1;    // free users: 1 lifetime gift post
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function assertDevQuotaResetAllowed(): void {
  const isDevelopmentRuntime = process.env.EASY_M_RUNTIME_ENV === 'development';

  if (!isDevelopmentRuntime) {
    throw new Error('DEV_ONLY_QUOTA_RESET_DISABLED');
  }
}

/**
 * Compute the effective weekly counter for a user.
 * If the rolling 7-day window has passed since lastResetDate, the counter
 * is considered reset to 0 (the actual DB write happens in the mutation).
 */
function effectiveWeeklyUsed(user: { postsUsedThisWeek?: number; lastResetDate?: number } | null, now: number) {
  if (!user) return { used: 0, resetAt: now + WEEK_MS };
  const lastReset = user.lastResetDate ?? 0;
  const expired = now - lastReset >= WEEK_MS;
  if (expired) return { used: 0, resetAt: now + WEEK_MS };
  return {
    used: user.postsUsedThisWeek ?? 0,
    resetAt: lastReset + WEEK_MS,
  };
}

// ─── Push notifications & app activity ──────────────────────────────────────

async function getOrCreateUserByIdentity(
  ctx: { db: any; auth: any },
): Promise<{ _id: any }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('לא מחובר');
  const email = identity.email ?? '';
  const now = Date.now();
  const existing = await ctx.db
    .query('users')
    .withIndex('by_email', (q: any) => q.eq('email', email))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert('users', {
    email,
    emailVerified: identity.emailVerified ?? false,
    fullName: identity.name ?? 'User',
    role: 'user',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  return { _id: id };
}

/** Save the user's Expo push token and notification preference */
export const savePushToken = mutation({
  args: {
    token: v.string(),
    notificationsEnabled: v.boolean(),
  },
  handler: async (ctx, { token, notificationsEnabled }) => {
    const user = await getOrCreateUserByIdentity(ctx);
    await ctx.db.patch(user._id, {
      expoPushToken: token,
      notificationsEnabled,
      updatedAt: Date.now(),
    });
  },
});

/** Disable notifications (when permission is revoked or user opts out) */
export const setNotificationsEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const user = await getOrCreateUserByIdentity(ctx);
    await ctx.db.patch(user._id, {
      notificationsEnabled: enabled,
      updatedAt: Date.now(),
    });
  },
});

/** Record that the user just opened the app — used by inactivity push cron */
export const markAppOpened = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email ?? ''))
      .unique();
    if (!user) return;
    await ctx.db.patch(user._id, {
      lastAppOpen: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Lifetime counter — kept for analytics / first-post celebration
export const getPostsGenerated = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email ?? ''))
      .unique();
    return user?.postsGenerated ?? 0;
  },
});

/**
 * Post status — returns the effective remaining count.
 * Paid users: 3 posts per rolling 7-day window.
 * Free users: 1 lifetime gift post (based on postsGenerated, not weekly).
 * Read-only: applies the rolling-week logic without writing.
 */
export const getWeeklyPostStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { used: 0, remaining: WEEKLY_POST_LIMIT, limit: WEEKLY_POST_LIMIT, resetAt: Date.now() + WEEK_MS };
    }
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email ?? ''))
      .unique();

    const isPaid = user?.userType === 'paid';

    if (isPaid) {
      // Paid: rolling 7-day window of 3 posts
      const { used, resetAt } = effectiveWeeklyUsed(user, Date.now());
      return {
        used,
        remaining: Math.max(0, WEEKLY_POST_LIMIT - used),
        limit: WEEKLY_POST_LIMIT,
        resetAt,
      };
    } else {
      // Free: 1 lifetime gift post
      const lifetimeUsed = user?.postsGenerated ?? 0;
      return {
        used: lifetimeUsed,
        remaining: Math.max(0, FREE_POST_LIMIT - lifetimeUsed),
        limit: FREE_POST_LIMIT,
        resetAt: 0,
      };
    }
  },
});

/**
 * Sync subscription status from RevenueCat (client-side) to the DB.
 * Called from the app layout whenever isPremium state resolves.
 */
export const syncSubscriptionStatus = mutation({
  args: { isPremium: v.boolean() },
  handler: async (ctx, { isPremium }) => {
    const identity = await ctx.auth.getUserIdentity();
    // Diagnostic log for TestFlight logout/login data-persistence issue.
    // Safe: identity.subject is a users row _id; identity.email is not a
    // secret. No tokens or passwords are logged. `isPremium` is a boolean.
    if (!identity) {
      console.info('[users.syncSubscriptionStatus] no identity — skipped', {
        subject: null,
        email: null,
        isPremium,
      });
      return;
    }
    const email = identity.email ?? '';
    const now = Date.now();
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();
    const newUserType = isPremium ? 'paid' : 'free';
    if (user) {
      const changed = user.userType !== newUserType;
      // Free gift post must not consume the premium weekly quota. When a free
      // user upgrades, reset the weekly counter so the paid quota starts fresh.
      const upgradedToPaid = changed && newUserType === 'paid';
      console.info('[users.syncSubscriptionStatus] existing user found', {
        subject: identity.subject,
        email: email || null,
        userRowId: user._id,
        subjectMatchesUserRowId: identity.subject === user._id,
        previousUserType: user.userType ?? null,
        newUserType,
        typeChanged: changed,
        upgradedToPaid,
        isPremium,
      });
      if (changed) {
        await ctx.db.patch(user._id, {
          userType: newUserType,
          updatedAt: now,
          ...(upgradedToPaid && {
            postsUsedThisWeek: 0,
            lastResetDate: now,
          }),
        });
      }
    } else {
      const insertedId = await ctx.db.insert('users', {
        email,
        emailVerified: identity.emailVerified ?? false,
        fullName: identity.name ?? 'User',
        role: 'user',
        userType: newUserType,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      console.info('[users.syncSubscriptionStatus] no user for email — inserted new row', {
        subject: identity.subject,
        email: email || null,
        insertedUserRowId: insertedId,
        subjectMatchesInsertedRowId: identity.subject === insertedId,
        newUserType,
        isPremium,
      });
    }
  },
});

/**
 * Increment both the lifetime counter and the weekly counter.
 * Handles rolling 7-day reset atomically — if the week expired,
 * resets to 0 and starts a new window before counting this generation.
 */
export const incrementPostsGenerated = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר');
    const email = identity.email ?? '';
    const now = Date.now();

    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();

    if (user) {
      const { used } = effectiveWeeklyUsed(user, now);
      const expired = (now - (user.lastResetDate ?? 0)) >= WEEK_MS;
      await ctx.db.patch(user._id, {
        postsGenerated: (user.postsGenerated ?? 0) + 1,
        postsUsedThisWeek: used + 1,
        // start a new rolling window when the previous one expired
        lastResetDate: expired ? now : (user.lastResetDate ?? now),
        updatedAt: now,
      });
    } else {
      // User authenticated but not yet in custom users table — create them
      await ctx.db.insert('users', {
        email,
        emailVerified: identity.emailVerified ?? false,
        fullName: identity.name ?? 'User',
        role: 'user',
        isActive: true,
        postsGenerated: 1,
        postsUsedThisWeek: 1,
        lastResetDate: now,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

async function resetCurrentUserPostQuotaForDev(ctx: { db: any; auth: any }) {
  assertDevQuotaResetAllowed();
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('לא מחובר');
  const user = await ctx.db
    .query('users')
    .withIndex('by_email', (q: any) => q.eq('email', identity.email ?? ''))
    .unique();
  if (!user) return { reset: false };
  const now = Date.now();
  await ctx.db.patch(user._id, {
    postsGenerated: 0,
    postsUsedThisWeek: 0,
    lastResetDate: now,
    updatedAt: now,
  });
  return { reset: true };
}

/**
 * Dev/test helper — resets BOTH lifetime + weekly counters so the current user
 * can keep testing generation flows. Disabled unless the Convex deployment is
 * explicitly configured as development.
 */
export const resetMyPostQuotaForDev = mutation({
  args: {},
  handler: async (ctx) => {
    return await resetCurrentUserPostQuotaForDev(ctx);
  },
});

// שליפת המשתמש הנוכחי המחובר
// מחזיר null אם המשתמש לא מחובר
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // חיפוש המשתמש ב-Database לפי כתובת האימייל מה-Identity
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email ?? ''))
      .unique();

    return user;
  },
});

// שליפת משתמש לפי מזהה (ID)
export const getById = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

// שליפת רשימת כל המשתמשים הפעילים
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('isActive'), true))
      .collect();
  },
});

// יצירה או עדכון של משתמש (נקרא בדרך כלל מתהליך האימות)
export const createOrUpdateUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const email = identity.email ?? '';
    const now = Date.now();

    // בדיקה אם המשתמש כבר קיים
    const existing = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', email))
      .unique();

    const userData = {
      email,
      emailVerified: identity.emailVerified ?? false,
      fullName: identity.name || identity.nickname || 'User',
      role: 'user' as const,
      userType: 'free' as const, // ברירת מחדל - משתמש חינמי
      isActive: true,
      updatedAt: now,
    };

    // עדכון משתמש קיים
    if (existing) {
      await ctx.db.patch(existing._id, userData);
      return existing._id;
    }

    // יצירת משתמש חדש
    return await ctx.db.insert('users', {
      ...userData,
      createdAt: now,
    });
  },
});

// עדכון פרופיל המשתמש (למשל, שינוי שם)
export const updateProfile = mutation({
  args: {
    userId: v.id('users'),
    fullName: v.optional(v.string()),
  },
  handler: async (ctx, { userId, fullName }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    await ctx.db.patch(userId, {
      fullName,
      updatedAt: Date.now(),
    });

    return userId;
  },
});

// עדכון סוג המשתמש (חינמי/בתשלום)
export const updateUserType = mutation({
  args: {
    userType: v.union(v.literal('free'), v.literal('paid')),
  },
  handler: async (ctx, { userType }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('לא מחובר למערכת');
    }

    // חיפוש המשתמש לפי אימייל
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email ?? ''))
      .unique();

    if (!user) {
      throw new Error('משתמש לא נמצא');
    }

    await ctx.db.patch(user._id, {
      userType,
      updatedAt: Date.now(),
    });

    return user._id;
  },
});

// מחיקת משתמש (פעולה למנהלים או למשתמש עצמו - כאן מיושם כמחיקה פיזית)
export const remove = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    await ctx.db.delete(userId);
  },
});

// מחיקת חשבון המשתמש הנוכחי וכל הנתונים המשויכים אליו
// ⚠️ אזהרה: פעולה זו בלתי הפיכה ותמחק את כל הנתונים לצמיתות!
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר למערכת');

    const userId = identity.subject;
    const email = identity.email ?? '';

    // Delete posts
    const posts = await ctx.db
      .query('posts')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    for (const doc of posts) await ctx.db.delete(doc._id);

    // Delete onboarding answers
    const onboarding = await ctx.db
      .query('onboardingAnswers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    for (const doc of onboarding) await ctx.db.delete(doc._id);

    // Delete business profiles
    const profiles = await ctx.db
      .query('businessProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    for (const doc of profiles) await ctx.db.delete(doc._id);

    // Delete AI suggestions
    const suggestions = await ctx.db
      .query('aiSuggestions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    for (const doc of suggestions) await ctx.db.delete(doc._id);

    // Delete generation cost records
    const costs = await ctx.db
      .query('generationCosts')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect();
    for (const doc of costs) await ctx.db.delete(doc._id);

    // Delete user record (looked up by email, not by identity.subject)
    if (email) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_email', (q) => q.eq('email', email))
        .unique();
      if (user) await ctx.db.delete(user._id);
    }
  },
});
