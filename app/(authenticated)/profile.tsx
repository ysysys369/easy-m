import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  Building2,
  CheckCircle2,
  Globe,
  MapPin,
  Sparkles,
  TrendingUp,
  Type,
  Zap,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoTopLeft } from '@/components/LogoTopLeft';
import { api } from '@/convex/_generated/api';
import { rtl } from '@/lib/rtl';

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
  textLight:   '#a1a1aa',
};

// ─── מפות תוויות ─────────────────────────────────────────────────────────────
const BUSINESS_TYPE_LABELS: Record<string, string> = {
  restaurant: '🍕  מסעדה / בית קפה',
  fitness:    '💪  כושר ובריאות',
  beauty:     '💆  קוסמטיקה ויופי',
  retail:     '🛍️  חנות קמעונאית',
  services:   '⚖️  שירותים מקצועיים',
  realestate: '🏠  נדל"ן',
  tech:       '📱  טכנולוגיה / דיגיטל',
  education:  '🎓  חינוך / הדרכה',
  other:      '🌟  אחר',
};

const EXPERIENCE_LABELS: Record<string, string> = {
  yes: '✅  כן, ניסיתי בעבר',
  no:  '❌  לא עדיין',
};

const GOAL_LABELS: Record<string, string> = {
  time:    '⏰  חיסכון בזמן',
  ideas:   '💡  רעיונות לתוכן',
  results: '📉  שיפור תוצאות',
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'אינסטגרם',
  facebook:  'פייסבוק',
  tiktok:    'טיקטוק',
};

// ─── שורת מידע בכרטיס ───────────────────────────────────────────────────────
function InfoRow({
  label,
  value,
  icon: Icon,
  last = false,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  last?: boolean;
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: rtl.flexDirection,
          alignItems: 'flex-start',
          gap: 12,
          paddingVertical: 14,
        }}
      >
        {/* ערך + תווית */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: value ? '#e4e4e7' : C.textSub,
              fontSize: 15,
              fontWeight: value ? '600' : '400',
              textAlign: 'right',
              writingDirection: 'rtl',
              lineHeight: 22,
            }}
          >
            {value || '—'}
          </Text>
          <Text
            style={{
              color: C.textMid,
              fontSize: 11,
              textAlign: 'right',
              writingDirection: 'rtl',
              marginTop: 3,
              letterSpacing: 0.4,
            }}
          >
            {label}
          </Text>
        </View>

        {/* אייקון */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: C.purpleFaint,
            borderWidth: 1,
            borderColor: C.purpleBdr,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
          }}
        >
          <Icon size={16} color={C.purple} />
        </View>
      </View>

      {!last && <View style={{ height: 1, backgroundColor: C.border }} />}
    </View>
  );
}

// ─── כרטיס מידע ──────────────────────────────────────────────────────────────
function InfoCard({
  title,
  titleIcon: TitleIcon,
  children,
}: {
  title: string;
  titleIcon: React.ComponentType<{ size: number; color: string }>;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: C.card,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: C.purpleBdr,
        padding: 20,
        marginBottom: 16,
        shadowColor: C.purple,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
      }}
    >
      {/* כותרת כרטיס */}
      <View
        style={{
          flexDirection: rtl.flexDirection,
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 8,
          marginBottom: 4,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' }}>{title}</Text>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: C.purpleFaint,
            borderWidth: 1,
            borderColor: C.purpleBdr,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TitleIcon size={15} color={C.purple} />
        </View>
      </View>

      {children}
    </View>
  );
}

// ─── מסך ראשי ────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const data   = useQuery(api.businessProfiles.getFullUserProfile);

  // טעינה
  if (data === undefined) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}
        edges={['top']}
      >
        <ActivityIndicator size="large" color={C.purple} />
      </SafeAreaView>
    );
  }

  const bp = data?.businessProfile;
  const oa = data?.onboardingAnswers;

  const platforms = Array.isArray(oa?.tone)
    ? oa.tone.map((p) => PLATFORM_LABELS[p] ?? p).join(' • ')
    : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <LogoTopLeft />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 80 }}>

          {/* ─── כותרת ─── */}
          <View
            style={{
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 10,
              marginBottom: 28,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' }}>
              הפרופיל שלי
            </Text>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                backgroundColor: C.purpleFaint,
                borderWidth: 1,
                borderColor: C.purpleBdr,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={22} color={C.purple} />
            </View>
          </View>

          {/* ─── כרטיס 1: פרטי העסק ─── */}
          <InfoCard title="פרטי העסק" titleIcon={Building2}>
            <InfoRow
              label="שם העסק"
              value={bp?.businessName ?? ''}
              icon={Building2}
            />
            <InfoRow
              label="תחום עסק"
              value={bp?.businessType ? (BUSINESS_TYPE_LABELS[bp.businessType] ?? bp.businessType) : ''}
              icon={Sparkles}
            />
            <InfoRow
              label="עיר"
              value={bp?.city ?? ''}
              icon={MapPin}
            />
            {bp?.website ? (
              <InfoRow
                label="אתר אינטרנט"
                value={bp.website}
                icon={Globe}
              />
            ) : null}
            <InfoRow
              label="תיאור העסק"
              value={bp?.description ?? ''}
              icon={Type}
              last
            />
          </InfoCard>

          {/* ─── כרטיס 2: פרופיל שיווקי ─── */}
          <InfoCard title="פרופיל שיווקי" titleIcon={TrendingUp}>
            <InfoRow
              label="פרסום בעבר"
              value={oa?.experienceLevel ? (EXPERIENCE_LABELS[oa.experienceLevel] ?? oa.experienceLevel) : ''}
              icon={CheckCircle2}
            />
            <InfoRow
              label="האתגר העיקרי"
              value={oa?.goal ? (GOAL_LABELS[oa.goal] ?? oa.goal) : ''}
              icon={TrendingUp}
            />
            <InfoRow
              label="פלטפורמות פרסום"
              value={platforms}
              icon={Globe}
              last
            />
          </InfoCard>

          {/* ─── כפתור עריכה ─── */}
          <Pressable
            onPress={() => router.push('/(authenticated)/business-profile')}
            style={{
              backgroundColor: C.purple,
              borderRadius: 22,
              paddingVertical: 18,
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginTop: 8,
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.45,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <Zap size={18} color="#fff" fill="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              ערוך פרטים ⚡
            </Text>
          </Pressable>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
