import { v } from 'convex/values';
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';

const DAY_MS  = 24 * 60 * 60 * 1000;
const ONE_DAY = DAY_MS;
const THREE_DAYS = 3 * DAY_MS;

type Candidate = {
  _id: any;
  expoPushToken: string;
  lastNotificationSent?: number;
};

/** Find users who haven't opened the app in 3+ days, have a push token,
 *  notifications enabled, and haven't received a notification in the past 24h. */
export const findInactiveUsersToNotify = internalQuery({
  args: {},
  handler: async (ctx): Promise<Candidate[]> => {
    const now = Date.now();
    const users = await ctx.db.query('users').collect();
    return users
      .filter((u) => {
        if (!u.expoPushToken) return false;
        if (u.notificationsEnabled === false) return false;
        const lastOpen = u.lastAppOpen ?? u.createdAt ?? 0;
        if (now - lastOpen < THREE_DAYS) return false;
        const lastNotif = u.lastNotificationSent ?? 0;
        if (now - lastNotif < ONE_DAY) return false; // max 1 per day
        return true;
      })
      .map((u) => ({
        _id: u._id,
        expoPushToken: u.expoPushToken as string,
        lastNotificationSent: u.lastNotificationSent,
      }));
  },
});

/** Mark a notification as sent (rate-limit guard) */
export const markNotificationSent = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await ctx.db.patch(userId, {
      lastNotificationSent: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Send a single push via Expo Push API */
async function sendExpoPush(token: string, title: string, body: string) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      sound: 'default',
      title,
      body,
      data: { screen: '/(authenticated)/create' },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Expo push failed: ${res.status} ${text}`);
  }
  return res.json();
}

/** Cron-triggered: send a comeback push to users idle for 3+ days */
export const sendInactivityPushes = internalAction({
  args: {},
  handler: async (ctx) => {
    const candidates: Candidate[] = await ctx.runQuery(
      internal.notifications.findInactiveUsersToNotify,
    );
    let sent = 0;
    for (const u of candidates) {
      try {
        await sendExpoPush(
          u.expoPushToken,
          'Easy-M',
          'לא פרסמת כבר כמה ימים 👀 בוא ניצור לך פוסט חדש',
        );
        await ctx.runMutation(internal.notifications.markNotificationSent, { userId: u._id });
        sent += 1;
      } catch {
        // continue to next user on individual failure
      }
    }
    return { sent, candidates: candidates.length };
  },
});
