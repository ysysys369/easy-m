import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useConvex, useConvexAuth, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

// Safe loader — if the native module isn't compiled into the running binary
// (stale dev build), we degrade gracefully instead of crashing.
type NotificationsModule = typeof import('expo-notifications');
let Notifications: NotificationsModule | null = null;
try {
  Notifications = require('expo-notifications') as NotificationsModule;
} catch {
  Notifications = null;
}

const WEEKLY_REMINDER_ID = 'easym-weekly-reminder';

/** Configure handler once on app load */
export function configureNotificationHandler() {
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function getExpoPushToken(): Promise<string | null> {
  if (!Notifications) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;
  try {
    const tokenResp = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    return tokenResp.data ?? null;
  } catch {
    return null;
  }
}

async function scheduleWeeklyReminder() {
  if (!Notifications) return;
  try {
    // Cancel any previous scheduled one first to avoid duplicates
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_REMINDER_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: WEEKLY_REMINDER_ID,
      content: {
        title: 'Easy-M',
        body: '📅 הגיע הזמן לפוסט השבועי שלך',
        data: { screen: '/(authenticated)/create' },
      },
      trigger: {
        // Sunday 09:00 every week — adjust to your liking
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // 1 = Sunday in iOS calendar; 1-7 (Sun-Sat) per Expo docs
        hour: 9,
        minute: 0,
      } as any,
    });
  } catch {
    // silently ignore — scheduling is non-critical
  }
}

/** Send a local notification ~30 seconds after a post is generated */
export async function scheduleAfterGenerationNotification() {
  if (!Notifications) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Easy-M',
        body: '🔥 פוסט חדש מחכה לך! בוא תעלה אותו עכשיו',
        data: { screen: '/(authenticated)/create' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 30,
        repeats: false,
      } as any,
    });
  } catch {
    // ignore
  }
}

/**
 * Bootstrap notifications for the authenticated user:
 *  1. Request permission once
 *  2. Get Expo push token and save to Convex
 *  3. Schedule the weekly reminder
 *  4. Listen for taps → navigate to /create
 *  5. Mark app opened so the inactivity cron knows
 */
export function useNotificationsBootstrap() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const convex = useConvex();
  const savePushToken = useMutation(api.users.savePushToken);
  const setEnabled    = useMutation(api.users.setNotificationsEnabled);
  const markAppOpened = useMutation(api.users.markAppOpened);
  const bootstrapped  = useRef(false);

  // Tap handler: navigate to the screen specified in notification data
  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = (response.notification.request.content.data as any)?.screen;
      if (typeof screen === 'string') {
        try { router.push(screen as any); } catch { /* invalid route */ }
      }
    });
    return () => sub.remove();
  }, [router]);

  // One-shot bootstrap when the user becomes authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      // 1. Mark app opened (don't await error)
      markAppOpened({}).catch(() => {});

      if (!Notifications) return;

      // 2. Request permission
      const existing = await Notifications.getPermissionsAsync();
      let status = existing.status;
      if (status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }
      if (status !== 'granted') {
        await setEnabled({ enabled: false }).catch(() => {});
        return;
      }

      // 3. Get token and save
      const token = await getExpoPushToken();
      if (token) {
        await savePushToken({ token, notificationsEnabled: true }).catch(() => {});
      } else {
        await setEnabled({ enabled: true }).catch(() => {});
      }

      // 4. Schedule the recurring weekly reminder
      await scheduleWeeklyReminder();
    })().catch(() => { /* silently fail — never break the app */ });
  }, [isAuthenticated, markAppOpened, savePushToken, setEnabled]);

  // Also mark app opened on the day-level (cheap mutation) so cron has fresh data
  useEffect(() => {
    if (!isAuthenticated) return;
    markAppOpened({}).catch(() => {});
  }, [isAuthenticated, markAppOpened, convex]);
}
