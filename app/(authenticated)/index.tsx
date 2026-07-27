import { useAction, useConvexAuth, useMutation, useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  CalendarDays,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Settings,
  Sparkles,
  Star,
  Wand2,
  Zap,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { IS_DEV_MODE } from '@/config/appConfig';
import { useDevUiOverride } from '@/contexts/DevUiOverrideContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { rtl } from '@/lib/rtl';

// ─── צבעים ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  card: '#111114',
  purple: '#7C3AED',
  purpleFaint: 'rgba(124,58,237,0.12)',
  purpleBdr: 'rgba(124,58,237,0.35)',
  border: 'rgba(63,63,70,0.55)',
  textSub: '#52525b',
  textMid: '#71717a',
};

const HOME_ROW = 'row-reverse' as const;
const HOME_DIRECTION = 'ltr' as const;

// ─── נתוני ביקורות ──────────────────────────────────────────────────────────
const REVIEWS = [
  {
    name: 'דנה כהן',
    initials: 'ד',
    color: '#a78bfa',
    review: 'חסך לי שעות כל שבוע!',
    stars: 5,
  },
  {
    name: 'יוסי לוי',
    initials: 'י',
    color: '#34d399',
    review: 'הפוסטים נראים מקצועיים בטירוף',
    stars: 5,
  },
  {
    name: 'מאור אברהם',
    initials: 'מ',
    color: '#f472b6',
    review: 'הלקוחות התחילו להגיב יותר מאז שהתחלתי',
    stars: 5,
  },
];

// ─── Showcase post examples — real AI-generated marketing creatives ─────────
// Two-section card: clean image section on top + unified dark content section
// below. Each card keeps its identity via a single brand-accent color used on
// the hashtag pills and attribution badge. Panel itself stays Easy-M dark.
type ShowcaseCaption = {
  headline: string;
  description: string;
  hashtags: string[];
  accent: string; // single brand-accent color (used for pills + badge)
  footer: string;
};

type ShowcaseCard = {
  kind: 'pizza' | 'beauty' | 'fitness' | 'hot-sauce' | 'easym';
  chip: string;
  chipEmoji: string;
  source: ImageSourcePropType;
  imageResizeMode?: 'cover' | 'contain';
  imageBackgroundColor?: string;
  caption: ShowcaseCaption;
};

const SHOWCASE: ShowcaseCard[] = [
  {
    kind: 'pizza',
    chip: 'מסעדת פיצה',
    chipEmoji: '🍕',
    source: require('@/assets/images/showcase/pizza.png'),
    caption: {
      headline: 'פיצה שבאמת עושה חשק',
      description: 'חומרי גלם איכותיים. גבינה נמתחת.\nטעם שאי אפשר לשכוח.',
      hashtags: ['#פיצה', '#פיצהחמה', '#טעים', '#מסעדה', '#easyM'],
      accent: '#fbbf24', // amber
      footer: 'easyM יצר את זה',
    },
  },
  {
    kind: 'beauty',
    chip: 'סלון קוסמטיקה',
    chipEmoji: '💄',
    source: require('@/assets/images/showcase/beauty.png'),
    caption: {
      headline: 'היופי שלך מתחיל כאן ✨',
      description: 'טיפולי פנים מקצועיים,\nזוהר טבעי ותוצאות שאוהבים לראות.',
      hashtags: ['#קוסמטיקה', '#טיפוח', '#beauty', '#קליניקה', '#easyM'],
      accent: '#f9a8d4', // soft pink
      footer: 'easyM יצר את זה',
    },
  },
  {
    kind: 'fitness',
    chip: 'מאמן כושר',
    chipEmoji: '💪',
    source: require('@/assets/images/showcase/fitness.png'),
    caption: {
      headline: 'חזק יותר בכל יום 🔥',
      description: 'אימונים אישיים.\nתוצאות אמיתיות.\nהגיע הזמן להתחיל.',
      hashtags: ['#כושר', '#fitness', '#אימונים', '#gym', '#easyM'],
      accent: '#ef4444', // red
      footer: 'easyM יצר את זה',
    },
  },
  {
    kind: 'hot-sauce',
    chip: 'רטבים חריפים',
    chipEmoji: '🌶️',
    source: require('@/assets/images/showcase/hot-sauce.png'),
    caption: {
      headline: 'הטעם שמדליק את כולם 🌶️🔥',
      description: 'רטבים חריפים עם אופי אמיתי.\nטעם שלא שוכחים.',
      hashtags: ['#חריף', '#רטבים', '#spicy', '#food', '#easyM'],
      accent: '#f97316', // flame orange
      footer: 'easyM יצר את זה',
    },
  },
  {
    kind: 'easym',
    chip: 'easyM',
    chipEmoji: '🚀',
    source: require('@/assets/images/showcase/easym-hero.png'),
    imageResizeMode: 'contain',
    imageBackgroundColor: '#090611',
    caption: {
      headline: 'השיווק של העסק שלך מתחיל כאן 🚀',
      description: 'תוכן, עיצוב ושיווק — הכל במקום אחד.',
      hashtags: ['#easyM', '#שיווק', '#עסקים', '#AI', '#socialmedia'],
      accent: '#c084fc',
      footer: '✨ easyM יצר את זה',
    },
  },
];

// Convert a hex color "#RRGGBB" → "rgba(r,g,b,a)" — used for pill backgrounds
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
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
        shadowColor: C.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
      }}
    >
      {/* כוכבים — right-anchored: 'row' auto-flips in native RTL, flex-start = physical right */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-start',
          gap: 2,
          marginBottom: 10,
        }}
      >
        {Array.from({ length: item.stars }).map((_, i) => (
          <Star
            key={`${item.name}-${i + 1}`}
            size={13}
            color="#f59e0b"
            fill="#f59e0b"
          />
        ))}
      </View>

      {/* טקסט ביקורת — textAlign:'left' = physical right in native RTL */}
      <Text
        style={{
          color: '#e4e4e7',
          fontSize: 14,
          lineHeight: 22,
          textAlign: 'left',
          marginBottom: 14,
          flex: 1,
        }}
      >
        "{item.review}"
      </Text>

      {/* פרופיל — name first (physical right), avatar second (to its left) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 8,
        }}
      >
        <Text style={{ color: '#a1a1aa', fontSize: 13, fontWeight: '600' }}>
          {item.name}
        </Text>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: `${item.color}28`,
            borderWidth: 1.5,
            borderColor: `${item.color}55`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: item.color, fontSize: 14, fontWeight: '700' }}>
            {item.initials}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Premium showcase: real AI-generated posts ─────────────────────────────
// We keep the EXACT same card chrome from the gradient version
// (rounded corners, purple glow, spring entrance animation, chip below)
// and swap the inner content for the actual rendered creative.

// Unified dark content panel (consistent with Easy-M brand)
const CONTENT_BG = '#0f0f12';
const CONTENT_TEXT = '#fafafa';
const CONTENT_MUTED = '#a1a1aa';

const CARD_W = 280;
const IMAGE_H = 340; // slightly taller so the full poster can breathe
const CONTENT_H = 240; // keep total card height balanced on mobile
const CARD_H = IMAGE_H + CONTENT_H;

function ShowcasePostCard({
  item,
  delay,
}: {
  item: ShowcaseCard;
  delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 12,
      bounciness: 5,
      delay,
    }).start();
  }, [anim, delay]);

  const opacity = anim;
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 0],
  });
  const pressIn = () =>
    Animated.spring(press, {
      toValue: 1.03,
      useNativeDriver: true,
      speed: 35,
    }).start();
  const pressOut = () =>
    Animated.spring(press, {
      toValue: 1,
      useNativeDriver: true,
      speed: 25,
    }).start();

  return (
    <Animated.View
      style={{ opacity, transform: [{ translateY }], alignItems: 'center' }}
    >
      {/* The post card — image + marketing caption inside the same premium chrome */}
      <Animated.View style={{ transform: [{ scale: press }] }}>
        <Pressable
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={{
            width: CARD_W,
            height: CARD_H,
            borderRadius: 22,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: C.purpleBdr,
            backgroundColor: C.card,
            // Deep purple glow shadow (iOS) + elevation (Android)
            shadowColor: C.purple,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.45,
            shadowRadius: 22,
            elevation: 14,
          }}
        >
          {/* ══ IMAGE SECTION (top) ══ */}
          <View
            style={{
              height: IMAGE_H,
              backgroundColor: item.imageBackgroundColor ?? '#000',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 10,
              paddingTop: 10,
            }}
          >
            <Image
              source={item.source}
              style={{
                width: '100%',
                height: '100%',
              }}
              resizeMode={item.imageResizeMode ?? 'contain'}
              accessibilityLabel={item.chip}
            />
            {/* Subtle bottom fade — softly blends the image into the dark
                content panel below, creating a premium separation */}
            <LinearGradient
              colors={['transparent', 'transparent', CONTENT_BG]}
              locations={[0, 0.7, 1]}
              style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                height: 60,
              }}
              pointerEvents="none"
            />
          </View>

          {/* ══ CONTENT SECTION (bottom — unified Easy-M dark) ══ */}
          <View
            style={{
              height: CONTENT_H,
              backgroundColor: CONTENT_BG,
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 14,
              justifyContent: 'space-between',
            }}
          >
            {/* Headline + description */}
            <View>
              <Text
                numberOfLines={2}
                style={{
                  color: CONTENT_TEXT,
                  fontSize: 18,
                  fontWeight: '800',
                  lineHeight: 24,
                  textAlign: 'right',
                  marginBottom: 10,
                  letterSpacing: -0.2,
                }}
              >
                {item.caption.headline}
              </Text>
              <Text
                numberOfLines={item.kind === 'easym' ? 2 : 3}
                style={{
                  color: CONTENT_MUTED,
                  fontSize: 12.5,
                  fontWeight: '500',
                  lineHeight: 19,
                  textAlign: 'right',
                }}
              >
                {item.caption.description}
              </Text>
            </View>

            {/* Hashtag pills — wrap, RTL-aligned */}
            <View
              style={{
                flexDirection: HOME_ROW,
                direction: HOME_DIRECTION,
                flexWrap: 'wrap',
                gap: 6,
                justifyContent: 'flex-end',
              }}
            >
              {item.caption.hashtags.map((tag) => (
                <View
                  key={tag}
                  style={{
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 8,
                    backgroundColor: hexToRgba(item.caption.accent, 0.1),
                    borderWidth: 1,
                    borderColor: hexToRgba(item.caption.accent, 0.45),
                  }}
                >
                  <Text
                    style={{
                      color: item.caption.accent,
                      fontSize: 11,
                      fontWeight: '700',
                    }}
                  >
                    {tag}
                  </Text>
                </View>
              ))}
            </View>

            {/* Footer badge */}
            <View
              style={{
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.06)',
                flexDirection: HOME_ROW,
                direction: HOME_DIRECTION,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: item.caption.accent,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.3,
                }}
              >
                {item.caption.footer}
              </Text>
              {item.kind !== 'easym' && (
                <Sparkles size={11} color={item.caption.accent} />
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* Category chip below the card */}
      <View
        style={{
          marginTop: 14,
          flexDirection: HOME_ROW,
          direction: HOME_DIRECTION,
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.purpleBdr,
        }}
      >
        <Text style={{ color: '#e4e4e7', fontSize: 12, fontWeight: '600' }}>
          {item.chip}
        </Text>
        <Text style={{ fontSize: 13 }}>{item.chipEmoji}</Text>
      </View>
    </Animated.View>
  );
}
// ─── מסך ראשי ────────────────────────────────────────────────────────────────
// ─── Weekly AI Suggestions section ───────────────────────────────────────────
// Lightweight premium card row that surfaces 3–5 AI-generated post ideas per
// week. Tapping a card marks the suggestion used and routes to the existing
// Create Post flow with the topic pre-filled.
//
// Future-ready: today we only render the 'weekly' kind. Adding holiday,
// trend, seasonal, reminder, or campaign kinds is a matter of adding a new
// query / action and reusing this card pattern.

type AiSuggestionDoc = Doc<'aiSuggestions'>;
type HomePostDoc = Doc<'posts'> & {
  captionText?: string;
};

const VISUAL_STYLE_LABELS: Record<string, { label: string; tint: string }> = {
  premium: { label: 'פרימיום', tint: '#a78bfa' },
  bold: { label: 'בולט', tint: '#fb7185' },
  elegant: { label: 'אלגנטי', tint: '#f0abfc' },
  dramatic: { label: 'דרמטי', tint: '#fbbf24' },
  minimal: { label: 'מינימליסטי', tint: '#9ca3af' },
  luxury: { label: 'יוקרתי', tint: '#fbbf24' },
  friendly: { label: 'ידידותי', tint: '#4ade80' },
  energetic: { label: 'אנרגטי', tint: '#22d3ee' },
};

function labelForVisualStyle(style: string): { label: string; tint: string } {
  return (
    VISUAL_STYLE_LABELS[style] ?? { label: style || 'מותאם', tint: '#a78bfa' }
  );
}

// ─── WeeklySuggestionCard ─────────────────────────────────────────────────────
// Fresh build. Hebrew-first layout. No RTL hacks.
// Badge top-right, title/desc right-aligned, CTA bottom-right.
// Achieved with explicit justifyContent/alignItems — no row-reverse, no transforms.

function WeeklySuggestionCard({
  suggestion,
  onUse,
  width,
}: {
  suggestion: AiSuggestionDoc;
  onUse: (s: AiSuggestionDoc) => void;
  width: number;
}) {
  const { label, tint } = labelForVisualStyle(suggestion.visualStyle);
  const used = suggestion.used;

  return (
    <View
      style={{
        width,
        backgroundColor: '#111114',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.3)',
        paddingVertical: 20,
        paddingHorizontal: 20,
        alignItems: 'stretch',
        opacity: used ? 0.55 : 1,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 5,
      }}
    >
      {/* Badge: pill first on the RTL start side, icon next to it. */}
      <View
        style={{
          flexDirection: rtl.flexDirection,
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: 6,
          marginBottom: 16,
        }}
      >
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: hexToRgba(tint, 0.12),
            borderWidth: 1,
            borderColor: hexToRgba(tint, 0.38),
          }}
        >
          <Text style={{ color: tint, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 }}>
            {label}
          </Text>
        </View>
        <Sparkles size={12} color={tint} />
      </View>

      <Text
        numberOfLines={2}
        style={{
          color: '#ffffff',
          fontSize: 18,
          fontWeight: '800',
          textAlign: rtl.textAlign,
          writingDirection: 'rtl',
          lineHeight: 26,
          marginBottom: 10,
        }}
      >
        {suggestion.title}
      </Text>

      <Text
        numberOfLines={3}
        style={{
          color: '#71717a',
          fontSize: 13,
          textAlign: rtl.textAlign,
          writingDirection: 'rtl',
          lineHeight: 20,
          marginBottom: 24,
        }}
      >
        {suggestion.description}
      </Text>

      <View style={{ alignItems: 'flex-end', alignSelf: 'stretch' }}>
        <Pressable
          onPress={() => onUse(suggestion)}
          disabled={used}
          accessibilityRole="button"
          accessibilityLabel={used ? 'פוסט נוצר' : 'צור פוסט מההצעה'}
          style={({ pressed }) => ({
            flexDirection: rtl.flexDirection,
            alignItems: 'center',
            gap: 8,
            backgroundColor: used ? 'rgba(124,58,237,0.25)' : C.purple,
            paddingVertical: 13,
            paddingHorizontal: 22,
            borderRadius: 50,
            borderWidth: 1,
            borderColor: used ? 'rgba(124,58,237,0.3)' : 'rgba(200,170,255,0.55)',
            opacity: pressed ? 0.78 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            shadowColor: '#7C3AED',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: used ? 0.15 : 0.85,
            shadowRadius: 20,
            elevation: 12,
          })}
        >
          <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 }}>
            {used ? 'נוצר ✓' : 'צור פוסט'}
          </Text>
          {!used && <Zap size={15} color="#ffffff" fill="#ffffff" />}
        </Pressable>
      </View>
    </View>
  );
}

// ─── WeeklyAiSuggestionsSection ───────────────────────────────────────────────
// RTL horizontal suggestions list. First card is rightmost and fully visible.
// Cards snap one-at-a-time.

function WeeklyAiSuggestionsSection({ anim }: { anim: Animated.Value }) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  // Card fills the viewport minus 20px gutter on each side.
  // snapToInterval = cardWidth + gap so each swipe reveals exactly one card.
  const CARD_W = screenWidth - 40;
  const CARD_GAP = 14;

  const businessProfile = useQuery(api.businessProfiles.getMyBusinessProfile);
  const suggestions = useQuery(api.aiSuggestionStore.getMyCurrentWeekSuggestions);
  const weeklyStatus = useQuery(api.users.getWeeklyPostStatus);
  const generate = useAction(api.aiSuggestionsActions.generateWeeklySuggestions);
  const markUsed = useMutation(api.aiSuggestionStore.markSuggestionUsed);

  const { isPremium } = useRevenueCat();
  const { uiOverride } = useDevUiOverride();
  const effectiveIsPremiumSuggestions =
    IS_DEV_MODE && uiOverride === 'free' ? false
    : IS_DEV_MODE && uiOverride === 'premium' ? true
    : isPremium;
  // Trust the backend's authoritative `remaining` field. It already reflects
  // per-user-type limits (paid: 3/week, free: 1 lifetime) so we do not need
  // to re-derive the split on the client. Prevents a race where RC's
  // isPremium transiently disagrees with the DB userType.
  const isQuotaBlocked =
    weeklyStatus !== undefined && weeklyStatus.remaining <= 0;

  const [generating, setGenerating] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);

  const hasProfile = Boolean(businessProfile?.businessName);
  const isLoading = suggestions === undefined;
  const isEmpty = !isLoading && suggestions.length === 0;

  // Suggestions are stale when the business profile was saved after the current
  // batch was generated (e.g. user changed business type or name). Force
  // regeneration so the new profile is reflected immediately.
  const suggestionsAreStale =
    !isLoading &&
    suggestions !== undefined &&
    suggestions.length > 0 &&
    (businessProfile as any)?.updatedAt !== undefined &&
    suggestions.every((s) => s.createdAt < ((businessProfile as any).updatedAt ?? 0));

  useEffect(() => {
    if (!hasProfile || isLoading || generating || autoTriggered) return;
    if (suggestions?.length === 0 || suggestionsAreStale) {
      setAutoTriggered(true);
      setGenerating(true);
      generate({})
        .catch(() => console.warn('Auto-generate weekly suggestions failed'))
        .finally(() => setGenerating(false));
    }
  }, [hasProfile, isLoading, generating, autoTriggered, suggestions, generate, suggestionsAreStale]);

  const handleRefresh = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      await generate({});
    } catch (err) {
      const msg = String(err);
      if (msg.includes('NO_BUSINESS_PROFILE')) {
        Alert.alert('פרופיל עסקי חסר', 'כדי לקבל הצעות שיווק, השלם קודם את פרופיל העסק.');
      } else {
        Alert.alert('שגיאה', 'לא הצלחנו לרענן הצעות כרגע. נסה שוב בעוד רגע.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleUse = async (s: AiSuggestionDoc) => {
    if (isQuotaBlocked) {
      router.push('/(authenticated)/paywall');
      return;
    }
    if (!s.used) {
      markUsed({ suggestionId: s._id as Id<'aiSuggestions'> }).catch(() => {});
    }
    router.push({ pathname: '/(authenticated)/create', params: { topic: s.description } });
  };

  if (!hasProfile) return null;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        marginBottom: 28,
      }}
    >
      {/* ── Section header ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          marginBottom: 16,
        }}
      >
        {/* Title + icon */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: rtl.textAlign, writingDirection: 'rtl' }}>
              הצעות שיווק שבועיות
            </Text>
            <Text style={{ color: C.textMid, fontSize: 11, marginTop: 2, textAlign: rtl.textAlign, writingDirection: 'rtl' }}>
              מותאם אישית לעסק שלך
            </Text>
          </View>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: C.purpleFaint,
              borderWidth: 1,
              borderColor: C.purpleBdr,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wand2 size={17} color={C.purple} />
          </View>
        </View>

        {/* Refresh button — second JSX child = physical left in native RTL */}
        <Pressable
          onPress={handleRefresh}
          disabled={generating}
          accessibilityLabel="רענן הצעות"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.purpleBdr,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating
            ? <ActivityIndicator size="small" color={C.purple} />
            : <RefreshCw size={15} color={C.purple} />}
        </Pressable>
      </View>

      {/* ── States ── */}
      {isLoading || (isEmpty && generating) ? (
        <View
          style={{
            marginHorizontal: 20,
            padding: 28,
            borderRadius: 20,
            backgroundColor: '#111114',
            borderWidth: 1,
            borderColor: 'rgba(63,63,70,0.55)',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <ActivityIndicator color={C.purple} />
          <Text style={{ color: C.textMid, fontSize: 13, textAlign: rtl.textAlign, writingDirection: 'rtl', alignSelf: 'stretch' }}>
            יוצרים לך 3-5 רעיונות מותאמים אישית...
          </Text>
        </View>
      ) : isEmpty ? (
        <View
          style={{
            marginHorizontal: 20,
            padding: 24,
            borderRadius: 20,
            backgroundColor: '#111114',
            borderWidth: 1,
            borderColor: 'rgba(124,58,237,0.3)',
            gap: 8,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', textAlign: rtl.textAlign, writingDirection: 'rtl' }}>
            עוד אין הצעות לשבוע
          </Text>
          <Text style={{ color: C.textMid, fontSize: 13, textAlign: rtl.textAlign, writingDirection: 'rtl', lineHeight: 19 }}>
            לחץ על כפתור הרענון כדי לקבל רעיונות שיווקיים מותאמים אישית
          </Text>
        </View>
      ) : (
        /* ── RTL carousel ──────────────────────────────────────────────────
           Horizontal list starts from the right. The first card fills the
           content width, so no neighboring card is clipped on initial load. */
        <FlatList
          horizontal
          inverted
          data={suggestions ?? []}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <WeeklySuggestionCard
              suggestion={item}
              onUse={handleUse}
              width={CARD_W}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          snapToInterval={CARD_W + CARD_GAP}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          getItemLayout={(_, index) => ({
            length: CARD_W + CARD_GAP,
            offset: (CARD_W + CARD_GAP) * index,
            index,
          })}
        />
      )}
    </Animated.View>
  );
}

function formatHomeDate(timestamp: number): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(timestamp));
}

function DashboardStatsSection({
  posts,
  weeklyStatus,
  isPremium,
}: {
  posts: HomePostDoc[] | undefined;
  weeklyStatus:
    | { used: number; remaining: number; limit: number; resetAt: number }
    | undefined;
  isPremium: boolean;
}) {
  const postCount = posts?.length ?? 0;
  const weeklyUsed = weeklyStatus?.used ?? 0;
  const weeklyLimit = weeklyStatus?.limit ?? 3;
  const latestPostDate = posts?.[0]?.createdAt
    ? formatHomeDate(posts[0].createdAt)
    : 'עוד אין';

  const freePostUsed = !isPremium && weeklyUsed > 0;
  const weeklyStatValue = isPremium
    ? `${weeklyUsed}/${weeklyLimit}`
    : freePostUsed ? '0' : '1';
  const weeklyStatLabel = isPremium ? 'השבוע' : 'פוסט חינם';

  return (
    <View
      style={{
        flexDirection: HOME_ROW,
        direction: HOME_DIRECTION,
        gap: 10,
        paddingHorizontal: 20,
        marginTop: 22,
        marginBottom: 30,
      }}
    >
      {[
        {
          icon: FileText,
          value: String(postCount),
          label: 'פוסטים שנוצרו',
          tint: '#a78bfa',
        },
        {
          icon: BarChart3,
          value: weeklyStatValue,
          label: weeklyStatLabel,
          tint: '#22d3ee',
        },
        {
          icon: CalendarDays,
          value: latestPostDate,
          label: 'פוסט אחרון',
          tint: '#f472b6',
        },
      ].map((item) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 92,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 18,
            padding: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 11,
              backgroundColor: hexToRgba(item.tint, 0.12),
              borderWidth: 1,
              borderColor: hexToRgba(item.tint, 0.35),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <item.icon size={15} color={item.tint} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '900',
                textAlign: 'center',
              }}
            >
              {item.value}
            </Text>
            <Text
              style={{ color: C.textMid, fontSize: 10, textAlign: 'center' }}
            >
              {item.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function QuickActionsSection() {
  const router = useRouter();
  const actions = [
    {
      title: 'צור פוסט',
      subtitle: 'מודעה חדשה לעסק',
      icon: Zap,
      onPress: () => router.push('/(authenticated)/create'),
    },
    {
      title: 'הפוסטים שלי',
      subtitle: 'צפייה ושיתוף',
      icon: ImageIcon,
      onPress: () => router.push('/(authenticated)/page1'),
    },
    {
      title: 'פרופיל עסק',
      subtitle: 'עדכון פרטים ותמונות',
      icon: Settings,
      onPress: () => router.push('/(authenticated)/business-details'),
    },
  ];

  return (
    <View style={{ paddingHorizontal: 20, marginTop: 30, marginBottom: 40 }}>
      <View
        style={{
          flexDirection: HOME_ROW,
          direction: HOME_DIRECTION,
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Sparkles size={16} color={C.purple} />
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>
          פעולות מהירות
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {actions.map((action) => (
          <Pressable
            key={action.title}
            onPress={action.onPress}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={action.title}
            style={({ pressed }) => ({
              minHeight: 76,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: C.purpleBdr,
              backgroundColor: pressed ? C.purpleFaint : C.card,
              paddingVertical: 14,
              paddingHorizontal: 16,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <View
              style={{
                alignItems: 'center',
                flexDirection: HOME_ROW,
                direction: HOME_DIRECTION,
                gap: 13,
                justifyContent: 'flex-start',
                width: '100%',
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: C.purpleFaint,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <action.icon size={19} color={C.purple} />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>
                  {action.title}
                </Text>
                <Text style={{ color: C.textMid, fontSize: 12, marginTop: 4, textAlign: 'right', writingDirection: 'rtl', lineHeight: 17 }}>
                  {action.subtitle}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function LatestPostsSection({ posts }: { posts: HomePostDoc[] | undefined }) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const latestPosts = posts?.slice(0, 3) ?? [];
  const postCardWidth = Math.min(156, Math.max(136, (screenWidth - 54) / 2.25));
  const postCardHeight = Math.round(postCardWidth * 1.22);

  return (
    <View style={{ marginBottom: 38 }}>
      <View
        style={{
          flexDirection: HOME_ROW,
          direction: HOME_DIRECTION,
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          marginBottom: 16,
          width: '100%',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', flex: 1 }}>
          פוסטים אחרונים
        </Text>
        <Pressable
          onPress={() => router.push('/(authenticated)/page1')}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="ראה את כל הפוסטים"
          hitSlop={10}
          style={{ minHeight: 32, justifyContent: 'center', alignItems: 'flex-start' }}
        >
          <Text style={{ color: C.purple, fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>
            צפה בהכל
          </Text>
        </Pressable>
      </View>

      {posts === undefined ? (
        <View
          style={{
            marginHorizontal: 20,
            paddingHorizontal: 24,
            paddingVertical: 30,
            minHeight: 142,
            borderRadius: 18,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.border,
            alignItems: 'center',
          }}
        >
          <ActivityIndicator color={C.purple} />
        </View>
      ) : latestPosts.length === 0 ? (
        <View
          style={{
            marginHorizontal: 20,
            paddingHorizontal: 26,
            paddingVertical: 30,
            minHeight: 146,
            borderRadius: 20,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.purpleBdr,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center', writingDirection: 'rtl' }}>
            עדיין אין פוסטים
          </Text>
          <Text style={{ color: C.textMid, fontSize: 13, textAlign: 'center', writingDirection: 'rtl', lineHeight: 20, maxWidth: 250 }}>
            צור את הפוסט הראשון שלך והוא יופיע כאן
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            gap: 14,
          }}
        >
          {latestPosts.map((post) => (
            <Pressable
              key={post._id}
              onPress={() => router.push('/(authenticated)/page1')}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="פתח פוסט אחרון"
              style={({ pressed }) => ({
                width: postCardWidth,
                height: postCardHeight,
                borderRadius: 22,
                backgroundColor: '#08080a',
                borderWidth: 1,
                borderColor: C.purpleBdr,
                overflow: 'hidden',
                opacity: pressed ? 0.88 : 1,
                shadowColor: C.purple,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.22,
                shadowRadius: 16,
                elevation: 8,
              })}
            >
              {post.imageUri ? (
                <Image
                  source={{ uri: post.imageUri }}
                  resizeMode="cover"
                  accessibilityLabel="תמונת פוסט"
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#050507',
                  }}
                />
              ) : (
                <View
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: C.purpleFaint,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={28} color={C.purple} />
                </View>
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.78)']}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '100%',
                  height: 58,
                }}
                pointerEvents="none"
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: 10,
                  right: 10,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.10)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.16)',
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    color: '#f4f4f5',
                    fontSize: 10,
                    fontWeight: '800',
                    textAlign: 'right',
                    writingDirection: 'rtl',
                  }}
                >
                  {formatHomeDate(post.createdAt)}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function BusinessProfileBanner({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel="השלם את פרטי העסק שלך"
      style={({ pressed }) => ({
        marginHorizontal: 20,
        marginTop: 24,
        marginBottom: 4,
        borderRadius: 20,
        overflow: 'hidden',
        opacity: pressed ? 0.88 : 1,
        borderWidth: 1.5,
        borderColor: 'rgba(124,58,237,0.55)',
        shadowColor: C.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 18,
        elevation: 8,
      })}
    >
      <LinearGradient
        colors={['#16101f', '#0f0c17', '#0a0a0a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 20 }}
      >
        {/* top row: icon + title */}
        <View
          style={{
            flexDirection: rtl.flexDirection,
            alignItems: 'center',
            marginBottom: 10,
            gap: 12,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: 'rgba(124,58,237,0.22)',
              borderWidth: 1,
              borderColor: 'rgba(124,58,237,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={20} color={C.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: '800',
                textAlign: rtl.textAlign,
                writingDirection: 'rtl',
              }}
            >
              השלם את פרטי העסק שלך
            </Text>
          </View>
        </View>

        {/* subtitle */}
        <Text
          style={{
            color: '#a1a1aa',
            fontSize: 13,
            lineHeight: 20,
            textAlign: rtl.textAlign,
            writingDirection: 'rtl',
            marginBottom: 16,
          }}
        >
          ככל ש-Easy-M יכיר את העסק שלך טוב יותר, הפוסטים יהיו מדויקים, יפים ומכירתיים יותר.
        </Text>

        {/* CTA row */}
        <View
          style={{
            flexDirection: rtl.flexDirection,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View
            style={{
              backgroundColor: C.purple,
              borderRadius: 12,
              paddingHorizontal: 20,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 14,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              מלא פרטי עסק
            </Text>
          </View>
          <Text
            style={{
              color: '#52525b',
              fontSize: 12,
              textAlign: rtl.textAlign,
            }}
          >
            זה לוקח פחות מדקה
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { isPremium } = useRevenueCat();
  const user = useQuery(api.users.getCurrentUser);
  const posts = useQuery(api.posts.getUserPosts) as HomePostDoc[] | undefined;
  const weeklyStatus = useQuery(api.users.getWeeklyPostStatus);
  // Greeting prefers the business name when available; falls back to a
  // friendly emoji-only "שלום 👋" so the header never feels like a
  // database-rendered "Hello, User".
  const businessProfile = useQuery(api.businessProfiles.getMyBusinessProfile);
  const businessName = businessProfile?.businessName?.trim() ?? '';
  const hasBusinessProfile = Boolean(businessName);
  const isProfileStateLoading = businessProfile === undefined;
  // Premium gate: only subscribed users get the personal dashboard.
  // Free/visitor users always see the marketing home regardless of whether they
  // have a business profile — the profile just improves AI output.
  const showPersonalDashboard =
    isAuthenticated && hasBusinessProfile && isPremium;
  const showVisitorMarketing =
    !isAuthenticated || !isPremium || (!isProfileStateLoading && !showPersonalDashboard);

  // DEV-only: override the computed display state for UI testing
  const { uiOverride } = useDevUiOverride();
  const effectiveShowPersonalDashboard =
    IS_DEV_MODE && uiOverride === 'visitor' ? false
    : IS_DEV_MODE && (uiOverride === 'free' || uiOverride === 'premium') ? true
    : showPersonalDashboard;
  const effectiveShowVisitorMarketing =
    IS_DEV_MODE && uiOverride === 'visitor' ? true
    : IS_DEV_MODE && (uiOverride === 'free' || uiOverride === 'premium') ? false
    : showVisitorMarketing;
  // DEV: 'free' override forces non-premium display; 'premium' forces premium display
  const effectiveIsPremium =
    IS_DEV_MODE && uiOverride === 'free' ? false
    : IS_DEV_MODE && uiOverride === 'premium' ? true
    : isPremium;
  const displayName = user?.fullName || user?.email?.split('@')[0] || 'משתמש';
  const avatarInitial = (displayName.trim()[0] ?? '?').toUpperCase();

  // Banner shows for any authenticated user whose profile is missing key fields.
  // Deliberately does NOT require effectiveShowPersonalDashboard — a fresh user
  // who just finished the onboarding tour has no businessName yet, so
  // showPersonalDashboard would be false and the banner would never appear.
  const isProfileIncomplete =
    isAuthenticated &&
    !isProfileStateLoading &&
    !(
      businessProfile?.businessName?.trim() &&
      businessProfile?.businessType?.trim() &&
      (businessProfile?.services?.trim() || businessProfile?.description?.trim()) &&
      (businessProfile?.uniqueness?.trim() || businessProfile?.description?.trim())
    );



  const containsLatinBusinessName = /[A-Za-z]/.test(businessName);

  // אנימציית לחיצה לכפתור הראשי — PRESERVED
  const btnScale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(btnScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
    }).start();
  const onPressOut = () =>
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
    }).start();

  // אנימציות כניסה
  const headerAnim = useRef(new Animated.Value(0)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;
  const suggestionsAnim = useRef(new Animated.Value(0)).current;
  const featuresAnim = useRef(new Animated.Value(0)).current;
  const reviewsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(btnAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(suggestionsAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(featuresAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(reviewsAnim, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();
  }, [btnAnim, featuresAnim, headerAnim, reviewsAnim, suggestionsAnim]);

  const slideUp = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 220 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: 12 }}>
          {/* ─── Top bar: brand chip (right) + settings (left) ─── */}
          <View
            style={{
              flexDirection: HOME_ROW,
              direction: HOME_DIRECTION,
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              marginBottom: 20,
            }}
          >
            {/* easy-m brand chip — start side in RTL */}
            <View
              style={{
                flexDirection: HOME_ROW,
                direction: HOME_DIRECTION,
                alignItems: 'center',
                gap: 5,
                backgroundColor: C.purpleFaint,
                borderWidth: 1,
                borderColor: C.purpleBdr,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Sparkles size={12} color={C.purple} />
              <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '700' }}>
                easy-m
              </Text>
            </View>

            {/* Settings — end side in RTL */}
            <Pressable
              accessibilityLabel="הגדרות"
              onPress={() => router.push('/(authenticated)/settings')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: C.card,
                borderWidth: 1,
                borderColor: C.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings size={18} color={C.textMid} />
            </Pressable>
          </View>

          {/* ─── Hero header ─── */}
          <Animated.View
            style={{
              opacity: headerAnim,
              transform: [{ translateY: slideUp(headerAnim) }],
              paddingHorizontal: 20,
              marginBottom: 22,
            }}
          >
            <View
              style={{
                backgroundColor: 'transparent',
                borderRadius: 24,
              }}
            >
            <View
              style={{
                flexDirection: 'row',
                direction: HOME_DIRECTION,
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                width: '100%',
              }}
            >
              {/* ── Logo / Avatar circle ── */}
              <Pressable
                accessibilityLabel="פרופיל עסקי"
                onPress={() => router.push('/(authenticated)/settings')}
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 37,
                  backgroundColor: C.purpleFaint,
                  borderWidth: 2,
                  borderColor: C.purpleBdr,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.32,
                  shadowRadius: 12,
                  elevation: 6,
                  flexShrink: 0,
                }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: C.purpleFaint,
                    borderWidth: 2,
                    borderColor: C.purpleBdr,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {businessProfile?.logoUrl ? (
                    <Image
                      source={{ uri: businessProfile.logoUrl }}
                      style={{ width: 72, height: 72, borderRadius: 36 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={{ color: '#a78bfa', fontSize: 26, fontWeight: '800' }}>
                      {avatarInitial}
                    </Text>
                  )}
                </View>
              </Pressable>

              {/* ── Text: greeting + name + badge ── */}
              <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 8 }}>
                {businessName ? (
                  <View
                    style={{
                      flexDirection: HOME_ROW,
                      direction: HOME_DIRECTION,
                      alignItems: 'baseline',
                      justifyContent: 'flex-start',
                      gap: 6,
                      alignSelf: 'stretch',
                      minWidth: 0,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: '#fff',
                        fontSize: 27,
                        fontWeight: '900',
                        textAlign: 'right',
                        writingDirection: 'rtl',
                        letterSpacing: 0,
                        flexShrink: 0,
                      }}
                    >
                      שלום,
                    </Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                      style={{
                        color: '#fff',
                        fontSize: 27,
                        fontWeight: '900',
                        textAlign: 'right',
                        writingDirection: containsLatinBusinessName ? 'ltr' : 'rtl',
                        letterSpacing: 0,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {businessName}
                    </Text>
                  </View>
                ) : (
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 27,
                      fontWeight: '900',
                      textAlign: 'right',
                      writingDirection: 'rtl',
                      alignSelf: 'stretch',
                    }}
                  >
                    שלום 👋
                  </Text>
                )}

                {/* premium status badge */}
                {effectiveShowPersonalDashboard && (
                  <View
                    style={{
                      flexDirection: HOME_ROW,
                      direction: HOME_DIRECTION,
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: 'rgba(124,58,237,0.15)',
                      borderWidth: 1,
                      borderColor: 'rgba(124,58,237,0.35)',
                      borderRadius: 20,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      marginTop: 5,
                    }}
                  >
                    <Sparkles size={11} color="#a78bfa" />
                    <Text
                      style={{
                        color: '#a78bfa',
                        fontSize: 11,
                        fontWeight: '600',
                        writingDirection: 'rtl',
                      }}
                    >
                      העסק שלך מוכן לשיווק
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* sub-text */}
            <Text
              style={{
                color: C.textMid,
                fontSize: 14,
                textAlign: 'left',
                writingDirection: 'rtl',
                lineHeight: 20,
                marginTop: 14,
              }}
            >
              מוכן ליצור פוסט חדש לעסק שלך?
            </Text>
            </View>
          </Animated.View>

          {/* ─── Primary CTA — smaller, refined ─── */}
          <Animated.View
            style={{
              opacity: btnAnim,
              transform: [{ translateY: slideUp(btnAnim) }],
              paddingHorizontal: 20,
              marginBottom: 6,
            }}
          >
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable
                onPressIn={onPressIn}
                onPressOut={onPressOut}
                onPress={() => router.push('/(authenticated)/create')}
                style={{
                  backgroundColor: C.purple,
                  borderRadius: 16,
                  paddingVertical: 13,
                  paddingHorizontal: 20,
                  flexDirection: HOME_ROW,
                  direction: HOME_DIRECTION,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.36,
                  shadowRadius: 14,
                  elevation: 8,
                }}
              >
                <Zap size={17} color="#fff" fill="#fff" />
                <Text
                  style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}
                >
                  צור פוסט חדש
                </Text>
              </Pressable>
            </Animated.View>
            {effectiveShowVisitorMarketing ? (
              <>
                <Text
                  style={{
                    color: C.textSub,
                    fontSize: 11,
                    textAlign: 'right',
                    writingDirection: 'rtl',
                    marginTop: 8,
                  }}
                >
                  ללא כרטיס אשראי • חינם להתחלה
                </Text>
                {/* Removed the "צפה בסיור מהיר" link — the user already
                    goes through onboarding at signup and does not need a
                    second entry point back into it from the home screen. */}
              </>
            ) : null}
          </Animated.View>

          {isProfileIncomplete ? (
            <BusinessProfileBanner
              onPress={() => router.push('/(authenticated)/business-profile')}
            />
          ) : null}

          {effectiveShowPersonalDashboard ? (
            <DashboardStatsSection posts={posts} weeklyStatus={weeklyStatus} isPremium={effectiveIsPremium} />
          ) : null}

          {/* ─── הצעות שיווק שבועיות — premium only ─── */}
          {effectiveShowPersonalDashboard && (
            <View style={{ marginTop: 36 }}>
              <WeeklyAiSuggestionsSection anim={suggestionsAnim} />
            </View>
          )}

          {effectiveShowPersonalDashboard ? (
            <>
              <QuickActionsSection />
              <LatestPostsSection posts={posts} />
            </>
          ) : null}

          {effectiveShowVisitorMarketing ? (
            <>
              {/* ─── כרטיסי יתרונות ─── */}
              <Animated.View
                style={{
                  opacity: featuresAnim,
                  transform: [{ translateY: slideUp(featuresAnim) }],
                  flexDirection: HOME_ROW,
                  direction: HOME_DIRECTION,
                  gap: 10,
                  paddingHorizontal: 20,
                  marginTop: 24,
                  marginBottom: 36,
                }}
              >
                {[
                  {
                    icon: '✍️',
                    title: 'כתיבה חכמה',
                    desc: 'AI שמכיר את העסק שלך',
                  },
                  {
                    icon: '📅',
                    title: 'תזמון פוסטים',
                    desc: 'פרסם בזמן הנכון',
                  },
                  {
                    icon: '📊',
                    title: 'ניתוח ביצועים',
                    desc: 'עקוב אחרי התוצאות',
                  },
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
                    <Text style={{ fontSize: 22, marginBottom: 6 }}>
                      {item.icon}
                    </Text>
                    <Text
                      style={{
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: '700',
                        textAlign: 'center',
                        marginBottom: 3,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        color: C.textMid,
                        fontSize: 10,
                        textAlign: 'center',
                        lineHeight: 14,
                      }}
                    >
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
                    justifyContent: 'flex-start',
                    alignItems: 'center',
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
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                    gap: 12,
                  }}
                >
                  {REVIEWS.map((item) => (
                    <ReviewCard key={item.name} item={item} />
                  ))}
                </ScrollView>
              </Animated.View>

              {/* ─── Premium Showcase ─── */}
              <View>
                {/* Small purple pill above the title */}
                <View style={{ alignItems: 'center', marginBottom: 14 }}>
                  <View
                    style={{
                      flexDirection: HOME_ROW,
                      direction: HOME_DIRECTION,
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: C.purpleFaint,
                      borderWidth: 1,
                      borderColor: C.purpleBdr,
                    }}
                  >
                    <Sparkles size={11} color={C.purple} />
                    <Text
                      style={{
                        color: '#a78bfa',
                        fontSize: 11,
                        fontWeight: '700',
                        letterSpacing: 0.5,
                      }}
                    >
                      תוכן מבוסס AI לעסק שלך
                    </Text>
                  </View>
                </View>

                {/* Section title */}
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 24,
                    fontWeight: '900',
                    textAlign: 'center',
                    lineHeight: 32,
                    paddingHorizontal: 24,
                    marginBottom: 8,
                  }}
                >
                  דוגמאות לפוסטים שה-AI יוצר עבורך
                </Text>

                {/* Subtitle */}
                <Text
                  style={{
                    color: C.textMid,
                    fontSize: 13,
                    textAlign: 'center',
                    paddingHorizontal: 24,
                    marginBottom: 22,
                    lineHeight: 19,
                  }}
                >
                  פוסטים מקצועיים ומעוצבים לעסק שלך תוך שניות
                </Text>

                {/* Horizontal showcase carousel — snaps card-to-card */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={CARD_W + 18}
                  decelerationRate="fast"
                  contentContainerStyle={{
                    paddingHorizontal: 20,
                    paddingVertical: 20,
                    gap: 18,
                  }}
                >
                  {SHOWCASE.map((item, i) => (
                    <ShowcasePostCard
                      key={item.kind}
                      item={item}
                      delay={i * 120}
                    />
                  ))}
                </ScrollView>
              </View>
            </>
          ) : null}
          {/* Debug Panel removed pre-TestFlight — must not appear in any
              shipped build. Reintroduce only behind a deliberate local-only
              flag if needed for future debugging. */}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
