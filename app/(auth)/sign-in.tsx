import { useAuthActions } from '@convex-dev/auth/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
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
import { IS_DEV_MODE } from '@/config/appConfig';
import { rtl } from '@/lib/rtl';

// ─── קבועים — לא שונה ────────────────────────────────────────────────────────
const REMEMBERED_EMAIL_KEY = 'remembered_email';

const C = {
  bg:          '#050507',
  card:        '#0f0f13',
  purple:      '#7C3AED',
  purpleDim:   '#3b1f6e',
  purpleBdr:   'rgba(124,58,237,0.40)',
  purpleFaint: 'rgba(124,58,237,0.12)',
  border:      'rgba(63,63,70,0.60)',
  textSub:     '#52525b',
  textMid:     '#71717a',
};

// ─── שדה קלט מעוצב ───────────────────────────────────────────────────────────
function StyledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  editable,
  secureTextEntry,
  leadingIcon,
  trailingSlot,
  slideAnim,
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
  const opacity    = slideAnim;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], marginBottom: 18 }}>
      <Text style={{ color: '#a1a1aa', fontSize: 13, fontWeight: '600', textAlign: 'right', marginBottom: 8 }}>
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
        {/* leading icon (right/start side in RTL) */}
        <View style={{ paddingEnd: 4 }}>{leadingIcon}</View>

        <TextInput
          style={{
            flex: 1,
            color: '#e4e4e7',
            fontSize: 15,
            paddingVertical: Platform.OS === 'ios' ? 16 : 12,
            textAlign: rtl.textAlign,
            writingDirection: 'rtl',
          }}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#3f3f46"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoCorrect={autoCorrect ?? true}
          editable={editable}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {/* trailing slot (left/end side in RTL) */}
        {trailingSlot && (
          <View style={{ paddingStart: 4 }}>{trailingSlot}</View>
        )}
      </View>
    </Animated.View>
  );
}

// ─── מסך ─────────────────────────────────────────────────────────────────────
export default function SignInScreen() {
  // ── לוגיקה — לא שונה ──────────────────────────────────────────────────────
  const { signIn } = useAuthActions();
  const router = useRouter();
  const { preview } = useLocalSearchParams<{ preview?: string }>();
  const isPreviewMode = IS_DEV_MODE && preview === 'true';

  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [loading,      setLoading]      = useState(false);
  const [rememberMe,   setRememberMe]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const loadRememberedEmail = async () => {
      try {
        const rememberedEmail = await AsyncStorage.getItem(REMEMBERED_EMAIL_KEY);
        if (rememberedEmail) {
          setEmail(rememberedEmail);
          setRememberMe(true);
        }
      } catch {
        // התעלמות משגיאות אחסון
      }
    };
    loadRememberedEmail();
  }, []);

  const persistEmail = async () => {
    if (rememberMe) {
      await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  };

  const handleSignInSuccess = async () => {
    await persistEmail();
    router.replace('/(authenticated)');
  };

  const handleNewUserSuccess = async () => {
    await persistEmail();
    router.replace('/(auth)/onboarding');
  };

  const onSignInPress = async () => {
    if (isPreviewMode) return;
    if (!email || !password) {
      Alert.alert('שגיאה', 'אנא מלא את כל השדות');
      return;
    }
    setLoading(true);
    try {
      await signIn('password', { email, password, flow: 'signIn' });
      await handleSignInSuccess();
    } catch (err: unknown) {
      const error = err as { message?: string };
      const errorMessage = error.message || '';
      if (errorMessage.includes('InvalidAccountId') || errorMessage.includes('Could not find')) {
        try {
          await signIn('password', { email, password, flow: 'signUp' });
          await handleNewUserSuccess();
        } catch (signUpErr: unknown) {
          const signUpError = signUpErr as { message?: string };
          const signUpMsg = signUpError.message || '';
          if (signUpMsg.includes('AccountAlreadyExists')) {
            Alert.alert('שגיאה', 'הסיסמה שגויה לחשבון הקיים');
          } else {
            Alert.alert('שגיאה', 'לא ניתן ליצור חשבון. אנא נסה שוב');
          }
          setLoading(false);
        }
      } else if (errorMessage.includes('InvalidSecret')) {
        Alert.alert('שגיאה', 'הסיסמה שגויה');
        setLoading(false);
      } else if (errorMessage.includes('TooManyRequests')) {
        Alert.alert('שגיאה', 'יותר מדי ניסיונות. נסה שוב מאוחר יותר');
        setLoading(false);
      } else {
        Alert.alert('שגיאה', 'התחברות נכשלה. אנא בדוק את הפרטים ונסה שוב');
        setLoading(false);
      }
    }
  };
  // ── סוף לוגיקה ────────────────────────────────────────────────────────────

  // ── אנימציות ──────────────────────────────────────────────────────────────
  const screenAnim  = useRef(new Animated.Value(0)).current;
  const logoAnim    = useRef(new Animated.Value(0)).current;
  const emailAnim   = useRef(new Animated.Value(0)).current;
  const passAnim    = useRef(new Animated.Value(0)).current;
  const btnAnim     = useRef(new Animated.Value(0)).current;
  const btnScale    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(80, [
      Animated.timing(screenAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(logoAnim,   { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(emailAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(passAnim,   { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(btnAnim,    { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  const btnPressIn  = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start();
  const btnPressOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 35 }).start();

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {isPreviewMode && <PreviewModeBanner onClose={() => router.back()} />}

      {/* gradient glow mist at top */}
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
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: 'rgba(124,58,237,0.13)',
            transform: [{ scaleY: 0.5 }],
          }}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {isPreviewMode && (
          <View style={{ padding: 12, backgroundColor: 'rgba(234,179,8,0.12)', borderBottomWidth: 1, borderBottomColor: 'rgba(234,179,8,0.3)' }}>
            <Text style={{ color: '#facc15', textAlign: 'center', fontSize: 13, fontWeight: '500' }}>
              מצב תצוגה מקדימה - התחברות מושבתת
            </Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: screenAnim }}>

            {/* ── לוגו ממורכז ── */}
            <Animated.View
              style={{
                alignItems: 'center',
                marginBottom: 36,
                opacity: logoAnim,
                transform: [{ translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
              }}
            >
              {/* glow ring */}
              <View
                style={{
                  position: 'absolute',
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: 'rgba(124,58,237,0.15)',
                  transform: [{ scaleX: 1.8 }, { scaleY: 0.9 }],
                  top: 4,
                }}
              />
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 24,
                  backgroundColor: C.purpleFaint,
                  borderWidth: 1,
                  borderColor: C.purpleBdr,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <Image
                  source={require('@/assets/images/logo.png')}
                  style={{ width: 52, height: 52 }}
                  resizeMode="contain"
                />
              </View>
            </Animated.View>

            {/* ── כותרות ── */}
            <View style={{ alignItems: 'center', marginBottom: 36 }}>
              <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
                ברוכים הבאים
              </Text>
              <Text style={{ color: C.textMid, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
                התחבר כדי להתחיל ליצור תוכן חכם
              </Text>
            </View>

            {/* ── שדות קלט ── */}
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
              placeholder="הזן סיסמה"
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

            {/* ── זכור אותי ── */}
            <Animated.View
              style={{
                flexDirection: rtl.flexDirection,
                justifyContent: 'flex-start',
                alignItems: 'center',
                marginBottom: 28,
                opacity: passAnim,
              }}
            >
              <Pressable
                onPress={() => setRememberMe(!rememberMe)}
                disabled={loading}
                style={{ flexDirection: rtl.flexDirection, alignItems: 'center', gap: 8 }}
              >
                <Text style={{ color: '#a1a1aa', fontSize: 14 }}>זכור אותי</Text>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: rememberMe ? C.purple : '#52525b',
                    backgroundColor: rememberMe ? C.purple : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {rememberMe && (
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 14 }}>✓</Text>
                  )}
                </View>
              </Pressable>
            </Animated.View>

            {/* ── כפתור התחברות ── */}
            <Animated.View
              style={{
                transform: [{ scale: btnScale }],
                opacity: btnAnim,
                marginBottom: 24,
              }}
            >
              <Pressable
                onPressIn={btnPressIn}
                onPressOut={btnPressOut}
                onPress={onSignInPress}
                disabled={loading || isPreviewMode}
                style={{
                  backgroundColor: loading || isPreviewMode ? C.purpleDim : C.purple,
                  borderRadius: 20,
                  paddingVertical: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: loading || isPreviewMode ? 0.18 : 0.50,
                  shadowRadius: 20,
                  elevation: 10,
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
                    התחבר
                  </Text>
                )}
              </Pressable>
            </Animated.View>

            {/* ── קישור הרשמה ── */}
            <Animated.View style={{ flexDirection: rtl.flexDirection, justifyContent: 'center', gap: 6, opacity: btnAnim }}>
              <Text style={{ color: C.textMid, fontSize: 14 }}>אין לך חשבון?</Text>
              {isPreviewMode ? (
                <Text style={{ color: '#52525b', fontSize: 14, fontWeight: '600' }}>הירשם</Text>
              ) : (
                <Link href="/(auth)/sign-up" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: C.purple, fontSize: 14, fontWeight: '700' }}>הירשם</Text>
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
