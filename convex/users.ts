import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// ─── Weekly post limit config ───────────────────────────────────────────────
export const WEEKLY_POST_LIMIT = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
 * Weekly post status — returns the effective remaining count.
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
    const { used, resetAt } = effectiveWeeklyUsed(user, Date.now());
    return {
      used,
      remaining: Math.max(0, WEEKLY_POST_LIMIT - used),
      limit: WEEKLY_POST_LIMIT,
      resetAt,
    };
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

/**
 * Dev/test helper — resets BOTH lifetime + weekly counters so the user
 * can keep testing generation flows.
 */
export const resetPostsGenerated = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('לא מחובר');
    const user = await ctx.db
      .query('users')
      .withIndex('by_email', (q) => q.eq('email', identity.email ?? ''))
      .unique();
    if (!user) return;
    await ctx.db.patch(user._id, {
      postsGenerated: 0,
      postsUsedThisWeek: 0,
      lastResetDate: Date.now(),
      updatedAt: Date.now(),
    });
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
    if (!identity) {
      throw new Error('לא מחובר למערכת');
    }

    // קבלת מזהה המשתמש מה-identity
    const userId = identity.subject;
    let deletedCount = 0;

    // כאן תוכל להוסיף מחיקה של טבלאות נוספות שקשורות למשתמש
    // לדוגמה:
    // const userPosts = await ctx.db
    //   .query('posts')
    //   .withIndex('by_user', (q) => q.eq('userId', userId))
    //   .collect();
    // for (const post of userPosts) {
    //   await ctx.db.delete(post._id);
    //   deletedCount += 1;
    // }

    // מחיקת המשתמש מטבלת המשתמשים
    // הערה: Convex Auth מנהל את טבלת המשתמשים, אך אנחנו יכולים למחוק את הרשומה
    const user = await ctx.db
      .query('users')
      .filter((q) => q.eq(q.field('_id'), userId))
      .first();

    if (user) {
      await ctx.db.delete(user._id);
      deletedCount += 1;
    }

    return {
      success: true,
      message: `נמחקו ${deletedCount} רשומות עבור משתמש ${userId}`,
      deletedCount,
    };
  },
});
