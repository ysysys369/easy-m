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
    userId:    v.string(),
    content:   v.string(),
    captionText: v.optional(v.string()),
    imageUri:  v.optional(v.string()),
    businessName: v.optional(v.string()),
    businessType: v.optional(v.string()),
    generationMode: v.optional(v.union(v.literal('auto'), v.literal('manual'))),
    status:    v.union(v.literal('draft'), v.literal('scheduled'), v.literal('published')),
    createdAt: v.number(),
  }).index('by_userId', ['userId']),

  onboardingAnswers: defineTable({
    userId:          v.string(),
    businessType:    v.optional(v.string()),
    experienceLevel: v.optional(v.string()),
    goal:            v.optional(v.string()),
    tone:            v.optional(v.array(v.string())),
    createdAt:       v.number(),
    updatedAt:       v.number(),
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
    phone: v.optional(v.string()),
    socialInstagram: v.optional(v.string()),
    socialFacebook: v.optional(v.string()),
    goal: v.optional(v.string()),
    services: v.optional(v.string()),
    uniqueness: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_userId', ['userId']),

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
