import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';

// הגדרת מערכת האימות (Authentication)
// קובץ זה מגדיר את ספקי ההזדהות והלוגיקה של יצירת משתמשים
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password], // שימוש בסיסמה (אימייל וסיסמה) כספק הזדהות
  session: {
    totalDurationMs: 30 * 24 * 60 * 60 * 1000, // משך זמן ה-Session (30 ימים)
  },
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const now = Date.now();
      const email = args.profile.email ?? '';

      if (args.existingUserId) {
        await ctx.db.patch(args.existingUserId, {
          email,
          emailVerified: args.profile.emailVerified ?? false,
          fullName: args.profile.name || 'User',
          updatedAt: now,
        });
        return args.existingUserId;
      }

      const existingUser = email
        ? (await ctx.db.query('users').collect()).find((user) => user.email === email)
        : null;

      if (existingUser) {
        await ctx.db.patch(existingUser._id, {
          emailVerified: args.profile.emailVerified ?? existingUser.emailVerified ?? false,
          fullName: args.profile.name || existingUser.fullName || 'User',
          updatedAt: now,
        });
        return existingUser._id;
      }

      const userId = await ctx.db.insert('users', {
        email,
        emailVerified: args.profile.emailVerified ?? false,
        fullName: args.profile.name || 'User',
        role: 'user',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      return userId;
    },
  },
});
