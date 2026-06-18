import { useConvexAuth } from 'convex/react';
import { Redirect, Slot, useLocalSearchParams, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { AppLaunchSplash } from '@/components/AppLaunchSplash';
import { IS_DEV_MODE } from '@/config/appConfig';

export default function AuthRoutesLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const segments = useSegments();
  const { preview } = useLocalSearchParams<{ preview?: string }>();

  // המתנה לטעינת סטטוס האימות
  if (isLoading) {
    return <AppLaunchSplash />;
  }

  // בדיקה אם זה מצב תצוגה מקדימה (preview mode)
  // במצב תצוגה מקדימה, משתמשים מחוברים יכולים לגשת לדפי auth לצורך דיבאג
  const isPreviewMode = IS_DEV_MODE && preview === 'true';

  // בדיקה האם המסלול הנוכחי הוא paywall
  // מסלול זה צריך להיות נגיש גם למשתמשים מחוברים (למשל מהגדרות/דיבאג)
  // המרה למערך מחרוזות כללי כדי לאפשר בדיקת includes
  const segmentStrings = segments as string[];
  const isPaywallRoute = segmentStrings.includes('paywall');
  const isOnboardingRoute = segmentStrings.includes('onboarding');
  const isAllowedForAuthenticated =
    isPaywallRoute || isOnboardingRoute || isPreviewMode;

  // אם המשתמש כבר מחובר, הפנה אותו לאזור המאומת
  // אלא אם הוא במסלול paywall או במצב תצוגה מקדימה
  // זה מונע ממשתמשים מחוברים לגשת למסכי התחברות/הרשמה
  // אבל מאפשר להם לגשת דרך הגדרות/דיבאג במצב preview
  if (isAuthenticated && !isAllowedForAuthenticated) {
    return <Redirect href="/(authenticated)" />;
  }

  // שימוש ב-Slot כדי לעבד את המסכים הפנימיים (sign-in, sign-up, paywall)
  // אנחנו משתמשים ב-Slot במקום Stack כי ה-Layout הראשי כבר מספק את הקונטקסט הדרוש
  return <Slot />;
}
