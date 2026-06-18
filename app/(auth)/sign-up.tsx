import { useAuthActions } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PreviewModeBanner } from '@/components/PreviewModeBanner';
import { IS_DEV_MODE, PRIVACY_URL, TERMS_URL } from '@/config/appConfig';
import { rtl } from '@/lib/rtl';

const REMEMBERED_EMAIL_KEY = 'remembered_email';

// ─── Design tokens — matches onboarding palette exactly ──────────────────────
const C = {
  bg:          '#0a0a0a',
  card:        '#111114',
  purple:      '#7C3AED',
  purpleDeep:  '#5b21b6',
  purpleBdr:   'rgba(124,58,237,0.35)',
  purpleFaint: 'rgba(124,58,237,0.12)',
  border:      'rgba(63,63,70,0.55)',
  textSub:     '#52525b',
  textMid:     '#71717a',
  textLight:   '#a1a1aa',
};

// ─── Styled input (identical pattern to sign-in) ──────────────────────────────
function StyledInput({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize,
  autoCorrect, editable, secureTextEntry, leadingIcon, trailingSlot, slideAnim,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences';
  autoCorrect?: boolean;
  editable?: boolean;
  secureTextEntry?: boolean;
  leadingIcon: React.ReactNode;
  trailingSlot?: React.ReactNode;
  slideAnim: Animated.Value;
}) {
  const [focused, setFocused] = useState(false);
  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <Animated.View style={{ opacity: slideAnim, transform: [{ translateY }], marginBottom: 16 }}>
      <Text style={{ color: C.textLight, fontSize: 13, fontWeight: '600', textAlign: 'right', marginBottom: 8 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: rtl.flexDirection,
          alignItems: 'center',
          backgroundColor: C.card,
          borderWidth: 1.5,
          borderColor: focused ? C.purple : C.border,
          borderRadius: 16,
          paddingHorizontal: 14,
          shadowColor:   focused ? C.purple : 'transparent',
          shadowOffset:  { width: 0, height: 0 },
          shadowOpacity: focused ? 0.28 : 0,
          shadowRadius:  10,
          elevation:     focused ? 4 : 0,
        }}
      >
        <View style={{ paddingEnd: 4 }}>{leadingIcon}</View>
        <TextInput
          style={{
            flex: 1,
            color: '#e4e4e7',
            fontSize: 15,
            paddingVertical: Platform.OS === 'ios' ? 16 : 12,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.textSub}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoCorrect={autoCorrect ?? true}
          editable={editable}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {trailingSlot && <View style={{ paddingStart: 4 }}>{trailingSlot}</View>}
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function SignUpScreen() {
  const { signIn }     = useAuthActions();
  const router         = useRouter();
  const { preview }    = useLocalSearchParams<{ preview?: string }>();
  const isPreviewMode  = IS_DEV_MODE && preview === 'true';

  const [email,            setEmail]            = useState('');
  const [password,         setPassword]         = useState('');
  const [loading,          setLoading]          = useState(false);
  const [rememberMe,       setRememberMe]       = useState(false);
  const [showPassword,     setShowPassword]     = useState(false);
  const [consentAccepted,  setConsentAccepted]  = useState(false);

  // Load remembered email
  useEffect(() => {
    AsyncStorage.getItem(REMEMBERED_EMAIL_KEY).then((val) => {
      if (val) { setEmail(val); setRememberMe(true); }
    }).catch(() => {});
  }, []);

  const onSignUpPress = async () => {
    if (isPreviewMode) return;
    if (!email || !password) { Alert.alert('שגיאה', 'אנא מלא את כל השדות'); return; }
    if (!consentAccepted)    { Alert.alert('שגיאה', 'אנא קרא ואשר את תנאי השימוש ומדיניות הפרטיות'); return; }
    if (password.length < 6) { Alert.alert('שגיאה', 'הסיסמה חייבת להכיל לפחות 6 תווים'); return; }

    setLoading(true);
    try {
      await signIn('password', { email, password, flow: 'signUp' });

      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      // New users always go to onboarding
      router.replace('/(auth)/onboarding');
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? '';
      if (msg.includes('already exists') || msg.includes('AccountAlreadyExists')) {
        Alert.alert('שגיאה', 'כתובת האימייל כבר רשומה במערכת');
      } else if (msg.includes('password') && msg.includes('weak')) {
        Alert.alert('שגיאה', 'הסיסמה חלשה מדי. אנא בחר סיסמה חזקה יותר');
      } else if (msg.includes('TooManyRequests')) {
        Alert.alert('שגיאה', 'יותר מדי ניסיונות. אנא נסה שוב מאוחר יותר');
      } else if (msg.includes('invalid') && msg.includes('email')) {
        Alert.alert('שגיאה', 'כתובת האימייל אינה תקינה');
      } else {
        Alert.alert('שגיאה', 'הרשמה נכשלה. אנא בדוק את הפרטים ונסה שוב');
      }
    } finally {
      setLoading(false);
    }
  };

  const openLegalUrl = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('Cannot open legal URL');
      await Linking.openURL(url);
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לפתוח את המסמך. נסה שוב בעוד רגע.');
    }
  };

  // ─── Animations ───────────────────────────────────────────────────────────
  const screenAnim = useRef(new Animated.Value(0)).current;
  const logoAnim   = useRef(new Animated.Value(0)).current;
  const emailAnim  = useRef(new Animated.Value(0)).current;
  const passAnim   = useRef(new Animated.Value(0)).current;
  const lowerAnim  = useRef(new Animated.Value(0)).current;
  const btnScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(screenAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(logoAnim,   { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(emailAnim,  { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(passAnim,   { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.timing(lowerAnim,  { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start();
  }, []);

  const btnIn  = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start();
  const btnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 35 }).start();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {isPreviewMode && <PreviewModeBanner onClose={() => router.back()} />}

      {/* Background purple glow — mirrors onboarding welcome */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -60,
          width: '100%',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 320,
            height: 320,
            borderRadius: 160,
            backgroundColor: 'rgba(124,58,237,0.18)',
            transform: [{ scaleY: 0.5 }],
          }}
        />
      </View>

      {isPreviewMode && (
        <View style={{ padding: 12, backgroundColor: 'rgba(234,179,8,0.12)', borderBottomWidth: 1, borderBottomColor: 'rgba(234,179,8,0.3)' }}>
          <Text style={{ color: '#facc15', textAlign: 'center', fontSize: 13, fontWeight: '500' }}>
            מצב תצוגה מקדימה — הרשמה מושבתת
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: screenAnim }}>

            {/* ── Logo ── */}
            <Animated.View
              style={{
                alignItems: 'center',
                marginBottom: 28,
                opacity: logoAnim,
                transform: [{ translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
              }}
            >
              {/* Soft radial glow behind logo */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 180, height: 180, borderRadius: 90,
                  backgroundColor: 'rgba(124,58,237,0.22)',
                  transform: [{ scaleY: 0.45 }],
                  top: 8, alignSelf: 'center',
                }}
              />
              <Image
                source={require('@/assets/images/logo.png')}
                style={{ width: 96, height: 96 }}
                resizeMode="contain"
              />
            </Animated.View>

            {/* ── Headline ── */}
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
                צור חשבון חדש
              </Text>
              <Text style={{ color: C.textMid, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                הירשם כדי להתחיל ליצור תוכן שיווקי חכם
              </Text>
            </View>

            {/* ── Inputs ── */}
            <StyledInput
              label="כתובת אימייל"
              value={email}
              onChangeText={setEmail}
              placeholder="example@gmail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              leadingIcon={<Mail size={18} color={C.textMid} />}
              slideAnim={emailAnim}
            />

            <StyledInput
              label="סיסמה"
              value={password}
              onChangeText={setPassword}
              placeholder="לפחות 6 תווים"
              autoCapitalize="none"
              editable={!loading}
              secureTextEntry={!showPassword}
              leadingIcon={<Lock size={18} color={C.textMid} />}
              trailingSlot={
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                  {showPassword
                    ? <EyeOff size={18} color={C.textMid} />
                    : <Eye    size={18} color={C.textMid} />}
                </Pressable>
              }
              slideAnim={passAnim}
            />

            {/* ── Remember me + Consent ── */}
            <Animated.View style={{ opacity: lowerAnim, gap: 14, marginBottom: 24 }}>

              {/* Remember me */}
              <Pressable
                onPress={() => setRememberMe(!rememberMe)}
                disabled={loading}
                style={{ flexDirection: rtl.flexDirection, alignItems: 'center', gap: 8, justifyContent: 'flex-start' }}
              >
                <Text style={{ color: C.textLight, fontSize: 14 }}>זכור אותי</Text>
                <View
                  style={{
                    width: 20, height: 20, borderRadius: 6,
                    borderWidth: 2,
                    borderColor: rememberMe ? C.purple : C.textSub,
                    backgroundColor: rememberMe ? C.purple : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {rememberMe && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 14 }}>✓</Text>}
                </View>
              </Pressable>

              {/* Consent checkbox */}
              <TouchableOpacity
                accessibilityLabel="אשר תנאי שימוש ומדיניות פרטיות"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentAccepted }}
                onPress={() => setConsentAccepted(!consentAccepted)}
                disabled={loading}
                style={{ flexDirection: rtl.flexDirection, alignItems: 'flex-start', gap: 10 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.textLight, fontSize: 13, textAlign: 'right', writingDirection: 'rtl', lineHeight: 20 }}>
                    אני מסכים/ה ל
                    <Text
                      onPress={() => openLegalUrl(TERMS_URL)}
                      style={{ color: C.purple, fontWeight: '700' }}
                    >
                      תנאי השימוש
                    </Text>
                    {' '}ול
                    <Text
                      onPress={() => openLegalUrl(PRIVACY_URL)}
                      style={{ color: C.purple, fontWeight: '700' }}
                    >
                      מדיניות הפרטיות
                    </Text>
                  </Text>
                </View>
                <View
                  style={{
                    width: 22, height: 22, borderRadius: 7,
                    borderWidth: 2,
                    borderColor: consentAccepted ? C.purple : C.textSub,
                    backgroundColor: consentAccepted ? C.purple : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}
                >
                  {consentAccepted && <Check size={13} color="#fff" />}
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* ── Sign-up button ── */}
            <Animated.View style={{ transform: [{ scale: btnScale }], marginBottom: 24 }}>
              <Pressable
                onPressIn={btnIn}
                onPressOut={btnOut}
                onPress={onSignUpPress}
                disabled={loading || isPreviewMode || !consentAccepted}
                style={{
                  backgroundColor: loading || isPreviewMode || !consentAccepted ? C.purpleDeep : C.purple,
                  borderRadius: 20,
                  paddingVertical: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: !consentAccepted || isPreviewMode ? 0.18 : 0.50,
                  shadowRadius: 20,
                  elevation: 10,
                  opacity: !consentAccepted ? 0.60 : 1,
                }}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>הירשם</Text>
                }
              </Pressable>
            </Animated.View>

            {/* ── Link to sign-in ── */}
            <Animated.View style={{ flexDirection: rtl.flexDirection, justifyContent: 'center', gap: 6, opacity: lowerAnim }}>
              <Text style={{ color: C.textMid, fontSize: 14 }}>כבר יש לך חשבון?</Text>
              {isPreviewMode ? (
                <Text style={{ color: C.textSub, fontSize: 14, fontWeight: '600' }}>התחבר כאן</Text>
              ) : (
                <Link href="/(auth)/sign-in" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: C.purple, fontSize: 14, fontWeight: '700' }}>התחבר כאן</Text>
                  </TouchableOpacity>
                </Link>
              )}
            </Animated.View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
