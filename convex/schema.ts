import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

// הגדרת הסכמה (Schema) של מסד הנתונים
// קובץ זה מגדיר את מבנה הטבלאות והקשרים ב-Database
export default defineSchema({
  // יבוא טבלאות ברירת מחדל של ספריית האימות (users, sessions, etc.)
  ...authTables,

  // טבלת משתמשים מורחבת
  // מכילה מידע נוסף על המשתמשים מעבר לבסיס של ספריית האימות
  posts: defineTable({
    userId: v.string(),
    content: v.string(),
    captionText: v.optional(v.string()),
    imageUri: v.optional(v.string()),
    businessName: v.optional(v.string()),
    businessType: v.optional(v.string()),
    generationMode: v.optional(v.union(v.literal('auto'), v.literal('manual'))),
    status: v.union(
      v.literal('draft'),
      v.literal('scheduled'),
      v.literal('published')
    ),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),

  onboardingAnswers: defineTable({
    userId: v.string(),
    businessType: v.optional(v.string()),
    experienceLevel: v.optional(v.string()),
    goal: v.optional(v.string()),
    tone: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  businessProfiles: defineTable({
    userId: v.string(),
    businessName: v.string(),
    businessType: v.optional(v.string()),
    description: v.optional(v.string()),
    audience: v.optional(v.string()),
    style: v.optional(v.string()),
    city: v.optional(v.string()),
    website: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    websiteSummary: v.optional(v.string()),
    websiteServices: v.optional(v.array(v.string())),
    websiteKeywords: v.optional(v.array(v.string())),
    websiteTone: v.optional(v.string()),
    lastWebsiteScanAt: v.optional(v.number()),
    websiteScanTruncated: v.optional(v.boolean()),
    phone: v.optional(v.string()),
    socialInstagram: v.optional(v.string()),
    socialFacebook: v.optional(v.string()),
    goal: v.optional(v.string()),
    services: v.optional(v.string()),
    uniqueness: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    imageMetadata: v.optional(
      v.array(
        v.object({
          storageRef: v.string(),
          label: v.optional(
            v.union(
              v.literal('logo'),
              v.literal('product'),
              v.literal('mood'),
              v.literal('team'),
              v.literal('place'),
              v.literal('food'),
              v.literal('workout'),
              v.literal('before_after')
            )
          ),
          rating: v.optional(v.number()),
          aiRecommended: v.optional(v.boolean()),
          featured: v.optional(v.boolean()),
          createdAt: v.optional(v.number()),
          updatedAt: v.optional(v.number()),
        })
      )
    ),
    image: v.optional(v.string()),
    // Visual style for generated post images:
    //   'photo'      → plain marketing photo, no text overlay (legacy behavior)
    //   'designed'   → photo with a tasteful Hebrew text overlay
    //   'premium_ad' → full social-media ad poster with strong Hebrew typography
    postImageType: v.optional(
      v.union(
        v.literal('photo'),
        v.literal('designed'),
        v.literal('premium_ad')
      )
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

  // ─── Weekly AI marketing suggestions ──────────────────────────────────────
  // One row per individual suggestion. Suggestions are grouped into a batch
  // per ISO week (`weekStartAt`). `kind` is intentionally a union so future
  // kinds — holidays, trends, seasonal campaigns, smart reminders, marketing
  // calendar items, AI campaign planning — can be added without a migration.
  aiSuggestions: defineTable({
    userId: v.string(),
    // Sunday 00:00 UTC of the week this batch belongs to. Used to detect a
    // stale batch and trigger regeneration once per week.
    weekStartAt: v.number(),
    kind: v.optional(
      v.union(
        v.literal('weekly'),
        v.literal('holiday'),
        v.literal('trend'),
        v.literal('seasonal'),
        v.literal('reminder'),
        v.literal('campaign')
      )
    ),
    title: v.string(),
    description: v.string(),
    // Free-form strings (not enums) so future creative-plan poster types or
    // visual styles don't require a schema change.
    posterType: v.string(),
    visualStyle: v.string(),
    suggestedGoal: v.string(),
    used: v.boolean(),
    usedAt: v.optional(v.number()),
    // Future: link to the generated post when the user converts a suggestion.
    postId: v.optional(v.id('posts')),
    createdAt: v.number(),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_and_weekStart', ['userId', 'weekStartAt']),

  // ─── Per-post generation cost records (server-side only, never shown to users)
  generationCosts: defineTable({
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
    createdAt: v.number(),
  }).index('by_userId', ['userId']),

  generationJobs: defineTable({
    userId: v.string(),
    userEmail: v.optional(v.string()),
    topic: v.string(),
    idempotencyKey: v.string(),
    status: v.union(
      v.literal('processing'),
      v.literal('completed'),
      v.literal('failed')
    ),
    businessProfileSnapshot: v.any(),
    postImageType: v.optional(
      v.union(
        v.literal('photo'),
        v.literal('designed'),
        v.literal('premium_ad')
      )
    ),
    postId: v.optional(v.id('posts')),
    imageUri: v.optional(v.string()),
    captionText: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_userId_status', ['userId', 'status'])
    .index('by_userId_idempotencyKey', ['userId', 'idempotencyKey'])
    .index('by_userId_createdAt', ['userId', 'createdAt']),

  users: defineTable({
    email: v.string(),
    emailVerified: v.optional(v.boolean()),
    fullName: v.optional(v.string()),
    role: v.union(v.literal('admin'), v.literal('user')),
    userType: v.optional(v.union(v.literal('free'), v.literal('paid'))),
    isActive: v.boolean(),
    postsGenerated: v.optional(v.number()),
    postsUsedThisWeek: v.optional(v.number()),
    lastResetDate: v.optional(v.number()),
    expoPushToken: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    lastAppOpen: v.optional(v.number()),
    lastNotificationSent: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_email', ['email']) // אינדקס לחיפוש מהיר לפי אימייל
    .index('by_role', ['role']) // אינדקס לסינון מהיר לפי תפקיד
    .index('by_userType', ['userType']), // אינדקס לסינון מהיר לפי סוג משתמש
});
