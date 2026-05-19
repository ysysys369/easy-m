import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Settings, Sparkles, Star, Zap } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';

// ─── צבעים ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#0a0a0a',
  card:        '#111114',
  purple:      '#7C3AED',
  purpleFaint: 'rgba(124,58,237,0.12)',
  purpleBdr:   'rgba(124,58,237,0.35)',
  border:      'rgba(63,63,70,0.55)',
  textSub:     '#52525b',
  textMid:     '#71717a',
};

// ─── נתוני ביקורות ──────────────────────────────────────────────────────────
const REVIEWS = [
  { name: 'דנה כהן',    initials: 'ד', color: '#a78bfa', review: 'חסך לי שעות כל שבוע!',                  stars: 5 },
  { name: 'יוסי לוי',   initials: 'י', color: '#34d399', review: 'הפוסטים נראים מקצועיים בטירוף',          stars: 5 },
  { name: 'מאור אברהם', initials: 'מ', color: '#f472b6', review: 'הלקוחות התחילו להגיב יותר מאז שהתחלתי', stars: 5 },
];

// ─── נתוני דוגמאות פוסטים ───────────────────────────────────────────────────
const POST_EXAMPLES = [
  {
    emoji:    '🍕',
    business: 'מסעדה איטלקית',
    tag:      'אוכל ומסעדנות',
    text:     '🍝 מנה חדשה הגיעה!\nריזוטו פטריות עם שמנת כמהין\nרק השבוע — 20% הנחה לשולחנות זוגיים 🕯️\n\n#אוכל #מסעדה #תל_אביב',
  },
  {
    emoji:    '💆',
    business: 'סלון קוסמטיקה',
    tag:      'יופי וטיפוח',
    text:     '✨ טיפול חדש הגיע לסלון!\nטיפול פנים עם היאלורון + קולגן\nתורים פנויים לשבוע הקרוב 📅\n\n#יופי #קוסמטיקה #טיפולים',
  },
  {
    emoji:    '🏋️',
    business: 'חדר כושר',
    tag:      'כושר ובריאות',
    text:     '💪 אתגר 30 יום מתחיל ביום שני!\nהצטרף עכשיו וקבל חודש ראשון במחצית המחיר\n🔥 מקומות מוגבלים!\n\n#כושר #אימון #בריאות',
  },
];

// ─── כרטיס ביקורת ────────────────────────────────────────────────────────────
function ReviewCard({ item }: { item: (typeof REVIEWS)[number] }) {
  return (
    <View
      style={{
        width: 230,
        backgroundColor: C.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: C.purpleBdr,
        padding: 16,
        marginLeft: 12,
        shadowColor: C.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
      }}
    >
      {/* כוכבים */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 2, marginBottom: 10 }}>
        {Array.from({ length: item.stars }).map((_, i) => (
          <Star key={i} size={13} color="#f59e0b" fill="#f59e0b" />
        ))}
      </View>

      {/* טקסט ביקורת */}
      <Text
        style={{
          color: '#e4e4e7',
          fontSize: 14,
          lineHeight: 22,
          textAlign: 'right',
          marginBottom: 14,
          flex: 1,
        }}
      >
        "{item.review}"
      </Text>

      {/* פרופיל */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        <Text style={{ color: '#a1a1aa', fontSize: 13, fontWeight: '600' }}>{item.name}</Text>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: item.color + '28',
            borderWidth: 1.5,
            borderColor: item.color + '55',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: item.color, fontSize: 14, fontWeight: '700' }}>{item.initials}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── כרטיס פוסט לדוגמה ───────────────────────────────────────────────────────
function PostCard({ item, delay }: { item: (typeof POST_EXAMPLES)[number]; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, []);

  const opacity    = anim;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], marginBottom: 12 }}>
      <View
        style={{
          backgroundColor: C.card,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: C.purpleBdr,
          overflow: 'hidden',
          shadowColor: C.purple,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.16,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        {/* שורת כותרת הכרטיס */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: C.border,
          }}
        >
          <View>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'right' }}>
              {item.business}
            </Text>
            <Text style={{ color: C.textMid, fontSize: 11, textAlign: 'right' }}>{item.tag}</Text>
          </View>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: C.purpleFaint,
              borderWidth: 1,
              borderColor: C.purpleBdr,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
          </View>
        </View>

        {/* גוף הפוסט */}
        <View style={{ padding: 16 }}>
          <Text style={{ color: '#d4d4d8', fontSize: 14, lineHeight: 22, textAlign: 'right' }}>
            {item.text}
          </Text>
        </View>

        {/* תווית AI */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: 16,
            paddingBottom: 14,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: C.purpleFaint,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: C.purpleBdr,
            }}
          >
            <Sparkles size={11} color={C.purple} />
            <Text style={{ color: '#a78bfa', fontSize: 11, fontWeight: '600' }}>
              נוצר על ידי AI
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── מסך ראשי ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const user = useQuery(api.users.getCurrentUser);
  const displayName = user?.fullName || user?.email?.split('@')[0] || 'משתמש';
  const avatarInitial = (displayName.trim()[0] ?? '?').toUpperCase();

  // אנימציית לחיצה לכפתור הראשי — PRESERVED
  const btnScale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  // אנימציות כניסה
  const headerAnim   = useRef(new Animated.Value(0)).current;
  const btnAnim      = useRef(new Animated.Value(0)).current;
  const featuresAnim = useRef(new Animated.Value(0)).current;
  const reviewsAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(headerAnim,   { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(btnAnim,      { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(featuresAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(reviewsAnim,  { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
  }, []);

  const slideUp = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: 12 }}>

          {/* ─── Top bar: settings (left) + avatar (right) ─── */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              marginBottom: 28,
            }}
          >
            <Pressable
              accessibilityLabel="הגדרות"
              onPress={() => router.push('/(authenticated)/settings')}
              style={{
                width: 40, height: 40, borderRadius: 14,
                backgroundColor: C.card,
                borderWidth: 1, borderColor: C.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Settings size={18} color={C.textMid} />
            </Pressable>

            <Pressable
              accessibilityLabel="פרופיל"
              onPress={() => router.push('/(authenticated)/settings')}
              style={{
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: C.purpleFaint,
                borderWidth: 1.5, borderColor: C.purpleBdr,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: C.purple, shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.35, shadowRadius: 8, elevation: 4,
              }}
            >
              <Text style={{ color: '#a78bfa', fontSize: 16, fontWeight: '800' }}>
                {avatarInitial}
              </Text>
            </Pressable>
          </View>

          {/* ─── Greeting ─── */}
          <Animated.View
            style={{
              opacity: headerAnim,
              transform: [{ translateY: slideUp(headerAnim) }],
              paddingHorizontal: 20,
              marginBottom: 22,
            }}
          >
            <Text
              style={{ color: '#fff', fontSize: 32, fontWeight: '800', textAlign: 'right', marginBottom: 8 }}
            >
              {user ? `שלום, ${displayName} 👋` : 'ברוכים הבאים 👋'}
            </Text>
            <Text style={{ color: C.textMid, fontSize: 15, textAlign: 'right', lineHeight: 22 }}>
              מוכן ליצור פוסט חדש היום?
            </Text>
          </Animated.View>

          {/* ─── Primary CTA ─── */}
          <Animated.View
            style={{
              opacity: btnAnim,
              transform: [{ translateY: slideUp(btnAnim) }],
              paddingHorizontal: 20,
              marginBottom: 8,
            }}
          >
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                onPress={() => router.push('/(authenticated)/create')}
                style={{
                  backgroundColor: C.purple,
                  borderRadius: 22,
                  paddingVertical: 18,
                  paddingHorizontal: 24,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.50,
                  shadowRadius: 20,
                  elevation: 12,
                }}
              >
                <Zap size={20} color="#fff" fill="#fff" />
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
                  צור פוסט ראשון בחינם ⚡
                </Text>
              </Pressable>
            </Animated.View>
            <Text style={{ color: C.textSub, fontSize: 12, textAlign: 'center', marginTop: 10 }}>
              ללא כרטיס אשראי • חינם לתמיד
            </Text>
            <Pressable
              onPress={() => router.push('/(auth)/onboarding')}
              style={{ marginTop: 14, alignItems: 'center' }}
            >
              <Text style={{ color: C.purple, fontSize: 14, fontWeight: '600' }}>
                צפה בסיור מהיר ←
              </Text>
            </Pressable>
          </Animated.View>

          {/* ─── כרטיסי יתרונות ─── */}
          <Animated.View
            style={{
              opacity: featuresAnim,
              transform: [{ translateY: slideUp(featuresAnim) }],
              flexDirection: 'row',
              gap: 10,
              paddingHorizontal: 20,
              marginTop: 24,
              marginBottom: 36,
            }}
          >
            {[
              { icon: '✍️', title: 'כתיבה חכמה',   desc: 'AI שמכיר את העסק שלך' },
              { icon: '📅', title: 'תזמון פוסטים', desc: 'פרסם בזמן הנכון'       },
              { icon: '📊', title: 'ניתוח ביצועים', desc: 'עקוב אחרי התוצאות'    },
            ].map((item) => (
              <View
                key={item.title}
                style={{
                  flex: 1,
                  backgroundColor: C.card,
                  borderWidth: 1,
                  borderColor: C.purpleBdr,
                  borderRadius: 18,
                  padding: 12,
                  alignItems: 'center',
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.12,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</Text>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 3 }}>
                  {item.title}
                </Text>
                <Text style={{ color: C.textMid, fontSize: 10, textAlign: 'center', lineHeight: 14 }}>
                  {item.desc}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* ─── ביקורות ─── */}
          <Animated.View
            style={{
              opacity: reviewsAnim,
              transform: [{ translateY: slideUp(reviewsAnim) }],
              marginBottom: 36,
            }}
          >
            {/* כותרת סקשן */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                paddingHorizontal: 20,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
                מה אומרים עלינו
              </Text>
              <Text style={{ fontSize: 20 }}>💬</Text>
            </View>

            {/* scroll אופקי */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 8, paddingRight: 20 }}
            >
              {REVIEWS.map((item) => (
                <ReviewCard key={item.name} item={item} />
              ))}
            </ScrollView>
          </Animated.View>

          {/* ─── דוגמאות פוסטים ─── */}
          <View style={{ paddingHorizontal: 20 }}>
            {/* כותרת סקשן */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>
                דוגמאות לפוסטים
              </Text>
              <Text style={{ fontSize: 20 }}>✨</Text>
            </View>

            {POST_EXAMPLES.map((item, i) => (
              <PostCard key={item.business} item={item} delay={i * 120} />
            ))}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
