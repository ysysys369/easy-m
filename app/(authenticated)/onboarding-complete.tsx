import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, Sparkles, Star, TrendingUp, Wand2 } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rtl } from '@/lib/rtl';

const C = {
  bg:         '#0a0a0a',
  card:       '#111114',
  purple:     '#7C3AED',
  purpleFaint:'rgba(124,58,237,0.12)',
  purpleMid:  'rgba(124,58,237,0.22)',
  purpleBdr:  'rgba(124,58,237,0.38)',
  textSub:    '#a1a1aa',
  textDim:    '#52525b',
};

const BENEFITS: { icon: typeof Star; text: string }[] = [
  { icon: Star,      text: 'פוסטים שמתאימים לעסק שלך'    },
  { icon: Wand2,     text: 'טקסטים בשפה ובסגנון שלך'     },
  { icon: TrendingUp,text: 'תוצאות יפות ומכירתיות יותר'  },
];

export default function OnboardingComplete() {
  const router = useRouter();

  const iconAnim   = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardsAnim  = useRef(new Animated.Value(0)).current;
  const ctaAnim    = useRef(new Animated.Value(0)).current;
  const btnScale   = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  useEffect(() => {
    Animated.sequence([
      Animated.spring(iconAnim,   { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 14 }),
      Animated.timing(headerAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(cardsAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(ctaAnim,    { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, []);

  const slideUp = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
    ],
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 28,
        }}
      >
        {/* ── Icon ── */}
        <Animated.View
          style={{
            marginBottom: 32,
            transform: [{ scale: iconAnim }],
            opacity: iconAnim,
          }}
        >
          <LinearGradient
            colors={['rgba(124,58,237,0.32)', 'rgba(124,58,237,0.10)']}
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: C.purpleBdr,
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.45,
              shadowRadius: 22,
            }}
          >
            <Sparkles size={38} color={C.purple} />
          </LinearGradient>
        </Animated.View>

        {/* ── Title + subtitle ── */}
        <Animated.View
          style={[slideUp(headerAnim), { alignItems: 'center', marginBottom: 32, width: '100%' }]}
        >
          <Text
            style={{
              color: '#ffffff',
              fontSize: 30,
              fontWeight: '900',
              textAlign: 'center',
              writingDirection: 'rtl',
              marginBottom: 12,
            }}
          >
            כמעט סיימנו
          </Text>
          <Text
            style={{
              color: C.textSub,
              fontSize: 15,
              lineHeight: 24,
              textAlign: 'center',
              writingDirection: 'rtl',
            }}
          >
            {'כדי ש-Easy-M יוכל ליצור פוסטים מדויקים\nלעסק שלך, צריך להכיר את העסק קצת יותר טוב.'}
          </Text>
        </Animated.View>

        {/* ── Benefit cards ── */}
        <Animated.View
          style={[slideUp(cardsAnim), { width: '100%', gap: 10, marginBottom: 44 }]}
        >
          {BENEFITS.map(({ icon: Icon, text }) => (
            <View
              key={text}
              style={{
                backgroundColor: C.card,
                borderWidth: 1,
                borderColor: C.purpleBdr,
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 18,
                flexDirection: rtl.flexDirection,
                alignItems: 'center',
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: C.purpleFaint,
                  borderWidth: 1,
                  borderColor: 'rgba(124,58,237,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={17} color={C.purple} />
              </View>
              <Text
                style={{
                  color: '#f4f4f5',
                  fontSize: 14,
                  fontWeight: '600',
                  textAlign: rtl.textAlign,
                  writingDirection: 'rtl',
                  flex: 1,
                }}
              >
                {text}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* ── CTA ── */}
        <Animated.View style={[slideUp(ctaAnim), { width: '100%', alignItems: 'center' }]}>
          <Animated.View
            style={{
              width: '100%',
              transform: [{ scale: btnScale }],
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.55,
              shadowRadius: 24,
              elevation: 14,
              borderRadius: 18,
            }}
          >
            <Pressable
              onPress={() => router.replace('/(authenticated)/business-profile')}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              accessible
              accessibilityRole="button"
              accessibilityLabel="מלא את פרטי העסק"
              style={{ borderRadius: 18, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={['#9333ea', '#7C3AED', '#6d28d9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: 19,
                  paddingHorizontal: 28,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <Text
                  style={{
                    color: '#ffffff',
                    fontSize: 18,
                    fontWeight: '900',
                    letterSpacing: 0.3,
                  }}
                >
                  מלא את פרטי העסק
                </Text>
                <ChevronLeft size={20} color="#ffffff" strokeWidth={2.5} />
              </LinearGradient>
            </Pressable>
          </Animated.View>
          <Text
            style={{
              color: C.textDim,
              fontSize: 13,
              marginTop: 16,
              textAlign: 'center',
            }}
          >
            זה לוקח פחות מדקה
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}
