import { useMutation } from 'convex/react';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';

// ─── קבועים ─────────────────────────────────────────────────────────────────
const SCREEN_W = Dimensions.get('window').width;

const C = {
  bg:          '#0a0a0a',
  card:        '#111114',
  purple:      '#7C3AED',
  purpleFaint: 'rgba(124,58,237,0.12)',
  purpleBdr:   'rgba(124,58,237,0.35)',
  purpleMid:   'rgba(124,58,237,0.22)',
  purpleDeep:  '#5b21b6',
  border:      'rgba(63,63,70,0.55)',
  textSub:     '#52525b',
  textMid:     '#71717a',
  textLight:   '#a1a1aa',
};

// ─── נתוני carousel ──────────────────────────────────────────────────────────
const SLIDES = [
  {
    icon:     Zap,
    bg:       'rgba(124,58,237,0.14)',
    glow:     'rgba(124,58,237,0.30)',
    title:    'צור פוסטים לעסק שלך\nבשניות ⚡',
    subtitle: 'AI חכם שמייצר תוכן שמביא לקוחות',
    tag:      'יצירת תוכן',
  },
  {
    icon:     Clock,
    bg:       'rgba(99,102,241,0.14)',
    glow:     'rgba(99,102,241,0.28)',
    title:    'חסוך שעות עבודה\nכל שבוע',
    subtitle: 'אנחנו יוצרים את התוכן – אתה מתמקד בעסק',
    tag:      'חיסכון בזמן',
  },
  {
    icon:     TrendingUp,
    bg:       'rgba(139,92,246,0.14)',
    glow:     'rgba(139,92,246,0.28)',
    title:    'יותר לקוחות,\nפחות מאמץ',
    subtitle: 'תוכן מקצועי שמגדיל חשיפה ומכירות',
    tag:      'צמיחה',
  },
];

// ─── נתוני שאלות ─────────────────────────────────────────────────────────────
const QUIZ: {
  id: string;
  question: string;
  type: 'single' | 'multi';
  options: { label: string; value: string }[];
}[] = [
  {
    id: 'industry',
    question: 'במה אתה עוסק?',
    type: 'single',
    options: [
      { label: '🍕  מסעדה / בית קפה',    value: 'restaurant' },
      { label: '💪  כושר ובריאות',        value: 'fitness'    },
      { label: '💆  קוסמטיקה ויופי',      value: 'beauty'     },
      { label: '🏠  נדל״ן',               value: 'realestate' },
      { label: '🌟  אחר',                 value: 'other'      },
    ],
  },
  {
    id: 'published',
    question: 'האם ניסית לפרסם בעבר?',
    type: 'single',
    options: [
      { label: '✅  כן, ניסיתי',          value: 'yes' },
      { label: '❌  לא עדיין',            value: 'no'  },
    ],
  },
  {
    id: 'challenge',
    question: 'מה הכי קשה לך?',
    type: 'single',
    options: [
      { label: '⏰  אין זמן',             value: 'time'    },
      { label: '💡  אין רעיונות',         value: 'ideas'   },
      { label: '📉  אין תוצאות',          value: 'results' },
    ],
  },
  {
    id: 'platforms',
    question: 'איפה אתה מפרסם?',
    type: 'multi',
    options: [
      { label: '📸  אינסטגרם', value: 'instagram' },
      { label: '🔵  פייסבוק',  value: 'facebook'  },
      { label: '🎵  טיקטוק',   value: 'tiktok'    },
    ],
  },
];

// ─── סוגי שלבים ──────────────────────────────────────────────────────────────
type Phase = 'carousel' | 'quiz' | 'paywall';
type QuizAnswers = Record<string, string | string[]>;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function OnboardingScreen() {
  const [phase,        setPhase]        = useState<Phase>('carousel');
  const [slideIndex,   setSlideIndex]   = useState(0);
  const [quizStep,     setQuizStep]     = useState(0);
  const [quizAnswers,  setQuizAnswers]  = useState<QuizAnswers>({});
  const [isSaving,     setIsSaving]     = useState(false);

  const saveAnswers = useMutation(api.onboardingAnswers.saveOnboardingAnswers);

  // אנימציות מעבר בין שלבים
  const phaseOpacity = useRef(new Animated.Value(1)).current;
  const phaseTransY  = useRef(new Animated.Value(0)).current;

  // אנימציית שאלה בתוך quiz
  const qOpacity   = useRef(new Animated.Value(1)).current;
  const qTranslate = useRef(new Animated.Value(0)).current;

  const carouselRef = useRef<ScrollView>(null);

  // ─── מעבר בין phases ──────────────────────────────────────────────────────
  const goToPhase = (next: Phase) => {
    Animated.parallel([
      Animated.timing(phaseOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(phaseTransY,  { toValue: -18, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setPhase(next);
      if (next === 'quiz') { setQuizStep(0); qOpacity.setValue(1); qTranslate.setValue(0); }
      phaseTransY.setValue(20);
      Animated.parallel([
        Animated.timing(phaseOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.spring(phaseTransY,  { toValue: 0, useNativeDriver: true, speed: 50, bounciness: 4 }),
      ]).start();
    });
  };

  // ─── מעבר בין שאלות ───────────────────────────────────────────────────────
  const nextQuestion = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(qOpacity,    { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(qTranslate,  { toValue: -SCREEN_W * 0.25, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setQuizStep(nextStep);
      qTranslate.setValue(SCREEN_W * 0.25);
      Animated.parallel([
        Animated.timing(qOpacity,   { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(qTranslate, { toValue: 0, useNativeDriver: true, speed: 50, bounciness: 3 }),
      ]).start();
    });
  };

  // ─── carousel: עדכון dot ──────────────────────────────────────────────────
  const onCarouselScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setSlideIndex(idx);
  };

  const handleCarouselNext = () => {
    if (slideIndex < SLIDES.length - 1) {
      carouselRef.current?.scrollTo({ x: (slideIndex + 1) * SCREEN_W, animated: true });
    } else {
      goToPhase('quiz');
    }
  };

  // ─── quiz: בחירת תשובה ────────────────────────────────────────────────────
  const selectAnswer = (questionId: string, value: string, type: 'single' | 'multi') => {
    setQuizAnswers((prev) => {
      if (type === 'single') {
        return { ...prev, [questionId]: value };
      }
      const current = (prev[questionId] as string[]) || [];
      const exists  = current.includes(value);
      return {
        ...prev,
        [questionId]: exists ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  };

  const isAnswered = (q: (typeof QUIZ)[number]): boolean => {
    const ans = quizAnswers[q.id];
    if (q.type === 'single') return typeof ans === 'string' && ans.length > 0;
    return Array.isArray(ans) && ans.length > 0;
  };

  const handleQuizNext = async () => {
    if (quizStep < QUIZ.length - 1) {
      nextQuestion(quizStep + 1);
      return;
    }
    // שאלה אחרונה — שמירה ב-DB לפני מעבר ל-paywall
    setIsSaving(true);
    try {
      await saveAnswers({
        businessType:    typeof quizAnswers.industry  === 'string' ? quizAnswers.industry  : undefined,
        experienceLevel: typeof quizAnswers.published === 'string' ? quizAnswers.published : undefined,
        goal:            typeof quizAnswers.challenge === 'string' ? quizAnswers.challenge : undefined,
        tone:            Array.isArray(quizAnswers.platforms)      ? quizAnswers.platforms : undefined,
      });
    } catch {
      // ממשיכים ל-paywall גם אם השמירה נכשלה (למשל משתמש לא מחובר)
    } finally {
      setIsSaving(false);
    }
    goToPhase('paywall');
  };

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <Animated.View
        style={{
          flex: 1,
          opacity: phaseOpacity,
          transform: [{ translateY: phaseTransY }],
        }}
      >
        {phase === 'carousel' && (
          <CarouselPhase
            slides={SLIDES}
            slideIndex={slideIndex}
            carouselRef={carouselRef}
            onScroll={onCarouselScroll}
            onNext={handleCarouselNext}
          />
        )}
        {phase === 'quiz' && (
          <QuizPhase
            quiz={QUIZ}
            quizStep={quizStep}
            quizAnswers={quizAnswers}
            onSelect={selectAnswer}
            onNext={handleQuizNext}
            isAnswered={isAnswered}
            qOpacity={qOpacity}
            qTranslate={qTranslate}
            isSaving={isSaving}
          />
        )}
        {phase === 'paywall' && (
          <PaywallPhase />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAROUSEL PHASE
// ═══════════════════════════════════════════════════════════════════════════════
function CarouselPhase({
  slides,
  slideIndex,
  carouselRef,
  onScroll,
  onNext,
}: {
  slides: typeof SLIDES;
  slideIndex: number;
  carouselRef: React.RefObject<ScrollView>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onNext: () => void;
}) {
  const btnScale = useRef(new Animated.Value(1)).current;
  const btnIn  = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start();
  const btnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 35 }).start();
  const isLast = slideIndex === slides.length - 1;

  return (
    <View style={{ flex: 1 }}>
      {/* Slides */}
      <ScrollView
        ref={carouselRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
        scrollEventThrottle={16}
      >
        {slides.map((slide, i) => {
          const Icon = slide.icon;
          return (
            <View
              key={i}
              style={{
                width: SCREEN_W,
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 32,
              }}
            >
              {/* Purple mist */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: SCREEN_W * 0.1,
                  right: SCREEN_W * 0.1,
                  height: 260,
                  backgroundColor: slide.glow,
                  borderRadius: 999,
                  transform: [{ scaleX: 1.4 }, { scaleY: 0.5 }],
                  opacity: 0.35,
                }}
              />

              {/* Illustration */}
              <View style={{ alignItems: 'center', marginBottom: 44 }}>
                {/* Outer glow ring */}
                <View
                  style={{
                    position: 'absolute',
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    backgroundColor: slide.bg,
                    transform: [{ scale: 1.6 }],
                  }}
                />
                {/* Inner ring */}
                <View
                  style={{
                    position: 'absolute',
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    borderWidth: 1,
                    borderColor: C.purpleBdr,
                    transform: [{ scale: 1.2 }],
                  }}
                />
                {/* Icon box */}
                <View
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 36,
                    backgroundColor: slide.bg,
                    borderWidth: 1.5,
                    borderColor: C.purpleBdr,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: C.purple,
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.45,
                    shadowRadius: 24,
                    elevation: 12,
                  }}
                >
                  <Icon size={52} color={C.purple} />
                </View>
              </View>

              {/* Tag pill */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: C.purpleFaint,
                  borderRadius: 20,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderWidth: 1,
                  borderColor: C.purpleBdr,
                  marginBottom: 20,
                }}
              >
                <Sparkles size={12} color={C.purple} />
                <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '700' }}>
                  {slide.tag}
                </Text>
              </View>

              {/* Texts */}
              <Text
                style={{
                  color: '#fff',
                  fontSize: 30,
                  fontWeight: '800',
                  textAlign: 'center',
                  lineHeight: 40,
                  marginBottom: 14,
                }}
              >
                {slide.title}
              </Text>
              <Text
                style={{
                  color: C.textLight,
                  fontSize: 16,
                  textAlign: 'center',
                  lineHeight: 24,
                }}
              >
                {slide.subtitle}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Dots + CTA */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
        {/* Dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={{
                height: 6,
                width: i === slideIndex ? 24 : 6,
                borderRadius: 3,
                backgroundColor: i === slideIndex ? C.purple : C.border,
              }}
            />
          ))}
        </View>

        {/* CTA button */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable
            onPressIn={btnIn}
            onPressOut={btnOut}
            onPress={onNext}
            style={{
              backgroundColor: C.purple,
              borderRadius: 22,
              paddingVertical: 18,
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
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
              {isLast ? 'בוא נתחיל ⚡' : 'המשך ➡️'}
            </Text>
          </Pressable>
        </Animated.View>

        {/* Skip */}
        {!isLast && (
          <Text style={{ color: C.textSub, textAlign: 'center', fontSize: 13, marginTop: 14 }}>
            דלג
          </Text>
        )}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ PHASE
// ═══════════════════════════════════════════════════════════════════════════════
function QuizPhase({
  quiz,
  quizStep,
  quizAnswers,
  onSelect,
  onNext,
  isAnswered,
  qOpacity,
  qTranslate,
  isSaving = false,
}: {
  quiz: typeof QUIZ;
  quizStep: number;
  quizAnswers: QuizAnswers;
  onSelect: (id: string, val: string, type: 'single' | 'multi') => void;
  onNext: () => void;
  isAnswered: (q: (typeof QUIZ)[number]) => boolean;
  qOpacity: Animated.Value;
  qTranslate: Animated.Value;
  isSaving?: boolean;
}) {
  const question = quiz[quizStep];
  const answered = isAnswered(question);
  const isLast   = quizStep === quiz.length - 1;
  const progress = (quizStep + 1) / quiz.length;

  const btnScale = useRef(new Animated.Value(1)).current;
  const btnIn  = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start();
  const btnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 35 }).start();

  const isSelected = (value: string): boolean => {
    const ans = quizAnswers[question.id];
    if (question.type === 'single') return ans === value;
    return Array.isArray(ans) && ans.includes(value);
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>

        {/* Header fixed */}
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'right', marginBottom: 6 }}>
          בוא נכיר את העסק שלך
        </Text>
        <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'right', marginBottom: 24 }}>
          {quizStep + 1} מתוך {quiz.length} שאלות
        </Text>

        {/* Progress bar */}
        <View
          style={{
            height: 4,
            backgroundColor: C.border,
            borderRadius: 2,
            marginBottom: 36,
            overflow: 'hidden',
          }}
        >
          <Animated.View
            style={{
              height: 4,
              width: `${progress * 100}%`,
              backgroundColor: C.purple,
              borderRadius: 2,
            }}
          />
        </View>

        {/* Animated question container */}
        <Animated.View
          style={{
            opacity: qOpacity,
            transform: [{ translateX: qTranslate }],
          }}
        >
          {/* Question */}
          <Text
            style={{
              color: '#fff',
              fontSize: 24,
              fontWeight: '800',
              textAlign: 'right',
              marginBottom: 24,
              lineHeight: 34,
            }}
          >
            {question.question}
          </Text>

          {question.type === 'multi' && (
            <Text style={{ color: C.textMid, fontSize: 12, textAlign: 'right', marginBottom: 14 }}>
              ניתן לבחור יותר מאחד
            </Text>
          )}

          {/* Options */}
          <View style={{ gap: 12, marginBottom: 36 }}>
            {question.options.map((opt) => {
              const selected = isSelected(opt.value);
              return (
                <OptionCard
                  key={opt.value}
                  label={opt.label}
                  selected={selected}
                  onPress={() => onSelect(question.id, opt.value, question.type)}
                />
              );
            })}
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable
            onPressIn={(answered && !isSaving) ? btnIn : undefined}
            onPressOut={(answered && !isSaving) ? btnOut : undefined}
            onPress={(answered && !isSaving) ? onNext : undefined}
            disabled={isSaving}
            style={{
              backgroundColor: answered ? C.purple : C.purpleDeep,
              borderRadius: 22,
              paddingVertical: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: answered ? 0.50 : 0.20,
              shadowRadius: 20,
              elevation: answered ? 12 : 3,
              opacity: answered ? 1 : 0.55,
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Zap size={18} color="#fff" fill="#fff" />
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
                  {isLast ? 'סיימתי ⚡' : 'המשך ⚡'}
                </Text>
              </>
            )}
          </Pressable>
        </Animated.View>

      </View>
    </ScrollView>
  );
}

// ─── כרטיס אפשרות בחירה ─────────────────────────────────────────────────────
function OptionCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 70 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50 }).start();

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
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 18,
          backgroundColor: selected ? C.purpleFaint : C.card,
          borderWidth: 1.5,
          borderColor: selected ? C.purple : C.border,
          shadowColor: selected ? C.purple : 'transparent',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: selected ? 0.28 : 0,
          shadowRadius: 10,
          elevation: selected ? 5 : 0,
        }}
      >
        {/* Check indicator */}
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: selected ? 0 : 1.5,
            borderColor: C.border,
            backgroundColor: selected ? C.purple : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && <CheckCircle2 size={16} color="#fff" fill={C.purple} />}
        </View>

        {/* Label */}
        <Text
          style={{
            flex: 1,
            color: selected ? '#e4e4e7' : C.textLight,
            fontSize: 15,
            fontWeight: selected ? '700' : '400',
            textAlign: 'right',
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYWALL PHASE
// ═══════════════════════════════════════════════════════════════════════════════
function PaywallPhase() {
  const btnScale = useRef(new Animated.Value(1)).current;
  const btnIn  = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start();
  const btnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 35 }).start();

  const FEATURES = [
    { icon: Zap,      text: 'פוסטים מוכנים תוך שניות'    },
    { icon: Sparkles, text: 'מותאם אישית לעסק שלך'       },
    { icon: Clock,    text: 'חוסך שעות עבודה כל שבוע'   },
  ];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>

        {/* ─── Purple glow mist ─── */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: -40,
            right: -40,
            height: 200,
            backgroundColor: 'rgba(124,58,237,0.22)',
            borderRadius: 999,
            transform: [{ scaleX: 1.2 }, { scaleY: 0.4 }],
            opacity: 0.5,
          }}
        />

        {/* ─── Icon ─── */}
        <View style={{ alignItems: 'center', marginBottom: 28, marginTop: 8 }}>
          <View style={{ position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(124,58,237,0.12)', transform: [{ scale: 2 }] }} />
          <View
            style={{
              width: 90,
              height: 90,
              borderRadius: 28,
              backgroundColor: C.purpleFaint,
              borderWidth: 1.5,
              borderColor: C.purpleBdr,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.50,
              shadowRadius: 24,
              elevation: 14,
            }}
          >
            <Sparkles size={42} color={C.purple} />
          </View>
        </View>

        {/* ─── Texts ─── */}
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', lineHeight: 38, marginBottom: 10 }}>
          תתחיל לקבל פוסטים{'\n'}מוכנים כבר היום
        </Text>
        <Text style={{ color: C.textLight, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          נסה עכשיו בחינם וקבל את הפוסט הראשון שלך
        </Text>

        {/* ─── Feature cards ─── */}
        <View
          style={{
            backgroundColor: C.card,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: C.purpleBdr,
            padding: 20,
            gap: 0,
            marginBottom: 24,
            shadowColor: C.purple,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.20,
            shadowRadius: 20,
            elevation: 8,
          }}
        >
          {FEATURES.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <View key={i}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingVertical: 14,
                  }}
                >
                  {/* Icon bubble */}
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
                    <Icon size={18} color={C.purple} />
                  </View>
                  <Text style={{ flex: 1, color: '#e4e4e7', fontSize: 15, fontWeight: '600', textAlign: 'right' }}>
                    {feat.text}
                  </Text>
                  {/* Check */}
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: C.purple,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>
                  </View>
                </View>
                {i < FEATURES.length - 1 && (
                  <View style={{ height: 1, backgroundColor: C.border }} />
                )}
              </View>
            );
          })}
        </View>

        {/* ─── Price card ─── */}
        <View
          style={{
            backgroundColor: C.purpleFaint,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: C.purpleBdr,
            padding: 20,
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <Text style={{ color: C.textLight, fontSize: 13, marginBottom: 6 }}>
            ללא התחייבות
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ color: C.textMid, fontSize: 16, marginBottom: 4 }}>₪</Text>
            <Text style={{ color: '#fff', fontSize: 48, fontWeight: '900', lineHeight: 56 }}>99</Text>
            <Text style={{ color: C.textMid, fontSize: 15, marginBottom: 8 }}>/חודש</Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: C.purpleMid,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 5,
              marginTop: 4,
            }}
          >
            <Sparkles size={12} color="#a78bfa" />
            <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '700' }}>
              הפוסט הראשון — חינם!
            </Text>
          </View>
        </View>

        {/* ─── CTA ─── */}
        <Animated.View style={{ transform: [{ scale: btnScale }], marginBottom: 14 }}>
          <Pressable
            onPressIn={btnIn}
            onPressOut={btnOut}
            style={{
              backgroundColor: C.purple,
              borderRadius: 22,
              paddingVertical: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.55,
              shadowRadius: 20,
              elevation: 14,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>
              התחל עכשיו 🚀
            </Text>
          </Pressable>
        </Animated.View>

        {/* Skip */}
        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Text style={{ color: C.textSub, fontSize: 14 }}>אולי אחר כך</Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}
