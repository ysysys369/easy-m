import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  Bug,
  Building2,
  ChevronLeft,
  CreditCard,
  LogIn,
  LogOut,
  Settings2,
  Shield,
  Trash2,
  UserPlus,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  APP_ENV,
  IS_DEV_MODE,
  MOCK_PAYMENTS,
  PAYMENT_SYSTEM_ENABLED,
} from '@/config/appConfig';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { api } from '@/convex/_generated/api';
import { tw } from '@/lib/rtl';
import { LogoTopLeft } from '@/components/LogoTopLeft';

// ─── צבעים ─────────────────────────────────────────────────────────────────
const C = {
  bg:         '#0a0a0a',
  card:       '#111114',
  purple:     '#7C3AED',
  purpleGlow: 'rgba(124,58,237,0.22)',
  purpleBdr:  'rgba(124,58,237,0.35)',
  purpleFaint:'rgba(124,58,237,0.12)',
  border:     'rgba(63,63,70,0.55)',
  textSub:    '#52525b',
  textMid:    '#71717a',
};

// ─── שורת מידע בפאנל דיבאג ──────────────────────────────────────────────────
function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: '#d4d4d8', fontSize: 13 }}>{value}</Text>
      <Text style={{ color: C.textMid, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

// ─── כפתור דיבאג ─────────────────────────────────────────────────────────────
function DebugButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 14,
          borderRadius: 14,
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: 'rgba(234,179,8,0.25)',
        }}
      >
        <ChevronLeft size={16} color={C.textMid} />
        <Text style={{ flex: 1, color: '#e4e4e7', fontSize: 13, textAlign: 'right' }}>{label}</Text>
        <Icon size={18} color={C.purple} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── שורת פעולה ─────────────────────────────────────────────────────────────
function ActionRow({
  icon: Icon,
  label,
  onPress,
  destructive = false,
  delay = 0,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  delay?: number;
}) {
  const anim  = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 380, delay, useNativeDriver: true }).start();
  }, []);

  const opacity    = anim;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 40 }).start();

  const color = destructive ? '#ef4444' : '#e4e4e7';
  const iconColor = destructive ? '#ef4444' : C.purple;
  const borderColor = destructive ? 'rgba(239,68,68,0.30)' : C.purpleBdr;
  const bgColor = destructive ? 'rgba(239,68,68,0.06)' : C.card;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 16,
          borderRadius: 20,
          backgroundColor: bgColor,
          borderWidth: 1,
          borderColor,
          shadowColor: destructive ? '#ef4444' : C.purple,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <ChevronLeft size={18} color={C.textMid} />
        <Text style={{ flex: 1, color, fontSize: 15, fontWeight: '600', textAlign: 'right' }}>
          {label}
        </Text>
        <Icon size={20} color={iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── מסך הגדרות ────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isPremium, isConfigured, isExpoGo } = useRevenueCat();
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const deleteMyAccount = useMutation(api.users.deleteMyAccount);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 480, useNativeDriver: true }).start();
  }, []);

  // ============================================================================
  // פעולות
  // ============================================================================

  const handleSignOut = async () => {
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        {
          text: 'ביטול',
          style: 'cancel',
        },
        {
          text: 'התנתק',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch {
              Alert.alert('שגיאה', 'אירעה שגיאה בהתנתקות');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      '⚠️ מחיקת חשבון',
      'האם אתה בטוח שברצונך למחוק את החשבון שלך?\n\nפעולה זו תמחק לצמיתות את:\n• פרטי החשבון שלך\n• כל הנתונים המשויכים אליך\n• היסטוריית השימוש שלך\n\n⚠️ לא ניתן לשחזר את הנתונים לאחר המחיקה!',
      [
        {
          text: 'ביטול',
          style: 'cancel',
        },
        {
          text: 'המשך למחיקה',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '🚨 אישור סופי',
              'זוהי ההזדמנות האחרונה שלך לבטל!\n\nהחשבון שלך וכל הנתונים ימחקו לצמיתות ולא יהיה ניתן לשחזר אותם.\n\nהאם אתה בטוח לחלוטין?',
              [
                {
                  text: 'ביטול - אל תמחק',
                  style: 'cancel',
                },
                {
                  text: 'כן, מחק את החשבון',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteMyAccount();
                      await signOut();
                      Alert.alert(
                        'החשבון נמחק',
                        'החשבון שלך נמחק בהצלחה. תודה שהשתמשת באפליקציה שלנו.'
                      );
                    } catch (_error) {
                      Alert.alert(
                        'שגיאה',
                        'אירעה שגיאה במחיקת החשבון. אנא נסה שוב או צור קשר עם התמיכה.'
                      );
                    }
                  },
                },
              ],
              { cancelable: true }
            );
          },
        },
      ],
      { cancelable: true }
    );
  };

  const openPaywallPreview = () => {
    router.push('/(auth)/paywall?preview=true');
  };

  const openSignInPreview = () => {
    router.push('/(auth)/sign-in?preview=true');
  };

  const openSignUpPreview = () => {
    router.push('/(auth)/sign-up?preview=true');
  };

  // ============================================================================
  // רינדור
  // ============================================================================

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <LogoTopLeft />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 80 }}>

          {/* ─── כותרת ─── */}
          <Animated.View
            style={{
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              marginBottom: 6,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>
              הגדרות
            </Text>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: C.purpleFaint,
                borderWidth: 1,
                borderColor: C.purpleBdr,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings2 size={22} color={C.purple} />
            </View>
          </Animated.View>

          <Animated.Text
            style={{
              opacity: headerAnim,
              color: C.textSub,
              fontSize: 14,
              textAlign: 'right',
              marginBottom: 28,
            }}
          >
            ניהול החשבון והאפליקציה
          </Animated.Text>

          {/* ─── כרטיס סטטוס מנוי ─── */}
          <Animated.View
            style={{
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              backgroundColor: C.card,
              borderWidth: 1,
              borderColor: isPremium ? C.purpleBdr : C.border,
              borderRadius: 20,
              padding: 18,
              marginBottom: 16,
              shadowColor: isPremium ? C.purple : '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isPremium ? 0.20 : 0.10,
              shadowRadius: 12,
              elevation: 5,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Badge סטטוס */}
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 10,
                  backgroundColor: isPremium ? C.purpleFaint : 'rgba(63,63,70,0.60)',
                  borderWidth: 1,
                  borderColor: isPremium ? C.purpleBdr : C.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: isPremium ? '#a78bfa' : C.textMid }}>
                  {isPremium ? 'פרימיום' : 'חינמי'}
                </Text>
              </View>

              {/* כותרת + אייקון */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  סטטוס מנוי
                </Text>
                <Shield size={18} color={isPremium ? C.purple : C.textMid} />
              </View>
            </View>
          </Animated.View>

          {/* ─── פעולות ─── */}
          <Text
            style={{
              color: C.textSub,
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: 0.8,
              textAlign: 'right',
              marginBottom: 12,
            }}
          >
            פעולות חשבון
          </Text>
          <View style={{ gap: 10, marginBottom: 28 }}>
            <ActionRow icon={Building2} label="פרטי העסק"   onPress={() => router.push('/(authenticated)/business-details')} delay={20} />
            <ActionRow icon={LogOut}    label="התנתקות"       onPress={handleSignOut}      delay={100} />
            <ActionRow icon={Trash2}    label="מחיקת חשבון"   onPress={handleDeleteAccount} delay={180} destructive />
          </View>

          {/* ─── פאנל דיבאג ─── */}
          {IS_DEV_MODE && (
            <View style={{ marginBottom: 16 }}>
              {/* כותרת פאנל */}
              <TouchableOpacity
                onPress={() => setIsDebugOpen(!isDebugOpen)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                  borderRadius: isDebugOpen ? 0 : 20,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  backgroundColor: 'rgba(234,179,8,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(234,179,8,0.28)',
                  borderBottomWidth: isDebugOpen ? 0 : 1,
                }}
              >
                <ChevronLeft
                  size={18}
                  color="#eab308"
                  style={{ transform: [{ rotate: isDebugOpen ? '-90deg' : '0deg' }] }}
                />
                <Text style={{ flex: 1, color: '#eab308', fontSize: 14, fontWeight: '600', textAlign: 'right' }}>
                  קונסולת דיבאג (מצב פיתוח)
                </Text>
                <Bug size={18} color="#eab308" />
              </TouchableOpacity>

              {/* תוכן פאנל */}
              {isDebugOpen && (
                <View
                  style={{
                    padding: 16,
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 20,
                    backgroundColor: C.card,
                    borderWidth: 1,
                    borderTopWidth: 0,
                    borderColor: 'rgba(234,179,8,0.28)',
                  }}
                >
                  {/* מצב אפליקציה */}
                  <Text style={{ color: C.textMid, fontSize: 12, fontWeight: '600', textAlign: 'right', marginBottom: 8 }}>
                    מצב אפליקציה
                  </Text>
                  <View style={{ gap: 2, marginBottom: 16 }}>
                    <DebugRow label="סביבה"           value={APP_ENV} />
                    <DebugRow label="מערכת תשלומים"   value={PAYMENT_SYSTEM_ENABLED ? 'פעיל' : 'כבוי'} />
                    <DebugRow label="תשלומים מדומים"  value={MOCK_PAYMENTS ? 'פעיל' : 'כבוי'} />
                    <DebugRow label="RevenueCat מוגדר" value={isConfigured ? 'כן' : 'לא'} />
                    <DebugRow label="Expo Go"          value={isExpoGo ? 'כן' : 'לא'} />
                    <DebugRow label="סטטוס פרימיום"   value={isPremium ? 'פרימיום' : 'חינמי'} />
                  </View>

                  {/* בדיקות UI */}
                  <Text style={{ color: C.textMid, fontSize: 12, fontWeight: '600', textAlign: 'right', marginBottom: 10 }}>
                    בדיקות UI
                  </Text>
                  <View style={{ gap: 8 }}>
                    <DebugButton icon={CreditCard} label="פתח מסך תשלום (Preview)"      onPress={openPaywallPreview} />
                    <DebugButton icon={LogIn}      label="פתח מסך התחברות (Preview)"    onPress={openSignInPreview} />
                    <DebugButton icon={UserPlus}   label="פתח מסך הרשמה (Preview)"      onPress={openSignUpPreview} />
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ─── באנר מצב פיתוח ─── */}
          {IS_DEV_MODE && (
            <View
              style={{
                padding: 12,
                borderRadius: 14,
                backgroundColor: 'rgba(234,179,8,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(234,179,8,0.25)',
                marginBottom: 8,
              }}
            >
              <Text style={{ color: '#eab308', textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
                מצב פיתוח פעיל
              </Text>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
