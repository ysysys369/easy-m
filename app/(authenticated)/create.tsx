import { useAction, useMutation, useQuery } from 'convex/react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  BookMarked,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Image as ImageIcon,
  Instagram,
  Pencil,
  Share2,
  Sparkles,
  Star,
  Target,
  Wand2,
  X,
  Zap,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import type { ColorValue, ImageStyle, ViewStyle } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Share as NativeShare,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { LogoTopLeft } from '@/components/LogoTopLeft';
import { api } from '@/convex/_generated/api';
import { IS_DEV_MODE } from '@/config/appConfig';
import { useDevUiOverride } from '@/contexts/DevUiOverrideContext';
import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { scheduleAfterGenerationNotification } from '@/lib/notifications';
import { position as rtlPosition, rtl } from '@/lib/rtl';

// Brand accent per business style (mirrors server-side identity palette)
function getBrandAccent(style?: string): string {
  switch (style) {
    case 'יוקרתי':
      return '#d4af37'; // gold
    case 'מצחיק':
      return '#ec4899'; // playful pink
    case 'מקצועי':
      return '#2563eb'; // navy blue
    case 'צעיר':
      return '#f97316'; // energetic orange
    case 'רגוע':
      return '#84cc16'; // sage green
    default:
      return '#7C3AED'; // brand purple
  }
}

const C = {
  bg: '#0a0a0a',
  card: '#111114',
  purple: '#7C3AED',
  purpleBdr: 'rgba(124,58,237,0.35)',
  purpleFaint: 'rgba(124,58,237,0.12)',
  border: 'rgba(63,63,70,0.55)',
  textSub: '#52525b',
  textMid: '#a1a1aa',
};

type GenerationMode = 'auto' | 'manual';
type PostImageType = 'photo' | 'designed' | 'premium_ad';
type CreativeVisualStyle =
  | 'premium'
  | 'bold'
  | 'elegant'
  | 'dramatic'
  | 'minimal'
  | 'luxury'
  | 'friendly'
  | 'energetic'
  | 'aggressive'
  | 'clean';
type CreativeTemplate =
  | 'bold_sales'
  | 'elegant_beauty'
  | 'food_promo'
  | 'premium_instagram'
  | 'minimal_luxury';
type TextPosition = 'top' | 'bottom' | 'right' | 'left' | 'center';
type LogoPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
type CtaPosition = 'bottom' | 'center' | 'bottom-right' | 'bottom-left';
type PosterLayout = {
  text_position: TextPosition;
  logo_position: LogoPosition;
  cta_position: CtaPosition;
  safe_area: string;
};
type PosterTemplate =
  | 'sushi_delivery'
  | 'restaurant_promo'
  | 'pizza_promo'
  | 'cafe_bakery'
  | 'gym_campaign'
  | 'beauty_luxury'
  | 'nails_manicure'
  | 'hair_barber'
  | 'fashion_boutique'
  | 'real_estate'
  | 'legal_corporate'
  | 'judaica_luxury'
  | 'retail_product'
  | 'general_business_ad';

type PosterText = {
  headline: string;
  subtitle?: string;
  body?: string;
  cta?: string;
  offer?: string;
  badge?: string;
  footer?: string;
};

type CompositionStrategy = 'complete_image' | 'background_with_overlay';

type GeneratedPost = {
  imageBase64: string;
  captionText: string;
  postImageType: PostImageType;
  posterText: PosterText | null;
  posterTemplate?: PosterTemplate | null;
  posterLayout?: PosterLayout | null;
  creativeTemplate?: CreativeTemplate | null;
  visualStyle?: CreativeVisualStyle | null;
  mode: GenerationMode;
  businessName?: string;
  businessType?: string;
  // complete_image means the backend returned a final poster image from
  // OpenAI Image API. The app displays/saves it raw.
  compositionStrategy?: CompositionStrategy;
};

type SavedGeneratedPost = {
  imageUri: string;
  captionText: string;
  mode: GenerationMode;
  businessName?: string;
  businessType?: string;
};

type BoneProps = {
  pulse: Animated.Value;
  w?: ViewStyle['width'];
  h?: number;
  mb?: number;
  br?: number;
};

function Bone({ pulse, w = '100%', h = 14, mb = 10, br = 8 }: BoneProps) {
  return (
    <Animated.View
      style={{
        opacity: pulse,
        width: w,
        height: h,
        borderRadius: br,
        backgroundColor: '#1e1a2e',
        marginBottom: mb,
      }}
    />
  );
}


const LOGO_IMG = require('@/assets/images/logo.png');

const LOADING_STEPS = [
  'מנתחים את פרטי העסק שלך...',
  'בונים רעיון שיווקי...',
  'יוצרים תמונה מקצועית...',
  'כותבים טקסט מכירתי...',
  'מכינים האשטגים לפרסום...',
];

function LoadingSkeleton({ finishedAt }: { finishedAt: number | null }) {
  const pulse       = useRef(new Animated.Value(0)).current;
  const glow        = useRef(new Animated.Value(0)).current;
  const bar         = useRef(new Animated.Value(0)).current;
  const successFade = useRef(new Animated.Value(0)).current;
  const msgFade     = useRef(new Animated.Value(1)).current;
  const dot1Y       = useRef(new Animated.Value(0)).current;
  const dot2Y       = useRef(new Animated.Value(0)).current;
  const dot3Y       = useRef(new Animated.Value(0)).current;

  const [msgIndex, setMsgIndex] = useState(0);
  const finished = Boolean(finishedAt);

  // Pulse / glow / progress bar
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(bar, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(bar, { toValue: 0, duration: 0,    useNativeDriver: false }),
      ])
    ).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [pulse, glow, bar]);

  // Staggered bouncing dots
  useEffect(() => {
    const bounce = (dot: Animated.Value) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: -8, duration: 370, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0,  duration: 370, useNativeDriver: true }),
        ])
      );
    bounce(dot1Y).start();
    const t2 = setTimeout(() => bounce(dot2Y).start(), 140);
    const t3 = setTimeout(() => bounce(dot3Y).start(), 280);
    return () => { clearTimeout(t2); clearTimeout(t3); };
  }, [dot1Y, dot2Y, dot3Y]);

  // Rotating messages with fade
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(msgFade, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
        setMsgIndex((i) => (i + 1) % LOADING_STEPS.length);
        Animated.timing(msgFade, { toValue: 1, duration: 360, useNativeDriver: true }).start();
      });
    }, 2600);
    return () => clearInterval(interval);
  }, [msgFade]);

  // Success haptic + fade-in
  useEffect(() => {
    if (!finishedAt) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.timing(successFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [finishedAt, successFade]);

  const logoScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.03] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });
  const barWidth    = bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={{ marginBottom: 20 }}>
      {/* ── Hero card ── */}
      <View
        style={{
          borderRadius: 28,
          overflow: 'hidden',
          marginBottom: 12,
          shadowColor: C.purple,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.5,
          shadowRadius: 28,
          elevation: 16,
        }}
      >
        <LinearGradient
          colors={['#16082e', '#1e0a38', '#120620']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingVertical: 44, paddingHorizontal: 24, alignItems: 'center' }}
        >
          {/* Radial glow orb */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: 220,
              height: 220,
              borderRadius: 110,
              backgroundColor: 'rgba(124,58,237,0.28)',
              top: 24,
              alignSelf: 'center',
              opacity: glowOpacity,
            }}
          />

          {/* Logo */}
          <Animated.View
            style={{
              width: 100,
              height: 100,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(124,58,237,0.18)',
              borderWidth: 1.5,
              borderColor: 'rgba(167,139,250,0.45)',
              marginBottom: 28,
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.65,
              shadowRadius: 22,
              elevation: 10,
              transform: [{ scale: logoScale }],
            }}
          >
            <Image
              source={LOGO_IMG}
              style={{ width: 66, height: 66, resizeMode: 'contain' }}
              onError={() => {}}
            />
          </Animated.View>

          {/* Main title */}
          <Text
            style={{
              color: '#f5d0fe',
              fontSize: 22,
              fontWeight: '900',
              textAlign: 'center',
              letterSpacing: 0.2,
              marginBottom: 8,
              textShadowColor: 'rgba(217,70,239,0.5)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 10,
            }}
          >
            יוצרים לך פוסט
          </Text>

          {/* Static subtitle */}
          <Text
            style={{
              color: 'rgba(196,172,255,0.75)',
              fontSize: 13,
              fontWeight: '500',
              textAlign: 'center',
              lineHeight: 20,
              marginBottom: 22,
              paddingHorizontal: 8,
            }}
          >
            Easy-M בונה תמונה, טקסט והאשטגים שמתאימים לעסק שלך
          </Text>

          {/* Rotating step message */}
          <Animated.Text
            style={{
              opacity: msgFade,
              color: '#c4acff',
              fontSize: 14,
              fontWeight: '600',
              textAlign: 'center',
              writingDirection: 'rtl',
              marginBottom: 20,
              minHeight: 22,
            }}
          >
            {LOADING_STEPS[msgIndex]}
          </Animated.Text>

          {/* Bouncing dots */}
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
            }}
          >
            {([dot1Y, dot2Y, dot3Y] as Animated.Value[]).map((dotAnim, i) => (
              <Animated.View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#a78bfa',
                  transform: [{ translateY: dotAnim }],
                  shadowColor: '#a78bfa',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.85,
                  shadowRadius: 6,
                  elevation: 4,
                }}
              />
            ))}
          </View>

          {/* Progress bar track */}
          <View
            style={{
              width: '100%',
              height: 3,
              borderRadius: 999,
              backgroundColor: 'rgba(124,58,237,0.2)',
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={{
                height: '100%',
                width: barWidth,
                borderRadius: 999,
                backgroundColor: '#a78bfa',
              }}
            />
          </View>

          {/* Success overlay */}
          {finished ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0, bottom: 0, left: 0, right: 0,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: successFade,
                backgroundColor: 'rgba(16,185,129,0.12)',
                borderRadius: 28,
              }}
            >
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#0a1f17',
                  borderWidth: 2,
                  borderColor: '#34d399',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#34d399',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 18,
                  elevation: 12,
                }}
              >
                <Check size={38} color="#34d399" strokeWidth={3} />
              </View>
              <Text
                style={{
                  color: '#bbf7d0',
                  fontSize: 17,
                  fontWeight: '900',
                  textAlign: 'center',
                  marginTop: 16,
                  textShadowColor: 'rgba(52,211,153,0.5)',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 10,
                }}
              >
                הפוסט שלך מוכן ✨
              </Text>
            </Animated.View>
          ) : null}
        </LinearGradient>
      </View>

      {/* Skeleton — image placeholder */}
      <View
        style={{
          borderRadius: 24,
          overflow: 'hidden',
          marginBottom: 12,
          height: 180,
          backgroundColor: 'rgba(20,8,38,0.55)',
          borderWidth: 1,
          borderColor: 'rgba(167,139,250,0.22)',
        }}
      >
        <LinearGradient
          colors={['rgba(124,58,237,0.18)', 'rgba(217,70,239,0.08)', 'rgba(20,8,38,0.0)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, bottom: 0, width: '100%' }}
        />
        <Animated.View
          style={{ flex: 1, opacity: pulse, backgroundColor: 'rgba(124,58,237,0.10)' }}
        />
      </View>

      {/* Skeleton — caption placeholder */}
      <View
        style={{
          borderRadius: 22,
          overflow: 'hidden',
          backgroundColor: 'rgba(20,8,38,0.55)',
          borderWidth: 1,
          borderColor: 'rgba(167,139,250,0.22)',
        }}
      >
        <LinearGradient
          colors={['rgba(124,58,237,0.10)', 'rgba(20,8,38,0.0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, bottom: 0, width: '100%' }}
        />
        <View style={{ padding: 14, gap: 10 }}>
          <Bone pulse={pulse} h={13} w="45%" mb={4} />
          <Bone pulse={pulse} w="90%" />
          <Bone pulse={pulse} w="80%" />
          <Bone pulse={pulse} w="85%" />
          <Bone pulse={pulse} w="60%" />
        </View>
      </View>
    </View>
  );
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function copyTextToClipboardOrShare(text: string): Promise<void> {
  const navigatorWithClipboard = globalThis.navigator as
    | { clipboard?: { writeText?: (value: string) => Promise<void> } }
    | undefined;

  if (navigatorWithClipboard?.clipboard?.writeText) {
    await navigatorWithClipboard.clipboard.writeText(text);
    return;
  }

  await NativeShare.share({ message: text });
}

function getTemplateAccent(template?: PosterTemplate | null): string {
  switch (template) {
    case 'sushi_delivery':
      return '#E91E8C'; // magenta — restaurant flyer badge
    case 'pizza_promo':
      return '#E91E8C'; // magenta — restaurant flyer badge
    case 'cafe_bakery':
      return '#E91E8C'; // magenta — restaurant flyer badge
    case 'restaurant_promo':
      return '#E91E8C'; // magenta — restaurant flyer badge
    case 'gym_campaign':
      return '#22d3ee'; // electric cyan
    case 'beauty_luxury':
      return '#f0b6c8'; // blush pink
    case 'nails_manicure':
      return '#e8a4c9'; // dusty rose
    case 'hair_barber':
      return '#b8956a'; // warm leather amber
    case 'fashion_boutique':
      return '#1f2937'; // editorial charcoal
    case 'real_estate':
      return '#b08d57'; // warm brass
    case 'legal_corporate':
      return '#1e3a8a'; // deep navy
    case 'judaica_luxury':
      return '#b08d57'; // brass / candlelight
    case 'retail_product':
      return '#0ea5e9'; // clean sky blue
    default:
      return '#14b8a6'; // teal fallback
  }
}

// Secondary accent — used for the gold divider under the business name and
// for the headline-subtitle line. Per-template so a beauty brand can use
// blush-gold while a gym uses electric blue.
function getTemplateSecondaryAccent(template?: PosterTemplate | null): string {
  switch (template) {
    case 'sushi_delivery':
    case 'pizza_promo':
    case 'cafe_bakery':
    case 'restaurant_promo':
      return '#FFD700'; // gold — restaurant flyer
    case 'gym_campaign':
      return '#22d3ee';
    case 'beauty_luxury':
      return '#d4af37'; // soft gold
    case 'nails_manicure':
      return '#d4af37';
    case 'hair_barber':
      return '#d4af37';
    case 'fashion_boutique':
      return '#d4af37';
    case 'real_estate':
      return '#d4af37';
    case 'legal_corporate':
      return '#d4af37';
    case 'judaica_luxury':
      return '#d4af37';
    case 'retail_product':
      return '#FFD700';
    default:
      return '#FFD700';
  }
}

function getDefaultCreativeTemplate(
  template?: PosterTemplate | null
): CreativeTemplate {
  switch (template) {
    case 'sushi_delivery':
    case 'pizza_promo':
    case 'cafe_bakery':
    case 'restaurant_promo':
      return 'food_promo';
    case 'gym_campaign':
    case 'retail_product':
      return 'bold_sales';
    case 'beauty_luxury':
    case 'nails_manicure':
    case 'hair_barber':
    case 'fashion_boutique':
      return 'elegant_beauty';
    case 'real_estate':
    case 'legal_corporate':
    case 'judaica_luxury':
      return 'minimal_luxury';
    default:
      return 'premium_instagram';
  }
}

const DEFAULT_POSTER_LAYOUTS: Record<CreativeTemplate, PosterLayout> = {
  bold_sales: {
    text_position: 'bottom',
    logo_position: 'top-right',
    cta_position: 'bottom-right',
    safe_area: 'Bottom third has dark overlay for headline and CTA.',
  },
  elegant_beauty: {
    text_position: 'right',
    logo_position: 'top-right',
    cta_position: 'bottom-right',
    safe_area: 'Right side has soft empty space for elegant copy.',
  },
  food_promo: {
    text_position: 'bottom',
    logo_position: 'top-right',
    cta_position: 'bottom',
    safe_area: 'Bottom third has dark empty space for bold food promo copy.',
  },
  premium_instagram: {
    text_position: 'top',
    logo_position: 'top-right',
    cta_position: 'bottom-right',
    safe_area: 'Top third has clean empty space for copy.',
  },
  minimal_luxury: {
    text_position: 'center',
    logo_position: 'top-left',
    cta_position: 'bottom',
    safe_area: 'Center has generous empty space for premium copy.',
  },
};

function getPosterPalette(
  creativeTemplate: CreativeTemplate,
  accentColor: string,
  posterTemplate?: PosterTemplate | null
): {
  accent: string;
  secondary: string;
  text: string;
  muted: string;
  ctaText: string;
  overlay: readonly [ColorValue, ColorValue, ColorValue];
} {
  const templateAccent = getTemplateAccent(posterTemplate);
  const secondary = getTemplateSecondaryAccent(posterTemplate);

  switch (creativeTemplate) {
    case 'bold_sales':
      return {
        accent: templateAccent || accentColor,
        secondary: '#22d3ee',
        text: '#ffffff',
        muted: 'rgba(255,255,255,0.82)',
        ctaText: '#050505',
        overlay: ['rgba(0,0,0,0.84)', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.90)'],
      };
    case 'elegant_beauty':
      return {
        accent: '#f0b6c8',
        secondary,
        text: '#fff8f5',
        muted: 'rgba(255,248,245,0.84)',
        ctaText: '#14090d',
        overlay: [
          'rgba(30,12,18,0.58)',
          'rgba(30,12,18,0.10)',
          'rgba(30,12,18,0.68)',
        ],
      };
    case 'food_promo':
      return {
        accent: templateAccent,
        secondary,
        text: '#ffffff',
        muted: 'rgba(255,255,255,0.84)',
        ctaText: '#120807',
        overlay: ['rgba(0,0,0,0.76)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.92)'],
      };
    case 'minimal_luxury':
      return {
        accent: secondary,
        secondary,
        text: '#ffffff',
        muted: 'rgba(255,255,255,0.80)',
        ctaText: '#090909',
        overlay: ['rgba(0,0,0,0.48)', 'rgba(0,0,0,0.24)', 'rgba(0,0,0,0.62)'],
      };
    default:
      return {
        accent: accentColor,
        secondary,
        text: '#ffffff',
        muted: 'rgba(255,255,255,0.82)',
        ctaText: '#ffffff',
        overlay: ['rgba(0,0,0,0.62)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.76)'],
      };
  }
}

function getTextPanelStyle(position: TextPosition): ViewStyle {
  const base: ViewStyle = {
    position: 'absolute',
    zIndex: 3,
  };

  switch (position) {
    case 'top':
      return { ...base, top: 94, ...rtlPosition.start(24), ...rtlPosition.end(24), alignItems: 'flex-end' };
    case 'right':
      return {
        ...base,
        top: 130,
        ...rtlPosition.start(24),
        width: '56%',
        alignItems: 'flex-end',
      };
    case 'left':
      return {
        ...base,
        top: 130,
        ...rtlPosition.end(24),
        width: '56%',
        alignItems: 'flex-start',
      };
    case 'center':
      return { ...base, top: '31%', ...rtlPosition.start(26), ...rtlPosition.end(26), alignItems: 'center' };
    default:
      return {
        ...base,
        ...rtlPosition.start(24),
        ...rtlPosition.end(24),
        bottom: 112,
        alignItems: 'flex-end',
      };
  }
}

function getCtaStyle(position: CtaPosition): ViewStyle {
  const base: ViewStyle = {
    position: 'absolute',
    zIndex: 4,
    bottom: position === 'center' ? undefined : 56,
    top: position === 'center' ? '58%' : undefined,
  };

  if (position === 'bottom-right') return { ...base, ...rtlPosition.start(24) };
  if (position === 'bottom-left') return { ...base, ...rtlPosition.end(24) };
  return { ...base, ...rtlPosition.start(24), ...rtlPosition.end(24), alignItems: 'center' };
}

// ─── Per-template composition variation ──────────────────────────────────────
// Trimmed shape — drives only the text + CTA styling that survives in the
// minimal layout (headline, subtitle, optional small CTA, top+bottom
// gradients). Two industries still never look alike: the photo direction,
// palette, headline alignment/weight, and CTA shape all vary.
type TemplateStyle = {
  headlineAlign: 'right' | 'left' | 'center';
  headlineWeight: '700' | '800' | '900';
  headlineLetterSpacing: number;
  headlineColor: string;
  subtitleColor: string;
  ctaShape: 'pill' | 'rectangle' | 'underline';
  ctaFillColor: string;
  ctaTextColor: string;
  topGradientStrength: number; // 0..1
  bottomGradientStrength: number; // 0..1
  headlineSizePremium: number;
  headlineSizeDesigned: number;
  subtitleSizePremium: number;
  subtitleSizeDesigned: number;
};

function _getTemplateStyle(
  template: PosterTemplate | null | undefined,
  accent: string
): TemplateStyle {
  const base: TemplateStyle = {
    headlineAlign: 'right',
    headlineWeight: '900',
    headlineLetterSpacing: 0,
    headlineColor: '#ffffff',
    subtitleColor: 'rgba(255,255,255,0.92)',
    ctaShape: 'pill',
    ctaFillColor: accent,
    ctaTextColor: '#050505',
    topGradientStrength: 0.55,
    bottomGradientStrength: 0.75,
    headlineSizePremium: 50,
    headlineSizeDesigned: 40,
    subtitleSizePremium: 19,
    subtitleSizeDesigned: 17,
  };

  switch (template) {
    case 'sushi_delivery':
    case 'pizza_promo':
    case 'restaurant_promo':
    case 'cafe_bakery':
      return { ...base, headlineAlign: 'right', ctaShape: 'pill' };

    case 'gym_campaign':
      return {
        ...base,
        headlineAlign: 'right',
        headlineLetterSpacing: 1.2,
        ctaShape: 'rectangle',
        bottomGradientStrength: 0.85,
        headlineSizePremium: 54,
        headlineSizeDesigned: 44,
      };

    case 'beauty_luxury':
    case 'nails_manicure':
      return {
        ...base,
        headlineWeight: '800',
        headlineLetterSpacing: 0.6,
        headlineColor: '#fff8f5',
        subtitleColor: 'rgba(255,248,245,0.9)',
        ctaShape: 'pill',
        ctaFillColor: '#0c0a09',
        ctaTextColor: '#fff8f5',
        topGradientStrength: 0.4,
        bottomGradientStrength: 0.6,
        headlineSizePremium: 46,
        headlineSizeDesigned: 38,
      };

    case 'hair_barber':
      return {
        ...base,
        headlineWeight: '800',
        headlineLetterSpacing: 0.4,
        ctaShape: 'underline',
        ctaFillColor: '#ffffff',
        ctaTextColor: '#ffffff',
      };

    case 'fashion_boutique':
      return {
        ...base,
        headlineAlign: 'center',
        headlineWeight: '800',
        headlineLetterSpacing: 2,
        ctaShape: 'underline',
        ctaFillColor: '#ffffff',
        ctaTextColor: '#ffffff',
        topGradientStrength: 0.4,
        bottomGradientStrength: 0.55,
        headlineSizePremium: 44,
        headlineSizeDesigned: 36,
      };

    case 'real_estate':
      return {
        ...base,
        headlineAlign: 'center',
        headlineWeight: '800',
        headlineLetterSpacing: 1.2,
        ctaShape: 'underline',
        ctaFillColor: '#ffffff',
        ctaTextColor: '#ffffff',
        topGradientStrength: 0.35,
        bottomGradientStrength: 0.55,
        headlineSizePremium: 44,
        headlineSizeDesigned: 36,
      };

    case 'legal_corporate':
      return {
        ...base,
        headlineAlign: 'center',
        headlineWeight: '800',
        headlineLetterSpacing: 1.6,
        ctaShape: 'rectangle',
        ctaFillColor: accent,
        ctaTextColor: '#ffffff',
        headlineSizePremium: 43,
        headlineSizeDesigned: 36,
      };

    case 'judaica_luxury':
      return {
        ...base,
        headlineAlign: 'center',
        headlineWeight: '800',
        headlineLetterSpacing: 1.4,
        ctaShape: 'pill',
        ctaFillColor: accent,
        ctaTextColor: '#0c0a09',
      };

    case 'retail_product':
      return { ...base, headlineWeight: '800', headlineLetterSpacing: 0.4 };

    default:
      return base;
  }
}

// ─── Minimal poster composition ──────────────────────────────────────────────
// Only three text elements allowed on top of the AI background:
//   1. Hebrew headline (always)
//   2. Short Hebrew subtitle (always)
//   3. Optional small CTA (only shown when present and short enough)
// PLUS one tiny logo image in the top corner, when the user has uploaded a logo.
//
// Everything else from previous iterations — offer badge, brand-name chip,
// footer strip, secondary footer line, template-driven geometric overlays —
// has been removed. The AI background must already be text-free, so we don't
// stack text on top of text.
// ─── High-end restaurant flyer composition ───────────────────────────────────
// Layout, top to bottom:
//   ┌─────────────────────────────────────┐
//   │     שם העסק    (52, centered, bold) │  ← business name
//   │       ━━━━     (gold divider)       │
//   │                                     │
//   │  ┌─────────┐                        │
//   │  │ 20% OFF │  ← magenta pill badge  │
//   │  └─────────┘                        │
//   │                                     │
//   │      [generated image behind]       │
//   │                                     │
//   │                                     │
//   │      כותרת ראשית     (68-72 bold)   │  ← headline, bottom third
//   │      כותרת משנה      (38 gold)      │  ← subheadline
//   │                                     │
//   │       contact info (small)          │  ← phone or website
//   └─────────────────────────────────────┘
//
// Fonts: Heebo (Google Fonts via @expo-google-fonts/heebo). If not loaded yet
// the platform falls back to the system Hebrew face, which is still readable.
// To load it: `npm install @expo-google-fonts/heebo expo-font` and call
// `useFonts({ Heebo_400Regular, Heebo_700Bold, Heebo_900Black })` once at app root.

const HEEBO_REGULAR = 'Heebo_400Regular';
const HEEBO_BOLD = 'Heebo_700Bold';
const HEEBO_BLACK = 'Heebo_900Black';

// ─── Premium designed poster — hybrid renderer ──────────────────────────────
// AI provides ONLY the cinematic hero photo (no text, no logo, no UI). This
// composer flattens the full agency-quality ad on top: glowing purple frame,
// brand chip, decorative top-of-panel divider, oversized Hebrew headline,
// secondary divider, subhead, body line, floating circular badge, gradient
// CTA pill, contextual footer. Every text element is real React Native text
// with Heebo, so Hebrew renders perfectly RTL with no AI hallucination. The
// captured PNG is the single artifact used for preview / save / share / gallery.
function ComposedPosterImage({
  imageBase64,
  posterText,
  posterTemplate,
  posterLayout,
  creativeTemplate,
  visualStyle,
  postImageType,
  businessName,
  businessType,
  logoUrl,
  brandStyle,
  accentColor,
  businessPhone,
  businessWebsite,
  onBackgroundLoadEnd,
}: {
  imageBase64: string;
  posterText: PosterText | null;
  posterTemplate?: PosterTemplate | null;
  posterLayout?: PosterLayout | null;
  creativeTemplate?: CreativeTemplate | null;
  visualStyle?: CreativeVisualStyle | null;
  postImageType: PostImageType;
  businessName?: string;
  businessType?: string;
  logoUrl?: string;
  brandStyle?: string;
  accentColor: string;
  businessPhone?: string;
  businessWebsite?: string;
  onBackgroundLoadEnd: () => void;
}) {
  void visualStyle;
  void brandStyle;
  void posterLayout;
  void creativeTemplate;
  void accentColor;
  void postImageType;

  const brandLabel = (businessName?.trim() || 'Easy-M').toUpperCase();

  // Per-template Hebrew fallback when the generator hasn't returned text yet.
  const fallbackText: PosterText = {
    headline:
      posterTemplate === 'sushi_delivery'
        ? 'סושי טרי'
        : posterTemplate === 'gym_campaign'
          ? 'מתחילים היום'
          : posterTemplate === 'fashion_boutique'
            ? 'קולקציה חדשה'
            : 'בדיוק בשבילכם',
    subtitle:
      posterTemplate === 'sushi_delivery'
        ? 'משלוחים עד הבית'
        : posterTemplate === 'gym_campaign'
          ? 'אימון שמתאים לכם'
          : 'שירות מקצועי',
    cta: 'לפרטים',
    badge: 'מומלץ',
  };

  const text = posterText ?? fallbackText;
  const headline = text.headline.trim();
  const subtitle = text.subtitle?.trim() || '';
  const bodyLine = text.body?.trim() || '';
  const ctaText = text.cta?.trim() || '';
  const badgeText = (text.offer?.trim() || text.badge?.trim() || '').slice(0, 18);
  const showCta = Boolean(ctaText && ctaText.length <= 22);

  // Footer should NOT repeat the brand chip. Prefer: explicit copy footer
  // (when it's NOT just the business name) → business type + city → contact.
  const footerLine = (() => {
    const explicit = text.footer?.trim();
    if (explicit && explicit.toUpperCase() !== brandLabel) return explicit;
    const type = businessType?.trim();
    const phone = businessPhone?.trim();
    const site = businessWebsite
      ?.trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/$/, '');
    if (type && site) return `${type} · ${site}`;
    if (type && phone) return `${type} · ${phone}`;
    if (type) return type;
    if (site) return site;
    if (phone) return phone;
    if (explicit) return explicit;
    return brandLabel;
  })();

  // ── Brand palette ──
  const PURPLE_GRAD: readonly [string, string, string] = ['#a78bfa', '#7C3AED', '#5b21b6'];
  const PURPLE_GLOW = 'rgba(124,58,237,0.65)';
  const PURPLE_SOFT = 'rgba(124,58,237,0.18)';

  // Headline auto-sizes: short headlines go BIG, longer ones scale down.
  const headlineWords = headline.split(/\s+/).filter(Boolean).length;
  const headlineSize =
    headlineWords <= 2 ? 76 : headlineWords <= 4 ? 62 : 50;

  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#050505',
        overflow: 'hidden',
      }}
    >
      {/* ─── 1. Full-bleed AI hero photo ──────────────────────────────────── */}
      <Image
        accessibilityLabel="תמונת רקע לפוסטר"
        onLoadEnd={onBackgroundLoadEnd}
        source={{ uri: `data:image/png;base64,${imageBase64}` }}
        style={{
          ...StyleSheet.absoluteFillObject,
          width: '100%',
          height: '100%',
        }}
        resizeMode="cover"
      />

      {/* ─── 2. Top dark band (brand chip lives here, hero photo visible
              below it) — subtle so the photo still breathes. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.0)']}
        locations={[0, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '20%' }}
        pointerEvents="none"
      />

      {/* ─── 3. Bottom dark design panel — anchors the heavy text composition.
              Starts deep at the bottom, fades to clear in the middle so the
              AI hero photo flows naturally INTO the panel instead of being
              cut off. Two layered gradients give it depth. */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(5,2,15,0.55)', 'rgba(5,2,15,0.97)']}
        locations={[0, 0.35, 1]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(91,33,182,0)', 'rgba(91,33,182,0.20)']}
        locations={[0.4, 1]}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' }}
        pointerEvents="none"
      />

      {/* ─── 4. Ornamental top-of-panel divider — a thin glowing line with a
              center ✦ that marks where the AI hero meets the design panel.
              This visual seam is what makes the composition feel like ONE
              integrated poster instead of "photo + text card". */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '46%',
          left: 36,
          right: 36,
          height: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LinearGradient
          colors={['rgba(167,139,250,0)', 'rgba(167,139,250,0.85)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, height: 1 }}
        />
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: 'rgba(91,33,182,0.55)',
            borderWidth: 1,
            borderColor: 'rgba(167,139,250,0.85)',
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: 10,
            shadowColor: '#a78bfa',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 8,
          }}
        >
          <Text style={{ color: '#e9d5ff', fontSize: 13, fontWeight: '900' }}>✦</Text>
        </View>
        <LinearGradient
          colors={['rgba(167,139,250,0.85)', 'rgba(167,139,250,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, height: 1 }}
        />
      </View>

      {/* ─── 5. Glowing purple frame (premium signature look) ────────────── */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          right: 14,
          bottom: 14,
          borderRadius: 22,
          borderWidth: 1.5,
          borderColor: 'rgba(167,139,250,0.55)',
          shadowColor: '#7C3AED',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 20,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 19,
          left: 19,
          right: 19,
          bottom: 19,
          borderRadius: 17,
          borderWidth: 0.7,
          borderColor: 'rgba(255,255,255,0.07)',
        }}
      />

      {/* ─── 6. Decorative sparkles in the dark zones (subtle premium feel) ── */}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <Text style={{ position: 'absolute', top: '7%', left: '14%', color: 'rgba(167,139,250,0.55)', fontSize: 9 }}>✦</Text>
        <Text style={{ position: 'absolute', top: '11%', right: '22%', color: 'rgba(167,139,250,0.40)', fontSize: 7 }}>✦</Text>
        <Text style={{ position: 'absolute', bottom: '34%', left: '8%', color: 'rgba(167,139,250,0.45)', fontSize: 8 }}>✦</Text>
        <Text style={{ position: 'absolute', bottom: '12%', right: '11%', color: 'rgba(167,139,250,0.50)', fontSize: 10 }}>✦</Text>
        <Text style={{ position: 'absolute', bottom: '6%', left: '20%', color: 'rgba(167,139,250,0.35)', fontSize: 7 }}>✦</Text>
      </View>

      {/* ─── 7. Brand chip (top, centered) ────────────────────────────────────
          When a real logo exists, the chip is the LOGO with the small label
          underneath. When no logo, just the business name with letter-spacing.
          We never duplicate the brand name in the footer. */}
      <View
        style={{
          position: 'absolute',
          top: 32,
          left: 24,
          right: 24,
          alignItems: 'center',
        }}
      >
        {logoUrl ? (
          <Image
            accessibilityLabel="לוגו העסק"
            source={{ uri: logoUrl }}
            style={{
              width: 48,
              height: 48,
              marginBottom: 6,
              shadowColor: PURPLE_GLOW,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.9,
              shadowRadius: 12,
            }}
            resizeMode="contain"
          />
        ) : (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              backgroundColor: PURPLE_SOFT,
              borderWidth: 1,
              borderColor: 'rgba(167,139,250,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
              shadowColor: PURPLE_GLOW,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 10,
            }}
          >
            <Text style={{ color: '#e9d5ff', fontSize: 16, fontWeight: '900' }}>✦</Text>
          </View>
        )}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
          style={{
            color: 'rgba(255,255,255,0.94)',
            fontFamily: HEEBO_BOLD,
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 2.4,
            textAlign: 'center',
            writingDirection: 'rtl',
            maxWidth: '78%',
            textShadowColor: 'rgba(0,0,0,0.7)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }}
        >
          {brandLabel}
        </Text>
      </View>

      {/* ─── 8. Main composition — headline, divider, subhead, body ──────────
          Lives inside the bottom design panel so the AI hero stays visible
          above the ornamental divider in section 4. */}
      <View
        style={{
          position: 'absolute',
          top: '50%',
          left: 30,
          right: 30,
          bottom: '23%',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: 14,
        }}
      >
        <Text
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.48}
          style={{
            color: '#ffffff',
            fontFamily: HEEBO_BLACK,
            fontSize: headlineSize,
            lineHeight: Math.round(headlineSize * 1.04),
            fontWeight: '900',
            textAlign: 'center',
            writingDirection: 'rtl',
            letterSpacing: -0.8,
            textShadowColor: PURPLE_GLOW,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 22,
          }}
        >
          {headline}
        </Text>

        {subtitle ? (
          <>
            <View
              style={{
                marginTop: 14,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View style={{ width: 24, height: 1, backgroundColor: 'rgba(167,139,250,0.7)' }} />
              <Text style={{ color: '#a78bfa', fontSize: 10 }}>✦</Text>
              <View style={{ width: 24, height: 1, backgroundColor: 'rgba(167,139,250,0.7)' }} />
            </View>
            <Text
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={{
                color: '#e9d5ff',
                fontFamily: HEEBO_BOLD,
                fontSize: 22,
                lineHeight: 28,
                fontWeight: '800',
                textAlign: 'center',
                writingDirection: 'rtl',
                letterSpacing: 0.3,
                textShadowColor: 'rgba(0,0,0,0.6)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
                marginBottom: bodyLine ? 8 : 0,
              }}
            >
              {subtitle}
            </Text>
          </>
        ) : null}

        {bodyLine ? (
          <Text
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{
              color: 'rgba(255,255,255,0.82)',
              fontFamily: HEEBO_REGULAR,
              fontSize: 15,
              lineHeight: 22,
              fontWeight: '500',
              textAlign: 'center',
              writingDirection: 'rtl',
              maxWidth: '94%',
              textShadowColor: 'rgba(0,0,0,0.6)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
              marginTop: subtitle ? 0 : 12,
            }}
          >
            {bodyLine}
          </Text>
        ) : null}
      </View>

      {/* ─── 9. Floating circular offer badge (sticker over AI hero) ──────── */}
      {badgeText ? (
        <View
          style={{
            position: 'absolute',
            right: 28,
            top: '24%',
            width: 100,
            height: 100,
            borderRadius: 50,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ rotate: '8deg' }],
            shadowColor: '#7C3AED',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.85,
            shadowRadius: 20,
            elevation: 14,
          }}
        >
          <LinearGradient
            colors={['#a78bfa', '#7C3AED', '#4c1d95']}
            start={{ x: 0.2, y: 0.1 }}
            end={{ x: 0.8, y: 0.9 }}
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: 50,
              borderWidth: 1.5,
              borderColor: 'rgba(233,213,255,0.85)',
            }}
          />
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginBottom: 2 }}>✦</Text>
          <Text
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
            style={{
              color: '#ffffff',
              fontFamily: HEEBO_BLACK,
              fontSize: 15,
              lineHeight: 17,
              fontWeight: '900',
              textAlign: 'center',
              writingDirection: 'rtl',
              paddingHorizontal: 10,
              textShadowColor: 'rgba(0,0,0,0.45)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          >
            {badgeText}
          </Text>
        </View>
      ) : null}

      {/* ─── 10. CTA pill — full-width gradient with strong glow + ornaments ── */}
      {showCta ? (
        <View
          style={{
            position: 'absolute',
            bottom: 82,
            left: 38,
            right: 38,
            borderRadius: 32,
            shadowColor: '#7C3AED',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.95,
            shadowRadius: 24,
            elevation: 16,
          }}
        >
          <LinearGradient
            colors={PURPLE_GRAD}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 32,
              paddingVertical: 17,
              paddingHorizontal: 22,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.20)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 14, opacity: 0.9 }}>✦</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              style={{
                color: '#ffffff',
                fontFamily: HEEBO_BLACK,
                fontSize: 20,
                fontWeight: '900',
                textAlign: 'center',
                writingDirection: 'rtl',
                letterSpacing: 0.4,
              }}
            >
              {ctaText}
            </Text>
            <Text style={{ color: '#ffffff', fontSize: 14, opacity: 0.9 }}>✦</Text>
          </LinearGradient>
        </View>
      ) : null}

      {/* ─── 11. Footer line — tiny, centered, NEVER duplicates the brand chip ── */}
      <View
        style={{
          position: 'absolute',
          bottom: 36,
          left: 28,
          right: 28,
          alignItems: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
          style={{
            color: 'rgba(255,255,255,0.72)',
            fontFamily: HEEBO_REGULAR,
            fontSize: 12,
            fontWeight: '500',
            letterSpacing: 0.8,
            textAlign: 'center',
            writingDirection: 'rtl',
            textShadowColor: 'rgba(0,0,0,0.7)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
        >
          {footerLine}
        </Text>
      </View>
    </View>
  );
}

// ─── Premium Instagram-style post preview ───────────────────────────────────
function PostPreviewCard({
  imageBase64,
  captionText,
  mode,
  postImageType,
  posterText,
  posterTemplate,
  posterLayout,
  creativeTemplate,
  visualStyle,
  businessName,
  businessType,
  logoUrl,
  brandStyle,
  businessPhone,
  businessWebsite,
  compositionStrategy,
  onSave,
  isSaving,
}: {
  imageBase64: string;
  captionText: string;
  mode: GenerationMode;
  postImageType: PostImageType;
  posterText: PosterText | null;
  posterTemplate?: PosterTemplate | null;
  posterLayout?: PosterLayout | null;
  creativeTemplate?: CreativeTemplate | null;
  visualStyle?: CreativeVisualStyle | null;
  businessName?: string;
  businessType?: string;
  logoUrl?: string;
  brandStyle?: string;
  businessPhone?: string;
  businessWebsite?: string;
  compositionStrategy?: CompositionStrategy;
  onSave: (post: SavedGeneratedPost) => Promise<void>;
  isSaving: boolean;
}) {
  // Fade-in + slide-up on mount
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 12,
      bounciness: 5,
    }).start();
  }, [anim]);
  const opacity = anim;
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  const strategy: CompositionStrategy =
    compositionStrategy ?? 'background_with_overlay';
  // premium_ad: OpenAI Image renders the COMPLETE final poster (hero photo
  // + Hebrew typography + branding + offer badge + CTA + footer — the whole
  // designed ad). The app shows that image AS-IS; no RN overlay is drawn on
  // top. designed mode is the only path that still uses the RN overlay
  // composer (for compatibility with older designed posts).
  const isComposedPoster =
    strategy === 'complete_image' ||
    postImageType === 'designed' ||
    postImageType === 'premium_ad';
  const isRnOverlayPoster =
    strategy === 'background_with_overlay' && postImageType === 'designed';
  const imageAspectRatio = isComposedPoster ? 1 : 4 / 5;

  // Branded composite — captured for save/share so the logo + accent travel with the image
  const brandedRef = useRef<View>(null);
  const accentColor = getBrandAccent(brandStyle);
  // RN-side logo overlay is now ONLY used for the legacy `photo` mode flow.
  // For `complete_image` mode, the brand logo is integrated into the AI image
  // itself via openai.images.edit — drawing another logo here would either
  // duplicate it or layer the same logo on a white card on top of the
  // designed-in version. That was the "floating square" the user reported.
  const showRnLogoOverlay = !isComposedPoster && Boolean(logoUrl);
  const showRnAccentOverlay = !isComposedPoster;
  const hasBranding = showRnLogoOverlay || showRnAccentOverlay;
  const shouldCaptureComposite = isRnOverlayPoster || hasBranding;
  const shouldPrefetchLogo = Boolean(logoUrl);
  const [logoReady, setLogoReady] = useState(!shouldPrefetchLogo);
  const [readyImageBase64, setReadyImageBase64] = useState<string | null>(null);
  const backgroundReady = readyImageBase64 === imageBase64;

  // Prefetch the logo as soon as we know its URL so the very first
  // captureRef call after generation already has it in the image cache.
  useEffect(() => {
    setLogoReady(!shouldPrefetchLogo);
    if (!shouldPrefetchLogo || !logoUrl) return;
    let cancelled = false;
    Image.prefetch(logoUrl)
      .then(() => {
        if (!cancelled) setLogoReady(true);
      })
      .catch(() => {
        if (!cancelled) setLogoReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [logoUrl, shouldPrefetchLogo]);

  // Local state
  const [isExpanded, setIsExpanded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedCaption, setEditedCaption] = useState(captionText);
  const [activeCaption, setActiveCaption] = useState(captionText);
  const [sharingTarget, setSharingTarget] = useState<null | string>(null);
  // Off-screen Instagram Story stage (9:16) — populated on-demand when the
  // user taps the "שיתוף לסטורי" button. The square poster URI is set into
  // the stage, the stage is captured at 1080x1920, and the resulting PNG is
  // what we share with Instagram. The gallery-saved file stays 1:1.
  const storyStageRef = useRef<View>(null);
  const [storyPosterUri, setStoryPosterUri] = useState<string | null>(null);
  const [storyPosterReady, setStoryPosterReady] = useState(false);

  useEffect(() => {
    setEditedCaption(captionText);
    setActiveCaption(captionText);
  }, [captionText]);

  const showExpand = activeCaption.length > 180;

  // Persist the final image to disk.
  //
  const writeImageToFile = async (): Promise<string> => {
    if (!FileSystem.documentDirectory) throw new Error('Storage unavailable');
    const dest = `${FileSystem.documentDirectory}post_${Date.now()}.png`;

    if (strategy === 'complete_image') {
      if (brandedRef.current) {
        if (!backgroundReady) {
          await wait(250);
        }
        try {
          const tmpUri = await captureRef(brandedRef, {
            format: 'png',
            quality: 0.95,
            result: 'tmpfile',
            width: 1080,
            height: 1080,
          });
          await FileSystem.copyAsync({ from: tmpUri, to: dest });
          return dest;
        } catch (error) {
          void error;
        }
      }

      await FileSystem.writeAsStringAsync(dest, imageBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return dest;
    }

    if (isRnOverlayPoster && !brandedRef.current) {
      throw new Error('POSTER_COMPOSER_NOT_READY');
    }

    if (shouldCaptureComposite && brandedRef.current) {
      if (!backgroundReady) {
        await wait(250);
      }
      if (logoUrl && !logoReady) {
        try {
          await Image.prefetch(logoUrl);
        } catch {
          /* continue anyway */
        }
      }
      try {
        const tmpUri = await captureRef(brandedRef, {
          format: 'png',
          quality: 0.95,
          result: 'tmpfile',
          width: isRnOverlayPoster ? 1080 : undefined,
          height: isRnOverlayPoster ? 1080 : undefined,
        });
        await FileSystem.copyAsync({ from: tmpUri, to: dest });
        return dest;
      } catch (error) {
        if (isRnOverlayPoster) {
          throw error;
        }
      }
    }

    await FileSystem.writeAsStringAsync(dest, imageBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return dest;
  };

  // Build a 9:16 Instagram-Story-ready PNG by centering the 1:1 poster on a
  // dark brand-tinted background. The original 1:1 file written by
  // writeImageToFile() stays untouched — this is a one-off file created
  // only for sharing to Instagram Stories/Reels.
  const writeStoryImageToFile = async (
    sourcePosterUri: string,
  ): Promise<string> => {
    if (!FileSystem.documentDirectory) throw new Error('Storage unavailable');
    if (!storyStageRef.current) throw new Error('STORY_STAGE_NOT_READY');

    // Reset → set new URI → wait for the off-screen Image to render → capture.
    setStoryPosterReady(false);
    setStoryPosterUri(sourcePosterUri);

    // Poll up to ~1.5s for the inner Image's onLoadEnd to fire.
    const start = Date.now();
    while (!storyPosterReady && Date.now() - start < 1500) {
      await wait(60);
    }
    // One last paint tick so the image actually rasterises before capture.
    await wait(80);

    const dest = `${FileSystem.documentDirectory}story_${Date.now()}.png`;
    const tmpUri = await captureRef(storyStageRef, {
      format: 'png',
      quality: 0.95,
      result: 'tmpfile',
      width: 1080,
      height: 1920,
    });
    await FileSystem.copyAsync({ from: tmpUri, to: dest });
    return dest;
  };

  const handleSave = async () => {
    try {
      const uri = await writeImageToFile();
      await onSave({
        imageUri: uri,
        captionText: activeCaption,
        mode,
        businessName,
        businessType,
      });
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור. נסה שנית.');
    }
  };

  const handleShareTarget = async (
    target: 'post' | 'save' | 'text' | 'image' | 'both' | 'instagram_story'
  ) => {
    if (sharingTarget) return;
    setSharingTarget(target);
    try {
      if (target === 'text') {
        await copyTextToClipboardOrShare(activeCaption);
        return;
      }

      // ── "שיתוף לסטורי / ריל באינסטגרם" — produces a 9:16 share file with
      // the square poster centered on a dark brand-tinted background, so the
      // image fits Instagram Story / Reel framing without being cropped.
      // The original 1:1 file (used by save/gallery) is untouched.
      if (target === 'instagram_story') {
        const hasCaption = activeCaption.trim().length > 0;
        const squareUri = await writeImageToFile();
        let storyUri: string;
        try {
          storyUri = await writeStoryImageToFile(squareUri);
        } catch {
          // If the 9:16 capture fails, fall back to the original 1:1 file
          // so the user still gets something usable.
          storyUri = squareUri;
        }

        try {
          await NativeShare.share({
            title: 'Easy-M',
            message: hasCaption ? activeCaption : undefined,
            url: storyUri,
          } as Parameters<typeof NativeShare.share>[0]);
        } catch {
          const available = await Sharing.isAvailableAsync();
          if (available) {
            await Sharing.shareAsync(storyUri, {
              mimeType: 'image/png',
              dialogTitle: 'שיתוף לסטורי באינסטגרם',
              UTI: 'public.png',
            });
          }
        }

        if (hasCaption) {
          Alert.alert(
            'הכיתוב לסטורי',
            activeCaption + '\n\n(לחץ והחזק כדי להעתיק את הכיתוב)',
            [{ text: 'סגור', style: 'cancel' }],
          );
        }
        return;
      }

      // ── "שתף תמונה + טקסט" — share both image AND caption together.
      // Handles all three cases the user asked for:
      //   • image + caption → share both
      //   • image only      → share image
      //   • caption only    → share text
      // After the share sheet closes we ALWAYS surface the caption in an
      // Alert so the user can long-press to copy it — this catches the
      // common case where the destination app (Instagram, WhatsApp Stories,
      // etc.) consumed only the image and silently dropped the message.
      if (target === 'both') {
        const hasCaption = activeCaption.trim().length > 0;

        if (!hasCaption) {
          // Image only — same path as the "שתף תמונה בלבד" button.
          const uri = await writeImageToFile();
          const available = await Sharing.isAvailableAsync();
          if (available) {
            await Sharing.shareAsync(uri, {
              mimeType: 'image/png',
              dialogTitle: 'שתף תמונה',
              UTI: 'public.png',
            });
          } else {
            await NativeShare.share({ title: 'Easy-M', url: uri });
          }
          return;
        }

        // From here on we know there is a caption.
        let imageShareError: unknown = null;
        let imageUri: string | null = null;
        try {
          imageUri = await writeImageToFile();
        } catch (error) {
          imageShareError = error;
        }

        if (!imageUri) {
          // No image available — fall back to a text-only share.
          await NativeShare.share({ message: activeCaption });
          if (imageShareError) {
            // Let the user know we shared the caption but the image failed.
            Alert.alert(
              'שותף הטקסט בלבד',
              'לא הצלחנו להכין את התמונה לשיתוף. הכיתוב נשלח לשיתוף כפי שהוא.',
            );
          }
          return;
        }

        // Both image and caption exist. Try the native share sheet first —
        // on iOS it surfaces both fields together (Mail/Messages/Notes use
        // both; Instagram/WhatsApp use only the image).
        try {
          await NativeShare.share({
            title: 'Easy-M',
            message: activeCaption,
            url: imageUri,
          });
        } catch {
          // Some Android share targets reject local file URLs via the RN
          // Share API. Fall back to expo-sharing for reliable image transfer.
          const available = await Sharing.isAvailableAsync();
          if (available) {
            await Sharing.shareAsync(imageUri, {
              mimeType: 'image/png',
              dialogTitle: 'שתף תמונה + טקסט',
              UTI: 'public.png',
            });
          }
        }

        // ALWAYS surface the caption afterwards. If the destination app
        // already picked up the message, this is a harmless confirmation.
        // If the destination app dropped the message (common on IG/WA),
        // this is the user's chance to copy and paste it manually.
        Alert.alert(
          'הכיתוב לשיתוף',
          activeCaption + '\n\n(לחץ והחזק כדי להעתיק את הכיתוב)',
          [{ text: 'סגור', style: 'cancel' }],
        );
        return;
      }

      // Existing path for 'post' / 'image' / 'save' — unchanged.
      const uri = await writeImageToFile();

      if (target === 'post') {
        try {
          await NativeShare.share({
            title: 'Easy-M',
            message: activeCaption,
            url: uri,
          });
          return;
        } catch {
          // Some Android targets ignore local file URLs via React Native Share.
          // Fall through to expo-sharing so the image still shares reliably.
        }
      }

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        await NativeShare.share({ message: activeCaption });
        return;
      }

      const dialogTitle =
        {
          post: 'שיתוף פוסט',
          save: 'שמור לגלריה',
          image: 'שתף תמונה בלבד',
        }[target] ?? 'שיתוף פוסט';

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle,
        UTI: 'public.png',
      });

      if (target === 'post') {
        Alert.alert('הקפשן לפוסט', activeCaption, [
          { text: 'סגור', style: 'cancel' },
        ]);
      }
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשתף כרגע, נסה שוב');
    } finally {
      setSharingTarget(null);
      setShowShareModal(false);
    }
  };

  const handleSaveEditedCaption = () => {
    const trimmed = editedCaption.trim();
    if (!trimmed) {
      Alert.alert('שגיאה', 'הכיתוב לא יכול להיות ריק');
      return;
    }
    setActiveCaption(trimmed);
    setShowEditModal(false);
  };

  // Button press scale animation factory
  const usePressScale = () => {
    const s = useRef(new Animated.Value(1)).current;
    return {
      style: { transform: [{ scale: s }] },
      onIn: () =>
        Animated.spring(s, {
          toValue: 0.96,
          useNativeDriver: true,
          speed: 60,
        }).start(),
      onOut: () =>
        Animated.spring(s, {
          toValue: 1,
          useNativeDriver: true,
          speed: 35,
        }).start(),
    };
  };
  const shareBtn = usePressScale();
  const saveBtn = usePressScale();
  const editBtn = usePressScale();

  return (
    <Animated.View
      style={{ opacity, transform: [{ translateY }], marginBottom: 24 }}
    >
      {/* Header line */}
      <View
        style={{
          flexDirection: rtl.flexDirection,
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 6,
          marginBottom: 14,
        }}
      >
        <Text style={{ color: C.purple, fontSize: 13, fontWeight: '700' }}>
          הפוסט שלך מוכן ✨
        </Text>
        <Sparkles size={14} color={C.purple} />
      </View>

      {/* ═══ Image — square for composed ad posters, legacy portrait for photo mode ═══ */}
      <View
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: C.card,
          marginBottom: 16,
          shadowColor: C.purple,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 12,
        }}
      >
        {/* This wrapper is what react-native-view-shot captures.
            collapsable={false} keeps it as a real native View even with one child. */}
        <View
          ref={brandedRef}
          collapsable={false}
          style={{ width: '100%', aspectRatio: imageAspectRatio }}
        >
          {isRnOverlayPoster ? (
            // Legacy path: AI returned a background only — app composes the
            // Hebrew typography + CTA + logo on top via ComposedPosterImage.
            <ComposedPosterImage
              imageBase64={imageBase64}
              posterText={posterText}
              posterTemplate={posterTemplate}
              posterLayout={posterLayout}
              creativeTemplate={creativeTemplate}
              visualStyle={visualStyle}
              postImageType={postImageType}
              businessName={businessName}
              businessType={businessType}
              logoUrl={logoUrl}
              brandStyle={brandStyle}
              accentColor={accentColor}
              businessPhone={businessPhone}
              businessWebsite={businessWebsite}
              onBackgroundLoadEnd={() => setReadyImageBase64(imageBase64)}
            />
          ) : (
            <Image
              accessibilityLabel="תמונת הפוסט"
              onLoadEnd={() => setReadyImageBase64(imageBase64)}
              source={{ uri: `data:image/png;base64,${imageBase64}` }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          )}

          {/* Logo watermark (photo mode only) — bottom-end in RTL.
              The PNG's native transparency is preserved: no white card,
              no rounded box, no opaque background behind the logo. A faint
              shadow stays purely for legibility on busy photos. */}
          {showRnLogoOverlay && logoUrl && (
            <Image
              accessibilityLabel="לוגו העסק"
              source={{ uri: logoUrl }}
              style={{
                position: 'absolute',
                bottom: 16,
                ...(rtlPosition.start(16) as ImageStyle),
                width: 56,
                height: 56,
                // No backgroundColor → PNG alpha channel shows through.
                // Subtle soft shadow for realism on busy photo backgrounds.
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.45,
                shadowRadius: 6,
              }}
              resizeMode="contain"
            />
          )}

          {/* Brand accent bar — skipped for composed poster modes. */}
          {showRnAccentOverlay && (
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                width: '100%',
                height: 4,
                backgroundColor: accentColor,
                opacity: 0.9,
              }}
            />
          )}
        </View>
      </View>

      {/* ═══ Caption ═══ */}
      <View
        style={{
          backgroundColor: C.card,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: C.border,
          paddingHorizontal: 18,
          paddingTop: 16,
          paddingBottom: 14,
          marginBottom: 18,
        }}
      >
        <Text
          style={{
            color: C.textMid,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0,
            textAlign: 'right',
            writingDirection: 'rtl',
            marginBottom: 10,
          }}
        >
          כיתוב שיווקי
        </Text>
        <Text
          selectable
          numberOfLines={isExpanded ? undefined : 4}
          style={{
            color: '#fff',
            fontSize: 15,
            lineHeight: 24,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {activeCaption}
        </Text>
        {showExpand && (
          <Pressable
            onPress={() => setIsExpanded((v) => !v)}
            style={{
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 4,
              marginTop: 10,
            }}
          >
            <Text style={{ color: C.purple, fontSize: 13, fontWeight: '700' }}>
              {isExpanded ? 'הצג פחות' : 'הצג עוד'}
            </Text>
            {isExpanded ? (
              <ChevronUp size={14} color={C.purple} />
            ) : (
              <ChevronDown size={14} color={C.purple} />
            )}
          </Pressable>
        )}
      </View>

      {/* ═══ Primary actions: שיתוף + שמירה ═══ */}
      <View style={{ flexDirection: rtl.flexDirection, gap: 10, marginBottom: 10 }}>
        <Animated.View style={[{ flex: 1 }, shareBtn.style]}>
          <Pressable
            onPressIn={shareBtn.onIn}
            onPressOut={shareBtn.onOut}
            onPress={() => handleShareTarget('post')}
            disabled={Boolean(sharingTarget)}
            accessibilityLabel="שיתוף פוסט"
            style={{
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 16,
              borderRadius: 18,
              backgroundColor: C.purple,
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5,
              shadowRadius: 14,
              elevation: 8,
              opacity: sharingTarget ? 0.68 : 1,
            }}
          >
            {sharingTarget === 'post' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Share2 size={17} color="#fff" />
            )}
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
              {sharingTarget === 'post' ? 'מכין...' : 'שיתוף פוסט'}
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[{ flex: 1 }, saveBtn.style]}>
          <Pressable
            onPressIn={saveBtn.onIn}
            onPressOut={saveBtn.onOut}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityLabel="שמור פוסט"
            style={{
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 16,
              borderRadius: 18,
              backgroundColor: C.card,
              borderWidth: 1.5,
              borderColor: C.purpleBdr,
              opacity: isSaving ? 0.65 : 1,
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={C.purple} />
            ) : (
              <BookMarked size={17} color={C.purple} />
            )}
            <Text style={{ color: C.purple, fontSize: 15, fontWeight: '800' }}>
              {isSaving ? 'שומר...' : '💾 שמור'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {sharingTarget ? (
        <Text
          style={{
            color: C.purple,
            fontSize: 13,
            fontWeight: '700',
            textAlign: 'right',
            writingDirection: 'rtl',
            marginBottom: 10,
          }}
        >
          מכין את הפוסט לשיתוף...
        </Text>
      ) : null}

      {/* ═══ Secondary share actions ═══ */}
      <View style={{ flexDirection: rtl.flexDirection, gap: 8, marginBottom: 10 }}>
        <ShareMiniButton
          icon={<Download size={14} color={C.purple} />}
          label="שמור לגלריה"
          loading={sharingTarget === 'save'}
          onPress={() => handleShareTarget('save')}
        />
        <ShareMiniButton
          icon={<Copy size={14} color={C.purple} />}
          label="העתק טקסט"
          loading={sharingTarget === 'text'}
          onPress={() => handleShareTarget('text')}
        />
      </View>
      <View style={{ flexDirection: rtl.flexDirection, gap: 8, marginBottom: 10 }}>
        <ShareMiniButton
          icon={<ImageIcon size={14} color={C.purple} />}
          label="שתף תמונה בלבד"
          loading={sharingTarget === 'image'}
          onPress={() => handleShareTarget('image')}
        />
        <ShareMiniButton
          icon={<Share2 size={14} color={C.purple} />}
          label="שתף תמונה + טקסט"
          loading={sharingTarget === 'both'}
          onPress={() => handleShareTarget('both')}
        />
      </View>
      {/* Dedicated Instagram Story / Reel share — produces a 9:16 file so
          the square poster sits centered with safe margins inside IG's
          portrait frame instead of being cropped. */}
      <View style={{ flexDirection: rtl.flexDirection, gap: 8, marginBottom: 10 }}>
        <ShareMiniButton
          icon={<Instagram size={14} color={C.purple} />}
          label="שיתוף לסטורי באינסטגרם (9:16)"
          loading={sharingTarget === 'instagram_story'}
          onPress={() => handleShareTarget('instagram_story')}
        />
      </View>

      {/* ═══ Secondary action: ערוך טקסט ═══ */}
      <Animated.View style={editBtn.style}>
        <Pressable
          onPressIn={editBtn.onIn}
          onPressOut={editBtn.onOut}
          onPress={() => {
            setEditedCaption(activeCaption);
            setShowEditModal(true);
          }}
          accessibilityLabel="ערוך טקסט"
          style={{
            flexDirection: rtl.flexDirection,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 13,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.border,
          }}
        >
          <Pencil size={14} color={C.textMid} />
          <Text style={{ color: C.textMid, fontSize: 13, fontWeight: '600' }}>
            ✏️ ערוך טקסט
          </Text>
        </Pressable>
      </Animated.View>

      {/* ═══ Off-screen 9:16 Instagram Story stage ═══
          Populated on-demand by handleShareTarget('instagram_story'). The
          square poster URI is set into setStoryPosterUri; this stage renders
          the poster centered on a dark brand-tinted backdrop and is captured
          at 1080x1920 by writeStoryImageToFile. Positioned far off-screen so
          it never affects layout and never appears to the user. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -100000,
          top: -100000,
          width: 360,
          height: 640,
        }}
      >
        <View
          ref={storyStageRef}
          collapsable={false}
          style={{
            width: 360,
            height: 640,
            backgroundColor: '#0a0a0a',
            overflow: 'hidden',
          }}
        >
          {/* Dark brand-tinted gradient background */}
          <LinearGradient
            colors={[
              `${accentColor}55`,
              '#0a0a0a',
              '#000000',
              `${accentColor}33`,
            ]}
            locations={[0, 0.35, 0.7, 1]}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Subtle accent corner glow */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -80,
              left: -80,
              width: 320,
              height: 320,
              borderRadius: 160,
              backgroundColor: `${accentColor}33`,
              opacity: 0.6,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -80,
              right: -80,
              width: 320,
              height: 320,
              borderRadius: 160,
              backgroundColor: `${accentColor}22`,
              opacity: 0.5,
            }}
          />

          {/* Centered 1:1 poster — 90% width, vertically centered with safe
              top/bottom margins so Instagram's Story UI overlays do not clip
              the design. */}
          {storyPosterUri ? (
            <View
              style={{
                position: 'absolute',
                left: 18,
                right: 18,
                top: '50%',
                marginTop: -162,
                width: 324,
                height: 324,
                borderRadius: 18,
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.55,
                shadowRadius: 24,
              }}
            >
              <Image
                source={{ uri: storyPosterUri }}
                onLoadEnd={() => setStoryPosterReady(true)}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            </View>
          ) : null}
        </View>
      </View>

      {/* ═══ Share options modal — kept as a compact secondary sheet if needed ═══ */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowShareModal(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: C.card,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: C.purpleBdr,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: 36,
            }}
          >
            {/* Drag handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: C.border,
                alignSelf: 'center',
                marginBottom: 18,
              }}
            />

            <Text
              style={{
                color: '#fff',
                fontSize: 18,
                fontWeight: '800',
                textAlign: 'right',
                marginBottom: 18,
              }}
            >
              אפשרויות שיתוף
            </Text>

            {sharingTarget ? (
              <Text
                style={{
                  color: C.purple,
                  fontSize: 13,
                  fontWeight: '700',
                  textAlign: 'right',
                  marginBottom: 12,
                }}
              >
                מכין את הפוסט לשיתוף...
              </Text>
            ) : null}

            <ShareOptionRow
              icon={<Instagram size={22} color={C.purple} />}
              label="שיתוף לסטורי באינסטגרם (9:16)"
              loading={sharingTarget === 'instagram_story'}
              onPress={() => handleShareTarget('instagram_story')}
            />
            <ShareOptionRow
              icon={<Share2 size={22} color={C.purple} />}
              label="שתף תמונה + טקסט"
              loading={sharingTarget === 'both'}
              onPress={() => handleShareTarget('both')}
            />
            <ShareOptionRow
              icon={<ImageIcon size={22} color={C.purple} />}
              label="שתף תמונה בלבד"
              loading={sharingTarget === 'image'}
              onPress={() => handleShareTarget('image')}
            />
            <ShareOptionRow
              icon={<Download size={22} color={C.purple} />}
              label="שמור לגלריה"
              loading={sharingTarget === 'save'}
              onPress={() => handleShareTarget('save')}
            />
            <ShareOptionRow
              icon={<Copy size={22} color={C.purple} />}
              label="העתק טקסט"
              loading={sharingTarget === 'text'}
              onPress={() => handleShareTarget('text')}
            />

            <Pressable
              onPress={() => setShowShareModal(false)}
              style={{
                marginTop: 14,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: 'rgba(63,63,70,0.40)',
                alignItems: 'center',
              }}
            >
              <Text
                style={{ color: C.textMid, fontSize: 14, fontWeight: '700' }}
              >
                ביטול
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══ Edit caption modal ═══ */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.78)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: C.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: C.purpleBdr,
              padding: 22,
            }}
          >
            <View
              style={{
                flexDirection: rtl.flexDirection,
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
              }}
            >
              <Pressable onPress={() => setShowEditModal(false)}>
                <X size={20} color={C.textMid} />
              </Pressable>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>
                ערוך כיתוב
              </Text>
            </View>
            <TextInput
              value={editedCaption}
              onChangeText={setEditedCaption}
              multiline
              textAlignVertical="top"
              style={{
                color: '#fff',
                fontSize: 15,
                lineHeight: 24,
                textAlign: 'right',
                writingDirection: 'rtl',
                backgroundColor: '#16161a',
                borderRadius: 14,
                padding: 14,
                minHeight: 180,
                maxHeight: 320,
                borderWidth: 1,
                borderColor: C.border,
              }}
            />
            <View style={{ flexDirection: rtl.flexDirection, gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: C.border,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{ color: C.textMid, fontSize: 14, fontWeight: '600' }}
                >
                  ביטול
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEditedCaption}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: C.purple,
                  alignItems: 'center',
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  elevation: 6,
                }}
              >
                <Text
                  style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}
                >
                  שמור שינויים
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

function ShareOptionRow({
  icon,
  label,
  loading,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={{
        flexDirection: rtl.flexDirection,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: '#16161a',
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 10,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <View style={{ width: 24, alignItems: 'center' }}>
        {loading ? <ActivityIndicator size="small" color={C.purple} /> : null}
      </View>
      <View style={{ flexDirection: rtl.flexDirection, alignItems: 'center', gap: 12 }}>
        <Text
          style={{
            color: '#fff',
            fontSize: 15,
            fontWeight: '600',
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {label}
        </Text>
        {icon}
      </View>
    </Pressable>
  );
}

function ShareMiniButton({
  icon,
  label,
  loading,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      disabled={loading}
      style={{
        flex: 1,
        minHeight: 46,
        flexDirection: rtl.flexDirection,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.purpleBdr,
        backgroundColor: C.purpleFaint,
        opacity: loading ? 0.65 : 1,
      }}
    >
      {loading ? <ActivityIndicator size="small" color={C.purple} /> : icon}
      <Text
        numberOfLines={1}
        style={{ color: C.purple, fontSize: 12, fontWeight: '800' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── מסך ראשי ────────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const router = useRouter();
  // When the user lands here from a Weekly AI Suggestion card, the suggestion
  // description arrives as a `topic` route param so the input is pre-filled.
  const params = useLocalSearchParams<{ topic?: string }>();
  const initialTopic = typeof params.topic === 'string' ? params.topic : '';

  const [content, setContent] = useState(initialTopic);
  const [loading, setLoading] = useState(false);
  // Timestamp the result arrived. Drives the loading-screen success animation.
  // While non-null, the LoadingSkeleton renders the success overlay before the
  // preview card swaps in.
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(
    null
  );
  const [focused, setFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // If a different topic arrives while the screen is already mounted (e.g. the
  // user taps a second suggestion), update the input. Local edits are not
  // overwritten because we only react to URL-param changes.
  useEffect(() => {
    if (initialTopic) setContent(initialTopic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTopic]);

  const { isPremium } = useRevenueCat();
  const { uiOverride } = useDevUiOverride();
  // DEV: 'free' override forces non-premium display; 'premium' forces premium display
  const effectiveIsPremium =
    IS_DEV_MODE && uiOverride === 'free' ? false
    : IS_DEV_MODE && uiOverride === 'premium' ? true
    : isPremium;

  // undefined = still loading; do NOT default until we know the real value
  const weeklyStatus = useQuery(api.users.getWeeklyPostStatus);
  const businessProfile = useQuery(api.businessProfiles.getMyBusinessProfile);
  const hasBusinessProfile =
    businessProfile !== undefined &&
    businessProfile !== null &&
    !!businessProfile.businessName;
  const isMissingProfile = businessProfile !== undefined && !hasBusinessProfile;
  const isQueryLoading =
    weeklyStatus === undefined || businessProfile === undefined;

  // Central quota gate — the SINGLE source of truth for ALL generation flows.
  // Free users: blocked once postsGenerated >= 1 (regardless of what the DB userType says,
  // because effectiveIsPremium already respects the dev override).
  // Paid users: blocked when the rolling 7-day remaining hits 0.
  const freePostUsed = !effectiveIsPremium && (weeklyStatus?.used ?? 0) > 0;
  const isLimitReached = weeklyStatus !== undefined && (
    effectiveIsPremium
      ? weeklyStatus.remaining <= 0   // paid: use backend weekly remaining
      : freePostUsed                  // free: any usage = blocked
  );
  const canGeneratePost = !isQueryLoading && !isLimitReached && hasBusinessProfile;
  const remainingThisWeek = weeklyStatus?.remaining ?? 0;
  const weeklyLimit = weeklyStatus?.limit ?? 3;

  const blockReason = isQueryLoading
    ? 'loading'
    : !hasBusinessProfile
    ? 'no_business_profile'
    : isLimitReached
    ? effectiveIsPremium ? 'weekly_limit_reached' : 'free_post_used'
    : 'none';



  const createPost = useMutation(api.posts.createPost);
  const generateMarketingPost = useAction(
    api.generatePost.generateMarketingPost
  );
  const btnScale = useRef(new Animated.Value(1)).current;
  const btnIn = () =>
    Animated.spring(btnScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 60,
    }).start();
  const btnOut = () =>
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 35,
    }).start();

  const generate = async (topic: string, mode: GenerationMode) => {
    if (!canGeneratePost) {
      if (isLimitReached) setShowUpgrade(true);
      return;
    }

    // Soft haptic kick at the moment the user fires generation. The
    // LoadingSkeleton itself also fires a Medium impact on mount; together
    // they create a clear "request initiated → engine spun up" rhythm.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    setLoading(true);
    setFinishedAt(null);
    setGeneratedPost(null);
    try {
      const result = await generateMarketingPost({ topic });
      setGeneratedPost({
        ...result,
        postImageType:
          result.postImageType ??
          (businessProfile?.postImageType as PostImageType | undefined) ??
          'premium_ad',
        posterText: result.posterText ?? null,
        posterTemplate: result.posterTemplate ?? null,
        posterLayout: result.posterLayout ?? null,
        creativeTemplate: result.creativeTemplate ?? null,
        visualStyle: result.visualStyle ?? null,
        mode,
        businessName: businessProfile?.businessName,
        businessType: businessProfile?.businessType,
        compositionStrategy:
          (result as { compositionStrategy?: CompositionStrategy })
            .compositionStrategy ??
          (result.postImageType === 'photo'
            ? 'background_with_overlay'
            : 'complete_image'),
      });
      // Trigger the success animation, then let it play for ~750ms before
      // unmounting the loader and revealing the preview. The success haptic
      // fires from inside LoadingSkeleton when `finishedAt` becomes non-null.
      setFinishedAt(Date.now());
      window.setTimeout(() => {
        setLoading(false);
        // If image generation failed but text succeeded, show a non-blocking note
        if (!result.imageBase64) {
          Alert.alert(
            'הטקסט נוצר בהצלחה',
            'לא הצלחנו לייצר תמונה כרגע — הפוסט יוצג ללא תמונה. בדוק את הגדרות ה-API ונסה שוב.',
          );
        }
      }, 750);
      // Fire a "your post is ready" local notification (~30s later)
      scheduleAfterGenerationNotification().catch(() => {});
      // Done — `finally` only runs on the error path now.
      return;
    } catch (err: unknown) {
      // Failure haptic so the user feels the result even before reading the alert.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {}
      );

      const msg = String(err);

      const GENERIC_FAILURE_TITLE = 'שגיאה';
      const GENERIC_FAILURE_MESSAGE =
        'לא הצלחנו ליצור פוסט כרגע, נסה שוב בעוד רגע.';

      if (msg.includes('LIMIT_REACHED')) {
        setShowUpgrade(true);
      } else if (msg.includes('NO_BUSINESS_PROFILE')) {
        Alert.alert(
          'פרופיל עסקי חסר',
          'כדי ליצור פוסט מותאם אישית, צריך להשלים קודם פרופיל עסקי.'
        );
      } else if (msg.includes('OPENAI_API_KEY is not configured') || msg.includes('MISSING_OR_INVALID_API_KEY')) {
        Alert.alert('מפתח API חסר', 'מפתח OpenAI לא מוגדר בשרת. פנה לתמיכה.');
      } else if (msg.includes('QUOTA_OR_BILLING') || msg.includes('insufficient_quota')) {
        Alert.alert('מכסת API מוצתה', 'חרגת ממכסת OpenAI. בדוק את פרטי החיוב שלך.');
      } else if (msg.includes('MODEL_NOT_FOUND')) {
        Alert.alert('שגיאת הגדרה', 'מודל הבינה מלאכותית לא נמצא. פנה לתמיכה.');
      } else {
        Alert.alert(GENERIC_FAILURE_TITLE, GENERIC_FAILURE_MESSAGE);
      }
      setLoading(false);
      setFinishedAt(null);
    }
  };

  const handleCreate = () => {
    if (loading) return;
    if (!canGeneratePost) { if (isLimitReached) setShowUpgrade(true); return; }
    if (!content.trim()) return;
    generate(content.trim(), 'manual');
  };
  const handleAutoCreate = () => {
    if (loading) return;
    if (!canGeneratePost) { if (isLimitReached) setShowUpgrade(true); return; }
    generate(content.trim(), 'auto');
  };

  const handleSave = async ({
    imageUri,
    captionText,
    mode,
    businessName,
    businessType,
  }: SavedGeneratedPost) => {
    if (!captionText.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await createPost({
        content: captionText,
        captionText,
        imageUri,
        businessName,
        businessType,
        generationMode: mode,
      });
      Alert.alert('✅', 'הפוסט נשמר בהצלחה');
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור. נסה שנית.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <LogoTopLeft />

      {/* ── Upgrade Modal — celebration + benefits ── */}
      <Modal
        visible={showUpgrade}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUpgrade(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.80)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 22,
          }}
          onPress={() => setShowUpgrade(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: C.card,
              borderRadius: 28,
              borderWidth: 1,
              borderColor: C.purpleBdr,
              paddingHorizontal: 26,
              paddingTop: 28,
              paddingBottom: 22,
              width: '100%',
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.55,
              shadowRadius: 32,
              elevation: 20,
            }}
          >
            {/* Celebration icon */}
            <View style={{ alignItems: 'center', marginBottom: 18 }}>
              <View
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 22,
                  backgroundColor: C.purpleFaint,
                  borderWidth: 1,
                  borderColor: C.purpleBdr,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.45,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <Sparkles size={32} color={C.purple} />
              </View>
            </View>

            {/* Title */}
            <Text
              style={{
                color: '#fff',
                fontSize: 22,
                fontWeight: '800',
                textAlign: 'right',
                writingDirection: 'rtl',
                marginBottom: 10,
                lineHeight: 30,
              }}
            >
              {/* Branch on the backend-reported quota limit, not on the
                  in-flight RC isPremium flag. weeklyStatus.limit comes from
                  Convex (3 for paid users, 1 for free) and reflects the
                  real effective premium status — so a premium user with a
                  late-loading RC SDK still sees the correct "3 weekly posts"
                  text instead of the "1 free post" text. */}
              {(weeklyStatus?.limit ?? (effectiveIsPremium ? 3 : 1)) > 1
                ? `ניצלת את כל ${weeklyStatus?.limit ?? 3} הפוסטים השבועיים שלך 🎯`
                : 'ניצלת את הפוסט החינמי שלך ✨'}
            </Text>

            {/* Body */}
            <Text
              style={{
                color: C.textMid,
                fontSize: 15,
                textAlign: 'right',
                writingDirection: 'rtl',
                lineHeight: 23,
                marginBottom: 22,
              }}
            >
              המשך ליצור תוכן מקצועי, לשמור על מותג עקבי ולנהל נוכחות שיווקית
              בלי להתחיל מאפס.
            </Text>

            {/* Benefits list */}
            <View
              style={{
                backgroundColor: '#16161a',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: C.border,
                padding: 16,
                marginBottom: 20,
                gap: 12,
              }}
            >
              {[
                { icon: Sparkles, label: 'תוכן AI שמותאם לשפה של העסק' },
                { icon: Clock, label: 'חוסך זמן עבודה יקר בכל שבוע' },
                { icon: Target, label: 'מיתוג עקבי ונוכחות מקצועית' },
              ].map(({ icon: Icon, label }) => (
                <View
                  key={label}
                  style={{
                    flexDirection: rtl.flexDirection,
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 12,
                  }}
                >
                  <Text
                    style={{
                      color: '#e4e4e7',
                      fontSize: 14,
                      fontWeight: '600',
                      textAlign: 'right',
                      writingDirection: 'rtl',
                      flex: 1,
                    }}
                  >
                    {label}
                  </Text>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      backgroundColor: C.purpleFaint,
                      borderWidth: 1,
                      borderColor: C.purpleBdr,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={14} color={C.purple} />
                  </View>
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: C.purple,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={11} color="#fff" strokeWidth={3} />
                  </View>
                </View>
              ))}
            </View>

            {/* Primary CTA */}
            <Pressable
              onPress={() => {
                setShowUpgrade(false);
                router.push('/(authenticated)/paywall');
              }}
              style={{
                backgroundColor: C.purple,
                borderRadius: 16,
                paddingVertical: 16,
                width: '100%',
                alignItems: 'center',
                shadowColor: C.purple,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.5,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                שדרג עכשיו
              </Text>
            </Pressable>

            {/* Premium value hint */}
            <Text
              style={{
                color: C.purple,
                fontSize: 12,
                fontWeight: '700',
                textAlign: 'center',
                marginTop: 10,
              }}
            >
              יותר רעיונות, יותר עקביות, פחות עבודה ידנית
            </Text>

            {/* Secondary — soft, not dismissive */}
            <Pressable
              onPress={() => setShowUpgrade(false)}
              style={{
                paddingVertical: 12,
                marginTop: 4,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: C.textMid, fontSize: 13 }}>
                אולי אחר כך
              </Text>
            </Pressable>

            {/* Dev-only reset button removed pre-TestFlight. */}
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        style={{ flex: 1 }}
        // Extra bottom inset so the square poster preview never clips under the
        // fixed tab bar at the bottom of the authenticated layout.
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 80 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 10,
              marginBottom: 6,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>
              יצירת תוכן
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
              <Zap size={22} color={C.purple} fill={C.purple} />
            </View>
          </View>
          <Text
            style={{
              color: C.textSub,
              fontSize: 14,
              textAlign: 'left',
              marginBottom: 28,
            }}
          >
            צור פוסט חכם תוך שניות בעזרת AI
          </Text>

          {/* ── Missing business profile CTA ── */}
          {isMissingProfile && (
            <View
              style={{
                backgroundColor: C.card,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: C.purpleBdr,
                padding: 20,
                marginBottom: 24,
                shadowColor: C.purple,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: C.purpleFaint,
                  borderWidth: 1,
                  borderColor: C.purpleBdr,
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'flex-end',
                  marginBottom: 14,
                }}
              >
                <Sparkles size={24} color={C.purple} />
              </View>
              <Text
                style={{
                  color: '#fff',
                  fontSize: 17,
                  fontWeight: '800',
                  textAlign: 'right',
                  writingDirection: 'rtl',
                  marginBottom: 8,
                }}
              >
                נדרש פרופיל עסקי
              </Text>
              <Text
                style={{
                  color: C.textMid,
                  fontSize: 14,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                  lineHeight: 22,
                  marginBottom: 18,
                }}
              >
                כדי ליצור פוסט מותאם אישית, צריך להשלים קודם פרופיל עסקי
              </Text>
              <Pressable
                onPress={() => router.push('/(authenticated)/business-profile')}
                style={{
                  backgroundColor: C.purple,
                  borderRadius: 14,
                  paddingVertical: 14,
                  flexDirection: rtl.flexDirection,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.45,
                  shadowRadius: 10,
                  elevation: 6,
                }}
              >
                <Text
                  style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}
                >
                  השלם פרופיל עסקי ✨
                </Text>
              </Pressable>
            </View>
          )}

          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                color: C.textMid,
                fontSize: 12,
                fontWeight: '600',
                letterSpacing: 0,
                textAlign: 'left',
                marginBottom: 10,
              }}
            >
              מה הנושא?
            </Text>
            <View
              style={{
                backgroundColor: C.card,
                borderWidth: 1.5,
                borderColor: focused ? C.purple : C.border,
                borderRadius: 18,
                padding: 16,
                shadowColor: C.purple,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: focused ? 0.3 : 0,
                shadowRadius: 12,
                elevation: 2,
              }}
            >
              <TextInput
                value={content}
                onChangeText={setContent}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="לדוגמה: 20% הנחה לכל השבוע"
                placeholderTextColor="#3f3f46"
                multiline
                scrollEnabled={false}
                numberOfLines={4}
                textAlignVertical="top"
                editable={!loading && !isLimitReached && hasBusinessProfile}
                style={{
                  color: '#e4e4e7',
                  fontSize: 15,
                  lineHeight: 24,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                  minHeight: 110,
                  opacity: isLimitReached || isMissingProfile ? 0.4 : 1,
                }}
              />
            </View>
          </View>

          <Pressable
            onPress={handleAutoCreate}
            disabled={
              loading || isLimitReached || isQueryLoading || !hasBusinessProfile
            }
            style={{
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: C.purpleFaint,
              borderWidth: 1,
              borderColor: C.purpleBdr,
              marginBottom: 12,
              opacity:
                loading ||
                isLimitReached ||
                isQueryLoading ||
                !hasBusinessProfile
                  ? 0.4
                  : 1,
            }}
          >
            <Text style={{ color: '#a78bfa', fontSize: 15, fontWeight: '700' }}>
              ✨ צור לי פוסט אוטומטי
            </Text>
          </Pressable>

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable
              onPressIn={btnIn}
              onPressOut={btnOut}
              onPress={handleCreate}
              disabled={loading || isQueryLoading || !hasBusinessProfile}
              style={{
                backgroundColor:
                  isLimitReached || !hasBusinessProfile
                    ? '#2a1a4e'
                    : !content.trim() || loading
                      ? '#3b1f6e'
                      : C.purple,
                borderRadius: 22,
                paddingVertical: 18,
                flexDirection: loading ? 'column' : rtl.flexDirection,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                shadowColor: C.purple,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity:
                  isLimitReached || !hasBusinessProfile
                    ? 0.1
                    : !content.trim() || loading
                      ? 0.2
                      : 0.5,
                shadowRadius: 20,
                elevation: 10,
                opacity: isLimitReached || !hasBusinessProfile ? 0.6 : 1,
              }}
            >
              {loading ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
                    יוצר...
                  </Text>
                </View>
              ) : (
                <>
                  <Sparkles
                    size={20}
                    color={
                      isLimitReached || !hasBusinessProfile ? '#6d4ca0' : '#fff'
                    }
                  />
                  <Text
                    style={{
                      color:
                        isLimitReached || !hasBusinessProfile ? '#6d4ca0' : '#fff',
                      fontSize: 17,
                      fontWeight: '700',
                    }}
                  >
                    צור פוסט ⚡
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {/* Quota status — free vs. subscribed */}
          {!isQueryLoading && isLimitReached && !effectiveIsPremium ? (
            /* ── Free post used: prominent upgrade CTA ── */
            <View
              style={{
                marginTop: 16,
                marginBottom: 24,
                marginHorizontal: 4,
                backgroundColor: '#16101f',
                borderWidth: 1,
                borderColor: 'rgba(124,58,237,0.38)',
                borderRadius: 20,
                padding: 22,
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: '800',
                  textAlign: 'center',
                  writingDirection: 'rtl',
                }}
              >
                כבר השתמשת בפוסט הראשון במתנה
              </Text>
              <Text
                style={{
                  color: C.textMid,
                  fontSize: 13,
                  textAlign: 'center',
                  writingDirection: 'rtl',
                  lineHeight: 20,
                  marginBottom: 14,
                }}
              >
                שדרג כדי ליצור 3 פוסטים בשבוע לעסק שלך
              </Text>
              <Pressable
                onPress={() => router.push('/(authenticated)/paywall')}
                style={({ pressed }) => ({
                  backgroundColor: '#7C3AED',
                  paddingVertical: 14,
                  paddingHorizontal: 32,
                  borderRadius: 50,
                  opacity: pressed ? 0.82 : 1,
                  shadowColor: '#7C3AED',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.55,
                  shadowRadius: 16,
                  elevation: 8,
                })}
              >
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 }}>
                  בוא תשדרג
                </Text>
              </Pressable>
            </View>
          ) : !isQueryLoading && isLimitReached && effectiveIsPremium ? (
            /* ── Paid weekly limit reached ── */
            <Pressable
              onPress={() => router.push('/(authenticated)/paywall')}
              style={{ marginTop: 10, marginBottom: 24, alignItems: 'center' }}
            >
              <Text
                style={{
                  color: '#a78bfa',
                  fontSize: 13,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                }}
              >
                {`ניצלת את כל ${weeklyLimit} הפוסטים השבועיים`}{' '}·{' '}
                <Text style={{ textDecorationLine: 'underline' }}>שדרג למנוי</Text>
              </Text>
            </Pressable>
          ) : !isQueryLoading ? (
            /* ── Can generate: show remaining ── */
            <View style={{ marginTop: 10, marginBottom: 24, alignItems: 'flex-end' }}>
              <Text
                style={{
                  color: C.textMid,
                  fontSize: 13,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                }}
              >
                {effectiveIsPremium ? (
                  <>
                    נשארו לך{' '}
                    <Text style={{ color: '#a78bfa', fontWeight: '700' }}>
                      {remainingThisWeek}
                    </Text>{' '}
                    פוסטים השבוע
                  </>
                ) : (
                  'יש לך פוסט אחד במתנה'
                )}
              </Text>
            </View>
          ) : (
            <View style={{ marginBottom: 28 }} />
          )}

          {loading && <LoadingSkeleton finishedAt={finishedAt} />}

          {!loading && generatedPost && (
            <PostPreviewCard
              imageBase64={generatedPost.imageBase64}
              captionText={generatedPost.captionText}
              mode={generatedPost.mode}
              postImageType={generatedPost.postImageType}
              posterText={generatedPost.posterText}
              posterTemplate={generatedPost.posterTemplate}
              posterLayout={generatedPost.posterLayout}
              creativeTemplate={generatedPost.creativeTemplate}
              visualStyle={generatedPost.visualStyle}
              businessName={generatedPost.businessName}
              businessType={generatedPost.businessType}
              logoUrl={businessProfile?.logoUrl ?? undefined}
              brandStyle={businessProfile?.style ?? undefined}
              businessPhone={businessProfile?.phone ?? undefined}
              businessWebsite={
                businessProfile?.websiteUrl ??
                businessProfile?.website ??
                undefined
              }
              compositionStrategy={generatedPost.compositionStrategy}
              onSave={handleSave}
              isSaving={isSaving}
            />
          )}

          {/* ─── Empty placeholder ─── */}
          {!loading && !generatedPost && hasBusinessProfile && (
            <View
              style={{
                alignItems: 'center',
                paddingVertical: 36,
                borderWidth: 1,
                borderColor: C.border,
                borderStyle: 'dashed',
                borderRadius: 20,
                marginTop: 8,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  backgroundColor: C.purpleFaint,
                  borderWidth: 1,
                  borderColor: C.purpleBdr,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 12,
                }}
              >
                <Sparkles size={24} color={C.purple} />
              </View>
              <Text
                style={{
                  color: '#e4e4e7',
                  fontSize: 15,
                  fontWeight: '700',
                  textAlign: 'center',
                  marginBottom: 4,
                }}
              >
                עדיין לא יצרת פוסט
              </Text>
              <Text
                style={{
                  color: C.textMid,
                  fontSize: 13,
                  textAlign: 'center',
                  paddingHorizontal: 24,
                  lineHeight: 19,
                }}
              >
                לחץ על "צור פוסט" למעלה והפוסט שלך יופיע כאן
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
