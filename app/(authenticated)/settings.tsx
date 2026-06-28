import { useAuthActions } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  Building2,
  Check,
  ChevronLeft,
  CreditCard,
  Image as ImageIcon,
  LayoutTemplate,
  LogOut,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRevenueCat } from '@/contexts/RevenueCatContext';
import { api } from '@/convex/_generated/api';
import { rtl, tw } from '@/lib/rtl';
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
        <Icon size={20} color={iconColor} />
        <Text style={{ flex: 1, color, fontSize: 15, fontWeight: '600', textAlign: 'left' }}>
          {label}
        </Text>
        <ChevronLeft size={18} color={C.textMid} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── סוג תמונה לפוסט ───────────────────────────────────────────────────────
type PostImageType = 'photo' | 'designed' | 'premium_ad';

const POST_IMAGE_TYPE_OPTIONS: ReadonlyArray<{
  value: PostImageType;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  recommended?: boolean;
}> = [
  {
    value: 'premium_ad',
    title: 'פוסטר פרסומת פרימיום',
    subtitle: 'מודעה מעוצבת עם כותרת חזקה, טיפוגרפיה בולטת וצבעי מותג',
    icon: Sparkles,
    recommended: true,
  },
  {
    value: 'designed',
    title: 'פוסט מעוצב',
    subtitle: 'תמונה מקצועית עם כותרת קצרה ועיצוב גרפי נקי',
    icon: LayoutTemplate,
  },
  {
    value: 'photo',
    title: 'תמונה בלבד',
    subtitle: 'תמונה פרסומית נקייה ללא טקסט מודפס על הפוסט',
    icon: ImageIcon,
  },
];

function ImageTypeOption({
  value,
  title,
  subtitle,
  icon: Icon,
  recommended,
  selected,
  loading,
  onPress,
  delay,
}: {
  value: PostImageType;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  recommended?: boolean;
  selected: boolean;
  loading: boolean;
  onPress: (next: PostImageType) => void;
  delay: number;
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

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={() => onPress(value)}
        disabled={loading}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={title}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderRadius: 18,
          backgroundColor: selected ? C.purpleFaint : C.card,
          borderWidth: 1.5,
          borderColor: selected ? C.purple : C.border,
          shadowColor: C.purple,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: selected ? 0.30 : 0.08,
          shadowRadius: 10,
          elevation: selected ? 6 : 2,
        }}
      >
        {/* Selection mark */}
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: selected ? C.purple : 'transparent',
            borderWidth: 1.5,
            borderColor: selected ? C.purple : C.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && <Check size={14} color="#fff" strokeWidth={3} />}
        </View>

        {/* Title + subtitle */}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 8,
              marginBottom: 4,
            }}
          >
            {recommended && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 8,
                  backgroundColor: 'rgba(124,58,237,0.18)',
                  borderWidth: 1,
                  borderColor: C.purpleBdr,
                }}
              >
                <Text style={{ color: '#c4b5fd', fontSize: 10, fontWeight: '700' }}>מומלץ</Text>
              </View>
            )}
            <Text
              style={{
                color: selected ? '#fff' : '#e4e4e7',
                fontSize: 15,
                fontWeight: '700',
                textAlign: 'left',
              }}
            >
              {title}
            </Text>
          </View>
          <Text
            style={{
              color: C.textMid,
              fontSize: 12,
              lineHeight: 18,
              textAlign: 'left',
            }}
          >
            {subtitle}
          </Text>
        </View>

        {/* Icon */}
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: selected ? C.purple : C.purpleFaint,
            borderWidth: 1,
            borderColor: selected ? C.purple : C.purpleBdr,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} color={selected ? '#fff' : C.purple} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── מסך הגדרות ────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isPremium } = useRevenueCat();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteConfirm2, setShowDeleteConfirm2] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteMyAccount = useMutation(api.users.deleteMyAccount);

  const businessProfile = useQuery(api.businessProfiles.getMyBusinessProfile);
  const updatePostImageType = useMutation(api.businessProfiles.updatePostImageType);
  const [savingImageType, setSavingImageType] = useState<PostImageType | null>(null);

  // Default to premium_ad when the user hasn't picked anything yet
  const currentImageType: PostImageType =
    (businessProfile?.postImageType as PostImageType | undefined) ?? 'premium_ad';

  const handlePickImageType = async (next: PostImageType) => {
    if (savingImageType || !businessProfile) return;
    if (next === currentImageType) return;
    setSavingImageType(next);
    try {
      await updatePostImageType({ postImageType: next });
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור את ההעדפה. נסה שנית.');
    } finally {
      setSavingImageType(null);
    }
  };

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

  const handleDeleteAccount = () => setShowDeleteModal(true);

  const confirmDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteMyAccount();
      await signOut();
      // _layout.tsx redirects to sign-in automatically when isAuthenticated becomes false
    } catch {
      setIsDeleting(false);
      setShowDeleteModal(false);
      Alert.alert('שגיאה', 'מחיקת החשבון נכשלה. אנא נסה שוב או פנה לתמיכה.');
    }
  };

  // ============================================================================
  // רינדור
  // ============================================================================

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
          <Animated.View
            style={{
              opacity: headerAnim,
              transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'flex-start',
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
              textAlign: 'left',
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
              {/* כותרת + אייקון */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color={isPremium ? C.purple : C.textMid} />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'left' }}>
                  סטטוס מנוי
                </Text>
              </View>

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
            </View>
          </Animated.View>

          {/* ─── סוג תמונה לפוסט ─── */}
          {businessProfile && (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    color: C.textSub,
                    fontSize: 11,
                    textAlign: 'left',
                          flex: 1,
                    marginStart: 12,
                  }}
                >
                  משפיע על כל הפוסטים שתיצרו מעכשיו
                </Text>
                <Text
                  style={{
                    color: C.textSub,
                    fontSize: 12,
                    fontWeight: '600',
                    letterSpacing: 0.8,
                    textAlign: 'left',
                        }}
                >
                  סוג תמונה לפוסט
                </Text>
              </View>
              <View style={{ gap: 10, marginBottom: 28 }}>
                {POST_IMAGE_TYPE_OPTIONS.map((opt, i) => (
                  <ImageTypeOption
                    key={opt.value}
                    value={opt.value}
                    title={opt.title}
                    subtitle={opt.subtitle}
                    icon={opt.icon}
                    recommended={opt.recommended}
                    selected={currentImageType === opt.value}
                    loading={savingImageType !== null}
                    onPress={handlePickImageType}
                    delay={i * 60}
                  />
                ))}
              </View>
            </>
          )}

          {/* ─── פעולות ─── */}
          <Text
            style={{
              color: C.textSub,
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: 0.8,
              textAlign: 'left',
              marginBottom: 12,
            }}
          >
            פעולות חשבון
          </Text>
          <View style={{ gap: 10, marginBottom: 28 }}>
            <ActionRow icon={Building2}  label="פרטי העסק"  onPress={() => router.push('/(authenticated)/business-details')} delay={20} />
            <ActionRow icon={CreditCard} label="ניהול מנוי"  onPress={() => router.push('/(authenticated)/paywall')}          delay={60} />
            <ActionRow icon={LogOut}     label="התנתקות"     onPress={handleSignOut}      delay={100} />
            <ActionRow icon={Trash2}     label="מחיקת חשבון" onPress={handleDeleteAccount} delay={180} destructive />
          </View>

          {/* Debug console, dev preview links, "אפס מכסת פוסטים לבדיקה",
              UI-state toggle and dev-mode banners were removed pre-TestFlight
              so no dev/test UI can appear to real users in any build profile. */}

        </View>
      </ScrollView>
      {/* ─── מודל אישור מחיקת חשבון ─── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!isDeleting) setShowDeleteModal(false); }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.72)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
          }}
          onPress={() => { if (!isDeleting) setShowDeleteModal(false); }}
        >
          <Pressable
            style={{
              width: '100%',
              backgroundColor: '#111114',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.30)',
              padding: 28,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.5,
              shadowRadius: 24,
              elevation: 20,
            }}
          >
            {/* כותרת */}
            <Text
              style={{
                color: '#fff',
                fontSize: 20,
                fontWeight: '800',
                textAlign: 'right',
                marginBottom: 14,
              }}
            >
              מחיקת חשבון
            </Text>

            {/* טקסט */}
            <Text
              style={{
                color: '#a1a1aa',
                fontSize: 15,
                lineHeight: 24,
                textAlign: 'right',
                marginBottom: 28,
              }}
            >
              הפעולה תמחק את החשבון והנתונים שלך מהאפליקציה. לא ניתן לבטל את הפעולה.
            </Text>

            {/* כפתורים */}
            <View style={{ gap: 10 }}>
              {/* אישור — פותח אישור שני */}
              <Pressable
                onPress={() => {
                  setShowDeleteModal(false);
                  setShowDeleteConfirm2(true);
                }}
                style={{
                  backgroundColor: '#ef4444',
                  borderRadius: 14,
                  paddingVertical: 15,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  מחק חשבון
                </Text>
              </Pressable>

              {/* ביטול */}
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                style={{
                  borderRadius: 14,
                  paddingVertical: 15,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.10)',
                }}
              >
                <Text style={{ color: '#a1a1aa', fontSize: 15, fontWeight: '600' }}>
                  ביטול
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── אישור שני (בלתי הפיך) ─── */}
      <Modal
        visible={showDeleteConfirm2}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!isDeleting) setShowDeleteConfirm2(false); }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.80)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
          }}
          onPress={() => { if (!isDeleting) setShowDeleteConfirm2(false); }}
        >
          <Pressable
            style={{
              width: '100%',
              backgroundColor: '#111114',
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.45)',
              padding: 28,
              shadowColor: '#ef4444',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.20,
              shadowRadius: 24,
              elevation: 20,
            }}
          >
            {/* כותרת */}
            <Text
              style={{
                color: '#fff',
                fontSize: 20,
                fontWeight: '800',
                textAlign: 'right',
                marginBottom: 14,
              }}
            >
              אתה בטוח?
            </Text>

            {/* טקסט */}
            <Text
              style={{
                color: '#a1a1aa',
                fontSize: 15,
                lineHeight: 24,
                textAlign: 'right',
                marginBottom: 28,
              }}
            >
              כל הפוסטים, פרטי העסק והנתונים שלך יימחקו לצמיתות.
            </Text>

            {/* כפתורים */}
            <View style={{ gap: 10 }}>
              {/* מחיקה סופית */}
              <Pressable
                onPress={confirmDeleteAccount}
                disabled={isDeleting}
                style={{
                  backgroundColor: isDeleting ? 'rgba(239,68,68,0.40)' : '#ef4444',
                  borderRadius: 14,
                  paddingVertical: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                {isDeleting && <ActivityIndicator size="small" color="#fff" />}
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  {isDeleting ? 'מוחק...' : 'כן, מחק לצמיתות'}
                </Text>
              </Pressable>

              {/* ביטול */}
              <Pressable
                onPress={() => setShowDeleteConfirm2(false)}
                disabled={isDeleting}
                style={{
                  borderRadius: 14,
                  paddingVertical: 15,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.10)',
                }}
              >
                <Text style={{ color: '#a1a1aa', fontSize: 15, fontWeight: '600' }}>
                  ביטול
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
