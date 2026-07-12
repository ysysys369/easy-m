import { useRouter } from 'expo-router';
import { ArrowRight, AlertCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { rtl } from '@/lib/rtl';

// ─── Safe loader for react-native-purchases-ui ──────────────────────────────
// If the native module isn't compiled into the running binary (stale dev build
// before rebuild), we degrade gracefully instead of throwing a red screen.
// Once you run `npx expo prebuild --clean && npx expo run:ios --device`,
// the native paywall view loads automatically.
type RevenueCatUIModule = typeof import('react-native-purchases-ui');
let RevenueCatUI: RevenueCatUIModule['default'] | null = null;
let _revenueCatUILoadError: string | null = null;
try {
  RevenueCatUI = require('react-native-purchases-ui').default;
} catch (e) {
  _revenueCatUILoadError = e instanceof Error ? e.message : String(e);
}

const C = {
  bg:          '#0a0a0a',
  card:        '#111114',
  purple:      '#7C3AED',
  purpleLight: '#a78bfa',
  purpleFaint: 'rgba(124,58,237,0.12)',
  purpleBdr:   'rgba(124,58,237,0.35)',
  border:      'rgba(63,63,70,0.55)',
  textMid:     '#a1a1aa',
  textSub:     '#52525b',
};

export default function PaywallScreen() {
  const router = useRouter();
  const [purchaseInFlight, setPurchaseInFlight] = useState(false);

  // Gate render on the RevenueCat SDK actually being configured.
  // The native <Paywall> component would throw "Purchases has not been
  // configured." if we mounted it before configure() ran.
  const {
    isLoading: isRcLoading,
    isConfigured,
    isExpoGo,
    refreshPurchaserInfo,
  } = useRevenueCat();

  // Belt-and-suspenders: if the user dismisses the paywall via the native
  // close button, ensure we leave the screen too.
  useEffect(() => {
    // RevenueCatUI.Paywall has its own close button when no header is rendered;
    // we keep our own header back arrow regardless.
  }, []);

  // ── Fallback UI when the native module isn't available ─────────────────────
  if (!RevenueCatUI) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: rtl.flexDirection, alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginBottom: 28 }}
          >
            <Text style={{ color: C.textMid, fontSize: 14 }}>חזרה</Text>
            <ArrowRight size={16} color={C.textMid} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 20,
              backgroundColor: 'rgba(234,179,8,0.10)',
              borderWidth: 1, borderColor: 'rgba(234,179,8,0.40)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertCircle size={28} color="#eab308" />
            </View>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch' }}>
              נדרשת בנייה מחדש
            </Text>
            <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch', lineHeight: 22 }}>
              מודול ה־Paywall של RevenueCat עדיין לא קומפל לבניין הנוכחי.{'\n'}
              הרץ:
            </Text>
            <View style={{
              backgroundColor: C.card, borderRadius: 12, padding: 14,
              borderWidth: 1, borderColor: C.border,
            }}>
              <Text style={{ color: '#a78bfa', fontSize: 12, fontFamily: 'Courier' }}>
                npx expo prebuild --clean{'\n'}npx expo run:ios --device
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Wait for RevenueCat SDK to finish configure() before mounting Paywall ──
  // If we mount <Paywall> before configure() succeeds, the native view throws
  // "Purchases has not been configured."
  if (isRcLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 14 }} edges={['top']}>
        <ActivityIndicator size="large" color={C.purple} />
        <Text style={{ color: C.textMid, fontSize: 13 }}>טוען חבילות מנוי…</Text>
      </SafeAreaView>
    );
  }

  // SDK was never configured (no API key present at build time or running in
  // a preview host that doesn't ship native modules). Show a clean user-facing
  // message — no env var names, no ".env.local", no reference to RevenueCat.
  if (!isConfigured || isExpoGo) {
    // Belt-and-suspenders exit — when we reach paywall via router.replace
    // (e.g. from the post-onboarding first-save flow), there is nothing to
    // pop back to. Fall back to replacing into /(authenticated) so the user
    // always lands on Home and never sees a dead back button.
    const exitToApp = () => {
      if (router.canGoBack()) router.back();
      else router.replace('/(authenticated)');
    };
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}>
          <Pressable
            onPress={exitToApp}
            style={{ flexDirection: rtl.flexDirection, alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginBottom: 28 }}
          >
            <Text style={{ color: C.textMid, fontSize: 14 }}>חזרה</Text>
            <ArrowRight size={16} color={C.textMid} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 20,
              backgroundColor: 'rgba(124,58,237,0.10)',
              borderWidth: 1, borderColor: 'rgba(124,58,237,0.40)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertCircle size={28} color={C.purpleLight} />
            </View>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch' }}>
              התשלומים לא זמינים כרגע
            </Text>
            <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch', lineHeight: 22 }}>
              השירות בהקמה. אנא נסה שוב מאוחר יותר או צור קשר עם התמיכה.
            </Text>
            <Pressable
              onPress={exitToApp}
              style={{
                marginTop: 6,
                paddingVertical: 12,
                paddingHorizontal: 26,
                borderRadius: 999,
                backgroundColor: C.purple,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                חזרה לאפליקציה
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Native RevenueCat Paywall ──────────────────────────────────────────────
  // The native view fills the screen edge-to-edge and includes its own
  // close button via `displayCloseButton`. We render a small back arrow on
  // top in case the user prefers our app's nav.
  const Paywall = RevenueCatUI.Paywall;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['bottom']}>
      <Paywall
        style={{ flex: 1 }}
        options={{
          // displayCloseButton renders RevenueCat's own native ✕.
          // We rely on it (plus our header overlay) so the user can always exit.
          displayCloseButton: true,
        }}
        onDismiss={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(authenticated)');
        }}
        onPurchaseStarted={() => {
          setPurchaseInFlight(true);
        }}
        onPurchaseCompleted={async () => {
          setPurchaseInFlight(false);
          await refreshPurchaserInfo();
          Alert.alert('תודה! ✅', 'הרכישה הושלמה בהצלחה.');
          router.replace('/(authenticated)');
        }}
        onPurchaseError={({ error }) => {
          setPurchaseInFlight(false);
          Alert.alert('שגיאה ברכישה', error.message ?? 'משהו השתבש, נסה שוב.');
        }}
        onPurchaseCancelled={() => {
          setPurchaseInFlight(false);
        }}
        onRestoreStarted={() => {
          setPurchaseInFlight(true);
        }}
        onRestoreCompleted={async () => {
          setPurchaseInFlight(false);
          await refreshPurchaserInfo();
          Alert.alert('שוחזר ✅', 'הרכישות הקודמות שוחזרו.');
          router.replace('/(authenticated)');
        }}
        onRestoreError={({ error }) => {
          setPurchaseInFlight(false);
          Alert.alert('שחזור נכשל', error.message ?? 'לא הצלחנו לשחזר רכישות.');
        }}
      />

      {/* Lightweight back overlay — does not interfere with native paywall touches.
          Sits in the top-right safe area (RTL "start" position). */}
      <SafeAreaView
        edges={['top']}
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, width: '100%' }}
      >
        <View style={{ flexDirection: rtl.flexDirection, justifyContent: 'flex-start', paddingHorizontal: 16, paddingTop: 8 }}>
          <Pressable
            onPress={() => {
              if (purchaseInFlight) return;
              if (router.canGoBack()) router.back();
              else router.replace('/(authenticated)');
            }}
            hitSlop={12}
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: 'rgba(0,0,0,0.55)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ArrowRight size={18} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}
