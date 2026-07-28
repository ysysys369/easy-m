import { useMutation, useConvexAuth } from 'convex/react';
import { Redirect, Tabs, useRootNavigationState } from 'expo-router';
import {
  FileText,
  Home,
  Settings,
  Sparkles,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { AppLaunchSplash } from '@/components/AppLaunchSplash';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { api } from '@/convex/_generated/api';
import { useNotificationsBootstrap } from '@/lib/notifications';

export default function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth(); // בדיקת סטטוס האימות
  const { isPremium, isLoading: isRevenueCatLoading, refreshPurchaserInfo } = useRevenueCat();
  const navigationState = useRootNavigationState();
  const syncSubscriptionStatus = useMutation(api.users.syncSubscriptionStatus);

  // Bootstrap push notifications + save token + record app opens
  useNotificationsBootstrap();

  // Refresh RC entitlement from the server on every login — prevents stale
  // cached isPremium=true after account deletion + new signup.
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      refreshPurchaserInfo().catch(() => {});
    }
  }, [isAuthenticated]);

  // Sync RevenueCat subscription status to the DB so the backend can enforce correct limits
  useEffect(() => {
    if (!isLoading && !isRevenueCatLoading && isAuthenticated) {
      syncSubscriptionStatus({ isPremium }).catch(() => {});
    }
  }, [isPremium, isLoading, isRevenueCatLoading, isAuthenticated]);

  // המתנה לטעינת הניווט (מונע שגיאות בטעינה ראשונית)
  if (!navigationState?.key) {
    return <AppLaunchSplash />;
  }

  // מסך טעינה בזמן בדיקת האימות או RevenueCat
  if (isLoading || isRevenueCatLoading) {
    return <AppLaunchSplash />;
  }

  // הפניה לדף התחברות אם המשתמש לא מחובר
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // הגדרת הטאבים בסדר לוגי (בית ראשון, ואז עמודים, ולבסוף הגדרות)
  const tabs = [
    {
      name: 'index',
      title: 'בית',
      icon: Home,
    },
    {
      name: 'create',
      title: 'יצירה',
      icon: Sparkles,
    },
    {
      name: 'page1',
      title: 'פוסטים',
      icon: FileText,
    },
    {
      name: 'settings',
      title: 'הגדרות',
      icon: Settings,
    },
  ];

  return (
    <Tabs
      tabBar={(props) => {
        const currentRoute = props.state.routes[props.state.index];
        if (currentRoute?.name === 'paywall') {
          return null;
        }

        return <FloatingTabBar {...props} />;
      }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: '#71717a',
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <tab.icon size={size} color={color} />
            ),
          }}
        />
      ))}
      {/* מסכים נסתרים — נגישים ב-router.push אך לא מוצגים בטאב בר */}
      <Tabs.Screen
        name="profile"
        options={{ headerShown: false, tabBarButton: () => null }}
      />
      <Tabs.Screen
        name="business-profile"
        options={{ headerShown: false, tabBarButton: () => null }}
      />
      <Tabs.Screen
        name="business-details"
        options={{ headerShown: false, tabBarButton: () => null }}
      />
      <Tabs.Screen
        name="business-images"
        options={{ headerShown: false, tabBarButton: () => null }}
      />
      <Tabs.Screen
        name="pricing"
        options={{ headerShown: false, tabBarButton: () => null }}
      />
      <Tabs.Screen
        name="paywall"
        options={{ headerShown: false, tabBarButton: () => null }}
      />
      <Tabs.Screen
        name="onboarding-complete"
        options={{ headerShown: false, tabBarButton: () => null }}
      />
    </Tabs>
  );
}
