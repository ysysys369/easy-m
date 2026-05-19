import { useConvexAuth } from 'convex/react';
import { Redirect, Tabs, useRootNavigationState } from 'expo-router';
import { FileSpreadsheet, FileText, Home, Settings, Sparkles } from 'lucide-react-native';
import { ActivityIndicator, I18nManager, View } from 'react-native';
import { PAYMENT_SYSTEM_ENABLED } from '@/config/appConfig';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { useNotificationsBootstrap } from '@/lib/notifications';
import { IS_RTL } from '@/lib/rtl';
import { FloatingTabBar } from '@/components/FloatingTabBar';

export default function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useConvexAuth(); // בדיקת סטטוס האימות
  const { isPremium, isLoading: isRevenueCatLoading } = useRevenueCat(); // בדיקת סטטוס פרימיום
  const navigationState = useRootNavigationState();

  // Bootstrap push notifications + save token + record app opens
  useNotificationsBootstrap();

  // המתנה לטעינת הניווט (מונע שגיאות בטעינה ראשונית)
  if (!navigationState?.key) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#4fc3f7" />
      </View>
    );
  }

  // מסך טעינה בזמן בדיקת האימות או RevenueCat
  if (isLoading || isRevenueCatLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#4fc3f7" />
      </View>
    );
  }

  // הפניה לדף התחברות אם המשתמש לא מחובר
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  // הפניה ל-Paywall אם מערכת התשלומים פעילה והמשתמש לא פרימיום
  if (PAYMENT_SYSTEM_ENABLED && !isPremium) {
    return <Redirect href="/(auth)/paywall" />;
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
      name: 'page2',
      title: 'זמנים',
      icon: FileSpreadsheet,
    },
    {
      name: 'settings',
      title: 'הגדרות',
      icon: Settings,
    },
  ];

  // אסטרטגיית סידור טאבים היברידית ל-RTL (ראה docs/rtl-knowhow.md):
  //
  // Native RTL (I18nManager.isRTL):
  // - true ב-Dev Builds ו-Production (התוסף expo-localization עובד)
  // - false ב-Expo Go (התוסף לא עובד)
  //
  // כאשר RTL טבעי (Native) מופעל, ה-Tab Bar הופך את הסדר אוטומטית
  // (הפריט הראשון מופיע בימין). לכן שומרים על סדר רגיל.
  //
  // כאשר RTL טבעי לא מופעל (Expo Go), אנחנו הופכים ידנית את המערך
  // כדי לקבל מראה RTL (ימין לשמאל).
  const isNativeRTLEnabled = I18nManager.isRTL === true;

  // קביעת סדר הטאבים בהתאם לסביבה
  const orderedTabs = isNativeRTLEnabled
    ? tabs // Native RTL הופך אוטומטית - שומרים על סדר רגיל
    : IS_RTL
      ? [...tabs].reverse() // הופכים ידנית עבור Expo Go
      : tabs; // LTR - שומרים על סדר רגיל

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: '#71717a',
      }}
    >
      {orderedTabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }: { color: string }) => (
              <tab.icon size={24} color={color} />
            ),
          }}
        />
      ))}
      {/* מסכים נסתרים — נגישים ב-router.push אך לא מוצגים בטאב בר */}
      <Tabs.Screen name="profile" options={{ headerShown: false, tabBarButton: () => null }} />
      <Tabs.Screen name="business-profile" options={{ headerShown: false, tabBarButton: () => null }} />
      <Tabs.Screen name="business-details" options={{ headerShown: false, tabBarButton: () => null }} />
      <Tabs.Screen name="pricing" options={{ headerShown: false, tabBarButton: () => null }} />
    </Tabs>
  );
}
