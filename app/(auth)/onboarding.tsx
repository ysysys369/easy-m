import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rtl } from '@/lib/rtl';

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg:          '#0a0a0a',
  card:        '#111114',
  purple:      '#7C3AED',
  purpleLight: '#a78bfa',
  purpleFaint: 'rgba(124,58,237,0.13)',
  purpleMid:   'rgba(124,58,237,0.22)',
  purpleBdr:   'rgba(124,58,237,0.38)',
  purpleDeep:  '#5b21b6',
  border:      'rgba(63,63,70,0.55)',
  textMid:     '#71717a',
  textLight:   '#a1a1aa',
  white:       '#ffffff',
};

// 0=Welcome 1=WhatsEasyM 2=Pain 3=Value 4=Consistency 5=Benefit 6=Personalization 7=FinalCTA
type OnboardingStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const TOTAL_STEPS = 8;

const PAIN_OPTIONS = [
  'אין לי רעיונות לפוסטים',
  'אין לי זמן לעצב',
  'אני לא יודע מה לכתוב',
  'אני לא מפרסם מספיק',
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function OnboardingScreen() {
  const router       = useRouter();
  const [step,         setStep]        = useState<OnboardingStep>(0);
  const [selectedPains, setSelectedPains] = useState<string[]>([]);

  const togglePain = (opt: string) => {
    setSelectedPains((prev) =>
      prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt],
    );
  };

  const stepOpacity = useRef(new Animated.Value(1)).current;
  const stepTransY  = useRef(new Animated.Value(0)).current;

  const goToStep = (next: OnboardingStep, dir: 'forward' | 'back' = 'forward') => {
    const outY = dir === 'forward' ? -18 : 18;
    const inY  = dir === 'forward' ?  22 : -22;
    Animated.parallel([
      Animated.timing(stepOpacity, { toValue: 0,    duration: 180, useNativeDriver: true }),
      Animated.timing(stepTransY,  { toValue: outY, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      stepTransY.setValue(inY);
      Animated.parallel([
        Animated.timing(stepOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(stepTransY,  { toValue: 0, useNativeDriver: true, speed: 52, bounciness: 5 }),
      ]).start();
    });
  };

  const advance = () => goToStep(((step + 1) as OnboardingStep), 'forward');
  const goBack  = () => step > 0 && goToStep(((step - 1) as OnboardingStep), 'back');

  const showBackButton = step >= 1 && step <= 6;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>

      {/* Ambient background glow — sits behind every step */}
      <View pointerEvents="none" style={{ ...absFill }}>
        <GlowOrb size={520} color="rgba(124,58,237,0.13)" top={-140} left={-160} />
        <GlowOrb size={360} color="rgba(167,139,250,0.08)" bottom={-60} right={-100} />
      </View>

      {/* Back button */}
      {showBackButton && (
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 2 }}>
          <View style={{ flexDirection: rtl.flexDirection }}>
            <TouchableOpacity
              onPress={goBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: C.card,
                borderWidth: 1, borderColor: C.border,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <ChevronRight size={20} color={C.textLight} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Content */}
      <Animated.View style={{ flex: 1, opacity: stepOpacity, transform: [{ translateY: stepTransY }] }}>
        {step === 0 && <StepWelcome     onNext={advance} />}
        {step === 1 && <StepWhatsEasyM  onNext={advance} />}
        {step === 2 && (
          <StepPain
            selected={selectedPains}
            onToggle={togglePain}
            onNext={advance}
          />
        )}
        {step === 3 && <StepValue          onNext={advance} />}
        {step === 4 && <StepConsistency    onNext={advance} />}
        {step === 5 && <StepBenefit        onNext={advance} />}
        {step === 6 && <StepPersonalization onNext={advance} />}
        {step === 7 && <StepFinalCTA       onFinish={() => router.replace('/(authenticated)/onboarding-complete')} />}
      </Animated.View>

      {/* Animated dot indicators */}
      <DotIndicator step={step} total={TOTAL_STEPS} />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOT INDICATOR — smooth width + opacity transition
// ═══════════════════════════════════════════════════════════════════════════════
function DotIndicator({ step, total }: { step: number; total: number }) {
  const anims = useRef(
    Array.from({ length: total }, (_, i) => ({
      width:   new Animated.Value(i === 0 ? 20 : 6),
      opacity: new Animated.Value(i === 0 ? 1  : 0.3),
    })),
  ).current;

  useEffect(() => {
    anims.forEach((a, i) => {
      Animated.parallel([
        Animated.timing(a.width,   { toValue: i === step ? 20 : 6,   duration: 240, useNativeDriver: false }),
        Animated.timing(a.opacity, { toValue: i === step ? 1  : 0.3, duration: 240, useNativeDriver: false }),
      ]).start();
    });
  }, [step]);

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingBottom: 22 }}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            width: a.width, height: 6, borderRadius: 3,
            backgroundColor: C.purple,
            opacity: a.opacity,
          }}
        />
      ))}
    </View>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const absFill = {
  position: 'absolute' as const,
  top: 0, left: 0, right: 0, bottom: 0,
};

function GlowOrb({
  size = 300, color = 'rgba(124,58,237,0.22)',
  top, bottom, left, right,
}: { size?: number; color?: string; top?: number; bottom?: number; left?: number; right?: number }) {
  return (
    <View pointerEvents="none" style={{
      position: 'absolute',
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color,
      top, bottom, left, right,
      transform: [{ scaleY: 0.5 }],
    }} />
  );
}

// Small floating sparkle particle
function Sparkle({ x, y, size = 5, delay = 0 }: { x: number; y: number; size?: number; delay?: number }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 0.85, duration: 700,  useNativeDriver: true }),
          Animated.timing(scale,      { toValue: 1,    duration: 700,  useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -18,  duration: 1600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 0,   duration: 500, useNativeDriver: true }),
          Animated.timing(scale,      { toValue: 0.4, duration: 500, useNativeDriver: true }),
        ]),
        Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', left: x, top: y,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: C.purpleLight,
      opacity, transform: [{ translateY }, { scale }],
    }} />
  );
}

function CTAButton({
  label, onPress, style, disabled = false,
}: { label: string; onPress: () => void; style?: any; disabled?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60 }).start();
  };
  const onOut = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 35 }).start();
  };

  return (
    <Animated.View
      style={[
        {
          width: '100%',
          alignSelf: 'stretch',
          transform: [{ scale }],
          shadowColor: C.purple,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: disabled ? 0 : 0.55,
          shadowRadius: 26,
          elevation: disabled ? 0 : 16,
          borderRadius: 26,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <Pressable
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        style={{ borderRadius: 26, overflow: 'hidden' }}
      >
        <LinearGradient
          colors={
            disabled
              ? ['#3f3f46', '#27272a', '#18181b']
              : ['#8b5cf6', '#7C3AED', '#6D28D9']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            minHeight: 60,
            paddingVertical: 18,
            paddingHorizontal: 24,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: disabled ? C.textLight : '#fff',
              fontSize: 17,
              fontWeight: '800',
              letterSpacing: 0.3,
              textAlign: 'center',
              writingDirection: 'rtl',
            }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// Shared title / subtitle styles — always centered
const T = {
  title: {
    color: C.white, fontSize: 30, fontWeight: '800' as const,
    textAlign: 'center' as const, lineHeight: 42,
    writingDirection: 'rtl' as const,
  },
  sub: {
    color: C.textLight, fontSize: 15, fontWeight: '400' as const,
    textAlign: 'center' as const, lineHeight: 24,
    writingDirection: 'rtl' as const,
  },
};

const physicalLeftToRightRow =
  rtl.flexDirection === 'row' ? 'row-reverse' : 'row';

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 0 — WELCOME
// ═══════════════════════════════════════════════════════════════════════════════
const WELCOME_SPARKLES = [
  { x: 48,  y: 130, size: 5, delay: 0    },
  { x: 300, y: 90,  size: 4, delay: 500  },
  { x: 32,  y: 310, size: 3, delay: 900  },
  { x: 318, y: 280, size: 5, delay: 300  },
  { x: 170, y: 60,  size: 3, delay: 1100 },
];

function StepWelcome({ onNext }: { onNext: () => void }) {
  const floatY     = useRef(new Animated.Value(0)).current;
  const entryFade  = useRef(new Animated.Value(0)).current;
  const entryY     = useRef(new Animated.Value(30)).current;
  const glowPulse  = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryFade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(entryY,    { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 7 }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY,    { toValue: -10, duration: 2100, useNativeDriver: true }),
        Animated.timing(floatY,    { toValue:  10, duration: 2100, useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1.2,  duration: 1600, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.8,  duration: 1600, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <GlowOrb size={460} color="rgba(124,58,237,0.18)" top={-100} left={-110} />
      <GlowOrb size={300} color="rgba(139,92,246,0.11)" bottom={50} right={-80} />

      {WELCOME_SPARKLES.map((s, i) => <Sparkle key={i} {...s} />)}

      <Animated.View style={{ alignItems: 'center', opacity: entryFade, transform: [{ translateY: entryY }] }}>

        {/* Logo with pulsing glow ring */}
        <Animated.View style={{
          transform: [{ translateY: floatY }],
          marginBottom: 44,
          alignItems: 'center',
        }}>
          <Animated.View pointerEvents="none" style={{
            position: 'absolute',
            width: 200, height: 200, borderRadius: 100,
            backgroundColor: 'rgba(124,58,237,0.20)',
            transform: [{ scaleY: 0.44 }, { scale: glowPulse }],
            top: 18, alignSelf: 'center',
          }} />
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ width: 138, height: 138 }}
            resizeMode="contain"
          />
        </Animated.View>

        <Text style={[T.title, { marginBottom: 16 }]}>
          ברוכים הבאים{'\n'}ל-Easy-M
        </Text>
        <Text style={[T.sub, { marginBottom: 56 }]}>
          העוזר השיווקי שייצור לעסק שלך{'\n'}פוסטים מקצועיים בכל שבוע
        </Text>

        <View style={{ width: '100%' }}>
          <CTAButton label="בוא נתחיל" onPress={onNext} />
        </View>
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 1 — WHAT IS EASY-M?
// ═══════════════════════════════════════════════════════════════════════════════
const EASYM_FEATURES = [
  { emoji: '🖼️', title: 'תמונות שיווקיות', sub: 'AI מעצב תמונה מקצועית לפי העסק שלך' },
  { emoji: '✍️', title: 'טקסט מוכן לפרסום', sub: 'כיתוב שיווקי שמדבר ישירות לקהל שלך'  },
  { emoji: '#️⃣', title: 'האשטגים אוטומטיים', sub: 'חשיפה מקסימלית — בלי לחפש בעצמך'     },
];

function StepWhatsEasyM({ onNext }: { onNext: () => void }) {
  const logoScale  = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleFade  = useRef(new Animated.Value(0)).current;
  const titleY     = useRef(new Animated.Value(18)).current;
  const itemAnims  = useRef(
    EASYM_FEATURES.map(() => ({
      opacity:    new Animated.Value(0),
      translateX: new Animated.Value(20),
    })),
  ).current;

  useEffect(() => {
    // Logo pop in
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1,  useNativeDriver: true, speed: 30, bounciness: 10 }),
      Animated.timing(logoOpacity, { toValue: 1,  duration: 400, useNativeDriver: true }),
    ]).start();

    // Title
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleFade, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(titleY,    { toValue: 0, useNativeDriver: true, speed: 40, bounciness: 5 }),
      ]).start();
    }, 220);

    // Staggered feature rows
    itemAnims.forEach((a, i) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(a.opacity,    { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.spring(a.translateX, { toValue: 0, useNativeDriver: true, speed: 40, bounciness: 5 }),
        ]).start();
      }, 480 + i * 140);
    });
  }, []);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 16, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Logo small header */}
      <Animated.View style={{
        alignItems: 'center', marginBottom: 28,
        opacity: logoOpacity, transform: [{ scale: logoScale }],
      }}>
        <Image
          source={require('@/assets/images/logo.png')}
          style={{ width: 72, height: 72 }}
          resizeMode="contain"
        />
        <View style={{
          marginTop: 8, paddingHorizontal: 14, paddingVertical: 4,
          borderRadius: 20, backgroundColor: C.purpleFaint,
          borderWidth: 1, borderColor: C.purpleBdr,
        }}>
          <Text style={{ color: C.purpleLight, fontSize: 13, fontWeight: '700' }}>Easy-M AI</Text>
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: titleFade, transform: [{ translateY: titleY }] }}>
        <Text style={[T.title, { marginBottom: 12 }]}>מה זה Easy-M?</Text>
        <Text style={[T.sub, { marginBottom: 32 }]}>
          עוזר שיווק AI שיוצר לעסק שלך תמונות, טקסטים{'\n'}והאשטגים מוכנים לפרסום — בלי לחשוב מה לכתוב{'\n'}ובלי לעצב לבד.
        </Text>
      </Animated.View>

      {/* Feature rows */}
      <View style={{ gap: 12, marginBottom: 32 }}>
        {EASYM_FEATURES.map((feat, i) => (
          <Animated.View
            key={feat.title}
            style={{
              opacity: itemAnims[i].opacity,
              transform: [{ translateX: itemAnims[i].translateX }],
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              backgroundColor: C.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: C.border,
              paddingVertical: 18,
              paddingHorizontal: 20,
            }}
          >
            <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
              <Text style={{ alignSelf: 'stretch', color: C.white, fontSize: 16, fontWeight: '700', textAlign: rtl.textAlign, writingDirection: 'rtl' }}>
                {feat.title}
              </Text>
              <Text style={{ alignSelf: 'stretch', color: C.textLight, fontSize: 13, marginTop: 3, textAlign: rtl.textAlign, writingDirection: 'rtl' }}>
                {feat.sub}
              </Text>
            </View>
            <View style={{
              width: 50, height: 50, borderRadius: 14,
              backgroundColor: C.purpleFaint,
              borderWidth: 1, borderColor: C.purpleBdr,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 24 }}>{feat.emoji}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <CTAButton label="המשך" onPress={onNext} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 2 — PAIN
// ═══════════════════════════════════════════════════════════════════════════════
function PainCard({
  label, selected, onPress, index,
}: { label: string; selected: boolean; onPress: () => void; index: number }) {
  const scale      = useRef(new Animated.Value(1)).current;
  const entryFade  = useRef(new Animated.Value(0)).current;
  const entryY     = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(entryFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(entryY,    { toValue: 0, useNativeDriver: true, speed: 42, bounciness: 5 }),
      ]).start();
    }, index * 100);
  }, []);

  const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 80 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50 }).start();

  return (
    <Animated.View style={{
      width: '100%',
      opacity: entryFade, transform: [{ translateY: entryY }, { scale }],
    }}>
      <Pressable
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        android_ripple={{ color: C.purpleMid }}
        style={({ pressed }) => ({
          backgroundColor: selected ? C.purpleMid : pressed ? '#1a1622' : C.card,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: selected ? C.purple : C.purpleBdr,
          paddingVertical: 18,
          paddingHorizontal: 18,
          width: '100%',
          position: 'relative',
          shadowColor:   selected ? C.purple : '#000',
          shadowOffset:  { width: 0, height: selected ? 8 : 3 },
          shadowOpacity: selected ? 0.45 : 0.25,
          shadowRadius:  selected ? 18 : 8,
          elevation:     selected ? 10 : 3,
        })}
      >
        <View style={{
          width: '100%',
          paddingEnd: 40,
          alignItems: 'stretch',
        }}>
          <Text style={{
            alignSelf: 'stretch',
            color: selected ? C.white : '#e4e4e7',
            fontSize: 16,
            fontWeight: selected ? '800' : '600',
            textAlign: rtl.textAlign,
            writingDirection: 'rtl',
          }}>
            {label}
          </Text>
        </View>

        {/* Logical end is the physical left edge in this native RTL screen. */}
        <View style={{
          position: 'absolute',
          end: 18,
          top: '50%',
          transform: [{ translateY: -13 }],
          width: 26,
          height: 26,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: selected ? C.purple : C.purpleBdr,
          backgroundColor: selected ? C.purple : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {selected ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function StepPain({
  selected, onToggle, onNext,
}: { selected: string[]; onToggle: (v: string) => void; onNext: () => void }) {
  const canContinue = selected.length > 0;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 22, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[T.title, { marginBottom: 12 }]}>
        מה הכי קשה לך{'\n'}בשיווק היום?
      </Text>
      <Text style={[T.sub, { marginBottom: 18 }]}>
        בחר את מה שהכי מפריע לך — כדי ש-Easy-M{'\n'}יבנה לך חוויה שמתאימה לעסק שלך.
      </Text>

      {/* Multi-select hint pill */}
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <View style={{
          backgroundColor: C.purpleFaint,
          borderWidth: 1,
          borderColor: C.purpleBdr,
          borderRadius: 999,
          paddingVertical: 6,
          paddingHorizontal: 14,
        }}>
          <Text style={{
            color: C.purpleLight,
            fontSize: 13,
            fontWeight: '700',
            textAlign: 'center',
            writingDirection: 'rtl',
          }}>
            בחר אפשרות אחת או יותר
          </Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        {PAIN_OPTIONS.map((opt, i) => (
          <PainCard
            key={opt}
            label={opt}
            selected={selected.includes(opt)}
            onPress={() => onToggle(opt)}
            index={i}
          />
        ))}
      </View>

      <View style={{ marginTop: 26 }}>
        <CTAButton label="המשך" onPress={onNext} disabled={!canContinue} />
      </View>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 3 — VALUE
// ═══════════════════════════════════════════════════════════════════════════════
const VALUE_CARDS = [
  { emoji: '🖼️', title: 'תמונה מקצועית',   sub: 'עיצוב AI מותאם לעסק שלך'         },
  { emoji: '✍️', title: 'טקסט שיווקי',     sub: 'כיתוב שמדבר ישירות לקהל שלך'    },
  { emoji: '#️⃣', title: 'האשטגים מוכנים',  sub: 'חשיפה מקסימלית בלי מאמץ'         },
];

function StepValue({ onNext }: { onNext: () => void }) {
  const cardAnims = useRef(
    VALUE_CARDS.map(() => ({
      opacity:    new Animated.Value(0),
      translateY: new Animated.Value(18),
    })),
  ).current;

  useEffect(() => {
    cardAnims.forEach((a, i) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(a.opacity,    { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.spring(a.translateY, { toValue: 0, useNativeDriver: true, speed: 40, bounciness: 5 }),
        ]).start();
      }, 200 + i * 130);
    });
  }, []);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 22, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[T.title, { writingDirection: 'ltr' }]}>Easy-M</Text>
      <Text style={[T.title, { marginBottom: 12, writingDirection: 'rtl' }]}>
        עושה את זה בשבילך
      </Text>
      <Text style={[T.sub, { marginBottom: 30, writingDirection: 'rtl' }]}>
        במקום לבזבז שעות על כתיבה ועיצוב,{'\n'}ה-AI יוצר לך פוסט שיווקי מוכן לשיתוף.
      </Text>

      <View style={{ gap: 12, marginBottom: 32 }}>
        {VALUE_CARDS.map((card, i) => (
          <Animated.View
            key={card.title}
            style={{
              opacity: cardAnims[i].opacity,
              transform: [{ translateY: cardAnims[i].translateY }],
              flexDirection: physicalLeftToRightRow,
              alignItems: 'center',
              gap: 18,
              backgroundColor: C.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: C.border,
              paddingVertical: 20,
              paddingHorizontal: 22,
            }}
          >
            <View style={{
              width: 52, height: 52, borderRadius: 14,
              backgroundColor: C.purpleFaint,
              borderWidth: 1, borderColor: C.purpleBdr,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 26 }}>{card.emoji}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, alignItems: 'stretch' }}>
              <Text style={{ alignSelf: 'stretch', color: C.white, fontSize: 16, fontWeight: '700', textAlign: rtl.textAlign, writingDirection: 'rtl' }}>
                {card.title}
              </Text>
              <Text style={{ alignSelf: 'stretch', color: C.textLight, fontSize: 13, marginTop: 3, textAlign: rtl.textAlign, writingDirection: 'rtl' }}>
                {card.sub}
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <CTAButton label="המשך" onPress={onNext} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 4 — CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════════════
function StepConsistency({ onNext }: { onNext: () => void }) {
  const badgeScale   = useRef(new Animated.Value(0.4)).current;
  const badgeFade    = useRef(new Animated.Value(0)).current;
  const pulseScale   = useRef(new Animated.Value(1)).current;
  const contentFade  = useRef(new Animated.Value(0)).current;
  const contentY     = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Badge pop in
    Animated.parallel([
      Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 14 }),
      Animated.timing(badgeFade,  { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Content fade after badge
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(contentY,    { toValue: 0, useNativeDriver: true, speed: 40, bounciness: 5 }),
      ]).start();
    }, 340);

    // Ongoing pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.07, duration: 950, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1.00, duration: 950, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <GlowOrb size={360} color="rgba(124,58,237,0.17)" top={-60} left={-80} />

      {/* Pulsing badge */}
      <Animated.View style={{
        opacity: badgeFade,
        transform: [{ scale: Animated.multiply(badgeScale, pulseScale) }],
        marginBottom: 38,
      }}>
        <View style={{
          width: 124, height: 124, borderRadius: 38,
          backgroundColor: C.purpleFaint,
          borderWidth: 2, borderColor: C.purpleBdr,
          alignItems: 'center', justifyContent: 'center',
          shadowColor: C.purple,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.55,
          shadowRadius: 28,
          elevation: 16,
        }}>
          <Text style={{ color: C.purple, fontSize: 54, fontWeight: '900', lineHeight: 62 }}>3</Text>
        </View>
      </Animated.View>

      <Animated.View style={{
        alignItems: 'center',
        opacity: contentFade,
        transform: [{ translateY: contentY }],
        width: '100%',
      }}>
        <Text style={[T.title, { marginBottom: 14 }]}>
          3 פוסטים חדשים{'\n'}בכל שבוע
        </Text>
        <Text style={[T.sub, { marginBottom: 52 }]}>
          כדי שהעסק שלך יישאר פעיל, נראה מקצועי{'\n'}וימשיך להופיע מול לקוחות.
        </Text>
        <CTAButton label="המשך" onPress={onNext} />
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 5 — BENEFIT
// ═══════════════════════════════════════════════════════════════════════════════
function StepBenefit({ onNext }: { onNext: () => void }) {
  const emojiScale = useRef(new Animated.Value(0.4)).current;
  const fade       = useRef(new Animated.Value(0)).current;
  const textY      = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.spring(emojiScale, { toValue: 1, useNativeDriver: true, speed: 26, bounciness: 12 }).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(textY, { toValue: 0, useNativeDriver: true, speed: 40, bounciness: 5 }),
      ]).start();
    }, 200);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <GlowOrb size={360} color="rgba(124,58,237,0.15)" bottom={40} right={-80} />

      <Animated.Text style={{ fontSize: 68, marginBottom: 34, transform: [{ scale: emojiScale }] }}>
        📣
      </Animated.Text>

      <Animated.View style={{ alignItems: 'center', opacity: fade, transform: [{ translateY: textY }], width: '100%' }}>
        <Text style={[T.title, { marginBottom: 14 }]}>
          יותר נוכחות.{'\n'}פחות התעסקות.
        </Text>
        <Text style={[T.sub, { marginBottom: 52 }]}>
          Easy-M עוזר לך להיראות כמו עסק{'\n'}שמפרסם בצורה קבועה ומקצועית,{'\n'}גם בלי מעצב ובלי מנהל סושיאל.
        </Text>
        <CTAButton label="המשך" onPress={onNext} />
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 6 — PERSONALIZATION TEASER
// ═══════════════════════════════════════════════════════════════════════════════
const TEASER_ITEMS = [
  { emoji: '🖼️', label: 'לוגו ותמונות עסק'  },
  { emoji: '📝', label: 'פרטי העסק שלך'     },
  { emoji: '🎨', label: 'סגנון ומותג אישי'  },
];

function StepPersonalization({ onNext }: { onNext: () => void }) {
  const headerFade = useRef(new Animated.Value(0)).current;
  const headerY    = useRef(new Animated.Value(18)).current;
  const itemAnims  = useRef(
    TEASER_ITEMS.map(() => ({
      opacity:    new Animated.Value(0),
      translateY: new Animated.Value(14),
    })),
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.spring(headerY,    { toValue: 0, useNativeDriver: true, speed: 40, bounciness: 5 }),
    ]).start();

    itemAnims.forEach((a, i) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(a.opacity,    { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(a.translateY, { toValue: 0, useNativeDriver: true, speed: 42, bounciness: 5 }),
        ]).start();
      }, 280 + i * 120);
    });
  }, []);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 22, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 52, textAlign: 'center', marginBottom: 26 }}>✨</Text>

      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerY }] }}>
        <Text style={[T.title, { marginBottom: 12 }]}>
          בהמשך נכיר{'\n'}את העסק שלך
        </Text>
        <Text style={[T.sub, { marginBottom: 30 }]}>
          אחרי ההרשמה תוכל להוסיף פרטים כדי{'\n'}שהפוסטים יהיו מותאמים אליך באמת.
        </Text>
      </Animated.View>

      <View style={{ gap: 10, marginBottom: 32 }}>
        {TEASER_ITEMS.map((item, i) => (
          <Animated.View
            key={item.label}
            style={{
              opacity: itemAnims[i].opacity,
              transform: [{ translateY: itemAnims[i].translateY }],
              flexDirection: physicalLeftToRightRow,
              alignItems: 'center',
              gap: 14,
              backgroundColor: C.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C.border,
              paddingVertical: 15,
              paddingHorizontal: 18,
            }}
          >
            <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
            <Text style={{ alignSelf: 'stretch', color: C.textLight, fontSize: 15, fontWeight: '500', flex: 1, minWidth: 0, textAlign: rtl.textAlign, writingDirection: 'rtl' }}>
              {item.label}
            </Text>
          </Animated.View>
        ))}
      </View>

      <CTAButton label="המשך" onPress={onNext} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN 7 — FINAL CTA
// ═══════════════════════════════════════════════════════════════════════════════
function StepFinalCTA({ onFinish }: { onFinish: () => void }) {
  const rocketScale = useRef(new Animated.Value(0.2)).current;
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentY    = useRef(new Animated.Value(24)).current;
  const ctaFade     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(rocketScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 16 }),
      Animated.parallel([
        Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(contentY,    { toValue: 0, useNativeDriver: true, speed: 38, bounciness: 6 }),
      ]),
      Animated.timing(ctaFade, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <GlowOrb size={440} color="rgba(124,58,237,0.20)" top={-90}  left={-100} />
      <GlowOrb size={260} color="rgba(167,139,250,0.11)" bottom={70} right={-60} />

      <Animated.Text style={{ fontSize: 74, marginBottom: 34, transform: [{ scale: rocketScale }] }}>
        🚀
      </Animated.Text>

      <Animated.View style={{
        alignItems: 'center', width: '100%',
        opacity: contentFade, transform: [{ translateY: contentY }],
      }}>
        <Text style={[T.title, { marginBottom: 14 }]}>
          השיווק שלך יכול לעבוד{'\n'}גם כשאתה עסוק
        </Text>
        <Text style={[T.sub, { marginBottom: 52 }]}>
          התחל ליצור פוסטים מקצועיים{'\n'}לעסק שלך עם AI.
        </Text>
      </Animated.View>

      <Animated.View style={{ width: '100%', opacity: ctaFade }}>
        <CTAButton label="להמשיך" onPress={onFinish} />
      </Animated.View>
    </View>
  );
}
