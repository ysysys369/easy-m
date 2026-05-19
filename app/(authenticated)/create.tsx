import { useAction, useMutation, useQuery } from 'convex/react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import {
  BookMarked,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Instagram,
  MessageCircle,
  Pencil,
  RefreshCw,
  Share2,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import type { ViewStyle } from 'react-native';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share as NativeShare,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { LogoTopLeft } from '@/components/LogoTopLeft';
import { api } from '@/convex/_generated/api';
import { scheduleAfterGenerationNotification } from '@/lib/notifications';

// Brand accent per business style (mirrors server-side identity palette)
function getBrandAccent(style?: string): string {
  switch (style) {
    case 'יוקרתי': return '#d4af37'; // gold
    case 'מצחיק':  return '#ec4899'; // playful pink
    case 'מקצועי': return '#2563eb'; // navy blue
    case 'צעיר':   return '#f97316'; // energetic orange
    case 'רגוע':   return '#84cc16'; // sage green
    default:        return '#7C3AED'; // brand purple
  }
}

const C = {
  bg:          '#0a0a0a',
  card:        '#111114',
  purple:      '#7C3AED',
  purpleBdr:   'rgba(124,58,237,0.35)',
  purpleFaint: 'rgba(124,58,237,0.12)',
  border:      'rgba(63,63,70,0.55)',
  textSub:     '#52525b',
  textMid:     '#a1a1aa',
};

type GenerationMode = 'auto' | 'manual';

type GeneratedPost = {
  imageBase64: string;
  captionText: string;
  mode: GenerationMode;
  businessName?: string;
  businessType?: string;
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
    <Animated.View style={{ opacity: pulse, width: w, height: h, borderRadius: br, backgroundColor: '#1e1a2e', marginBottom: mb }} />
  );
}

function LoadingSkeleton() {
  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.75, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3,  duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
        <ActivityIndicator size="small" color={C.purple} />
        <Text style={{ color: '#c4b5fd', fontSize: 15, fontWeight: '700' }}>יוצר פוסט מושלם בשבילך...</Text>
      </View>
      <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.purpleBdr, overflow: 'hidden', marginBottom: 12 }}>
        <Animated.View style={{ opacity: pulse, height: 220, backgroundColor: '#1e1a2e' }} />
      </View>
      <View style={{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.purpleBdr, padding: 18 }}>
        <Bone pulse={pulse} h={13} w="45%" mb={14} />
        <Bone pulse={pulse} w="90%" /><Bone pulse={pulse} w="80%" /><Bone pulse={pulse} w="85%" mb={14} /><Bone pulse={pulse} w="60%" />
      </View>
    </View>
  );
}

// ─── Premium Instagram-style post preview ───────────────────────────────────
function PostPreviewCard({
  imageBase64,
  captionText,
  mode,
  businessName,
  businessType,
  logoUrl,
  brandStyle,
  onSave,
  isSaving,
  onRedo,
}: {
  imageBase64: string;
  captionText: string;
  mode: GenerationMode;
  businessName?: string;
  businessType?: string;
  logoUrl?: string;
  brandStyle?: string;
  onSave: (post: SavedGeneratedPost) => Promise<void>;
  isSaving: boolean;
  onRedo: () => void;
}) {
  // Fade-in + slide-up on mount
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 5 }).start();
  }, [anim]);
  const opacity    = anim;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });

  // Branded composite — captured for save/share so the logo + accent travel with the image
  const brandedRef = useRef<View>(null);
  const accentColor = getBrandAccent(brandStyle);
  const hasBranding = Boolean(logoUrl) || Boolean(brandStyle);

  // Local state
  const [isExpanded,     setIsExpanded]     = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal,  setShowEditModal]  = useState(false);
  const [editedCaption,  setEditedCaption]  = useState(captionText);
  const [activeCaption,  setActiveCaption]  = useState(captionText);
  const [sharingTarget,  setSharingTarget]  = useState<null | string>(null);

  useEffect(() => { setEditedCaption(captionText); setActiveCaption(captionText); }, [captionText]);

  const showExpand = activeCaption.length > 180;

  // Persist the branded image to disk.
  // If branding exists (logo or brand style), we capture the composite View so the
  // overlays travel with the file. Otherwise we just write the raw base64.
  const writeImageToFile = async (): Promise<string> => {
    if (!FileSystem.documentDirectory) throw new Error('Storage unavailable');
    const dest = `${FileSystem.documentDirectory}post_${Date.now()}.png`;

    if (hasBranding && brandedRef.current) {
      try {
        const tmpUri = await captureRef(brandedRef, {
          format: 'png',
          quality: 0.95,
          result: 'tmpfile',
        });
        await FileSystem.copyAsync({ from: tmpUri, to: dest });
        return dest;
      } catch {
        // fall through to raw base64 on capture failure
      }
    }

    await FileSystem.writeAsStringAsync(dest, imageBase64, { encoding: FileSystem.EncodingType.Base64 });
    return dest;
  };

  const handleSave = async () => {
    try {
      const uri = await writeImageToFile();
      await onSave({ imageUri: uri, captionText: activeCaption, mode, businessName, businessType });
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור. נסה שנית.');
    }
  };

  const handleShareTarget = async (target: 'instagram' | 'whatsapp' | 'download') => {
    if (sharingTarget) return;
    setSharingTarget(target);
    try {
      const uri = await writeImageToFile();
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        await NativeShare.share({ message: activeCaption });
        return;
      }
      const dialogTitle = {
        instagram: 'שתף לאינסטגרם',
        whatsapp:  'שתף לוואטסאפ',
        download:  'שמור למכשיר',
      }[target];
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle, UTI: 'public.png' });
      // For Instagram, prompt user to also use the caption
      if (target === 'instagram' || target === 'whatsapp') {
        Alert.alert('הקפשן לפוסט', activeCaption, [{ text: 'סגור', style: 'cancel' }]);
      }
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשתף.');
    } finally {
      setSharingTarget(null);
      setShowShareModal(false);
    }
  };

  const handleSaveEditedCaption = () => {
    const trimmed = editedCaption.trim();
    if (!trimmed) { Alert.alert('שגיאה', 'הכיתוב לא יכול להיות ריק'); return; }
    setActiveCaption(trimmed);
    setShowEditModal(false);
  };

  // Button press scale animation factory
  const usePressScale = () => {
    const s = useRef(new Animated.Value(1)).current;
    return {
      style: { transform: [{ scale: s }] },
      onIn:  () => Animated.spring(s, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start(),
      onOut: () => Animated.spring(s, { toValue: 1,    useNativeDriver: true, speed: 35 }).start(),
    };
  };
  const shareBtn = usePressScale();
  const saveBtn  = usePressScale();
  const editBtn  = usePressScale();
  const redoBtn  = usePressScale();

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }], marginBottom: 24 }}>

      {/* Header line */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 14 }}>
        <Text style={{ color: C.purple, fontSize: 13, fontWeight: '700' }}>הפוסט שלך מוכן ✨</Text>
        <Sparkles size={14} color={C.purple} />
      </View>

      {/* ═══ Image — Instagram 4:5 portrait, branded composite ═══ */}
      <View style={{
        borderRadius: 20, overflow: 'hidden',
        backgroundColor: C.card, marginBottom: 16,
        shadowColor: C.purple, shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
      }}>
        {/* This wrapper is what react-native-view-shot captures.
            collapsable={false} keeps it as a real native View even with one child. */}
        <View ref={brandedRef} collapsable={false} style={{ width: '100%', aspectRatio: 4 / 5 }}>
          <Image
            source={{ uri: `data:image/png;base64,${imageBase64}` }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />

          {/* Logo watermark — bottom-right (visually bottom-end in RTL).
              Soft white card behind the logo keeps it readable on any background. */}
          {logoUrl && (
            <View style={{
              position: 'absolute',
              bottom: 14, right: 14,
              padding: 5,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.92)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 4,
            }}>
              <Image
                source={{ uri: logoUrl }}
                style={{ width: 38, height: 38, borderRadius: 8 }}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Brand accent — subtle thin bar at the bottom of the image */}
          <View style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: 4,
            backgroundColor: accentColor,
            opacity: 0.9,
          }} />
        </View>
      </View>

      {/* ═══ Caption ═══ */}
      <View style={{
        backgroundColor: C.card, borderRadius: 18,
        borderWidth: 1, borderColor: C.border,
        paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14,
        marginBottom: 18,
      }}>
        <Text style={{ color: C.textMid, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textAlign: 'right', marginBottom: 10 }}>
          כיתוב שיווקי
        </Text>
        <Text
          selectable
          numberOfLines={isExpanded ? undefined : 4}
          style={{ color: '#fff', fontSize: 15, lineHeight: 24, textAlign: 'right' }}
        >
          {activeCaption}
        </Text>
        {showExpand && (
          <Pressable
            onPress={() => setIsExpanded((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 10 }}
          >
            <Text style={{ color: C.purple, fontSize: 13, fontWeight: '700' }}>
              {isExpanded ? 'הצג פחות' : 'הצג עוד'}
            </Text>
            {isExpanded
              ? <ChevronUp size={14} color={C.purple} />
              : <ChevronDown size={14} color={C.purple} />}
          </Pressable>
        )}
      </View>

      {/* ═══ Primary actions: שתף + שמור ═══ */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <Animated.View style={[{ flex: 1 }, shareBtn.style]}>
          <Pressable
            onPressIn={shareBtn.onIn} onPressOut={shareBtn.onOut}
            onPress={() => setShowShareModal(true)}
            accessibilityLabel="שתף"
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, paddingVertical: 16, borderRadius: 18,
              backgroundColor: C.purple,
              shadowColor: C.purple, shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
            }}
          >
            <Share2 size={17} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>📤 שתף</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[{ flex: 1 }, saveBtn.style]}>
          <Pressable
            onPressIn={saveBtn.onIn} onPressOut={saveBtn.onOut}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityLabel="שמור פוסט"
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, paddingVertical: 16, borderRadius: 18,
              backgroundColor: C.card, borderWidth: 1.5, borderColor: C.purpleBdr,
              opacity: isSaving ? 0.65 : 1,
            }}
          >
            {isSaving ? <ActivityIndicator size="small" color={C.purple} /> : <BookMarked size={17} color={C.purple} />}
            <Text style={{ color: C.purple, fontSize: 15, fontWeight: '800' }}>
              {isSaving ? 'שומר...' : '💾 שמור'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* ═══ Secondary actions: ערוך טקסט + צור מחדש ═══ */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Animated.View style={[{ flex: 1 }, editBtn.style]}>
          <Pressable
            onPressIn={editBtn.onIn} onPressOut={editBtn.onOut}
            onPress={() => { setEditedCaption(activeCaption); setShowEditModal(true); }}
            accessibilityLabel="ערוך טקסט"
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, paddingVertical: 13, borderRadius: 14,
              borderWidth: 1, borderColor: C.border,
            }}
          >
            <Pencil size={14} color={C.textMid} />
            <Text style={{ color: C.textMid, fontSize: 13, fontWeight: '600' }}>✏️ ערוך טקסט</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[{ flex: 1 }, redoBtn.style]}>
          <Pressable
            onPressIn={redoBtn.onIn} onPressOut={redoBtn.onOut}
            onPress={onRedo}
            accessibilityLabel="צור מחדש"
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 6, paddingVertical: 13, borderRadius: 14,
              borderWidth: 1, borderColor: C.border,
            }}
          >
            <RefreshCw size={14} color={C.textMid} />
            <Text style={{ color: C.textMid, fontSize: 13, fontWeight: '600' }}>🔁 צור מחדש</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* ═══ Share options modal ═══ */}
      <Modal visible={showShareModal} transparent animationType="fade" onRequestClose={() => setShowShareModal(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}
          onPress={() => setShowShareModal(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: C.card,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              borderWidth: 1, borderBottomWidth: 0, borderColor: C.purpleBdr,
              paddingHorizontal: 24, paddingTop: 16, paddingBottom: 36,
            }}
          >
            {/* Drag handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 18 }} />

            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'right', marginBottom: 18 }}>
              איך לשתף את הפוסט?
            </Text>

            <ShareOptionRow
              icon={<Instagram size={22} color="#E1306C" />}
              label="אינסטגרם"
              loading={sharingTarget === 'instagram'}
              onPress={() => handleShareTarget('instagram')}
            />
            <ShareOptionRow
              icon={<MessageCircle size={22} color="#25D366" />}
              label="וואטסאפ"
              loading={sharingTarget === 'whatsapp'}
              onPress={() => handleShareTarget('whatsapp')}
            />
            <ShareOptionRow
              icon={<Download size={22} color={C.purple} />}
              label="הורדה למכשיר"
              loading={sharingTarget === 'download'}
              onPress={() => handleShareTarget('download')}
            />

            <Pressable
              onPress={() => setShowShareModal(false)}
              style={{
                marginTop: 14, paddingVertical: 14, borderRadius: 14,
                backgroundColor: 'rgba(63,63,70,0.40)',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: C.textMid, fontSize: 14, fontWeight: '700' }}>ביטול</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ═══ Edit caption modal ═══ */}
      <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: 20 }}>
          <View style={{
            backgroundColor: C.card, borderRadius: 24,
            borderWidth: 1, borderColor: C.purpleBdr,
            padding: 22,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Pressable onPress={() => setShowEditModal(false)}>
                <X size={20} color={C.textMid} />
              </Pressable>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>ערוך כיתוב</Text>
            </View>
            <TextInput
              value={editedCaption}
              onChangeText={setEditedCaption}
              multiline
              textAlignVertical="top"
              style={{
                color: '#fff', fontSize: 15, lineHeight: 24, textAlign: 'right',
                backgroundColor: '#16161a',
                borderRadius: 14, padding: 14,
                minHeight: 180, maxHeight: 320,
                borderWidth: 1, borderColor: C.border,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 14,
                  borderWidth: 1, borderColor: C.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: C.textMid, fontSize: 14, fontWeight: '600' }}>ביטול</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveEditedCaption}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 14,
                  backgroundColor: C.purple,
                  alignItems: 'center',
                  shadowColor: C.purple, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>שמור שינויים</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </Animated.View>
  );
}

function ShareOptionRow({
  icon, label, loading, onPress,
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
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
        backgroundColor: '#16161a',
        borderWidth: 1, borderColor: C.border,
        marginBottom: 10,
        opacity: loading ? 0.6 : 1,
      }}
    >
      <View style={{ width: 24, alignItems: 'center' }}>
        {loading ? <ActivityIndicator size="small" color={C.purple} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'right' }}>{label}</Text>
        {icon}
      </View>
    </Pressable>
  );
}

// ─── מסך ראשי ────────────────────────────────────────────────────────────────
export default function CreateScreen() {
  const router = useRouter();

  const [content,       setContent]       = useState('');
  const [loading,       setLoading]       = useState(false);
  const [generatedPost, setGeneratedPost] = useState<GeneratedPost | null>(null);
  const [focused,       setFocused]       = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);
  const [showUpgrade,   setShowUpgrade]   = useState(false);

  // undefined = still loading; do NOT default until we know the real value
  const weeklyStatus          = useQuery(api.users.getWeeklyPostStatus);
  const businessProfile       = useQuery(api.businessProfiles.getMyBusinessProfile);
  const isQueryLoading        = weeklyStatus === undefined || businessProfile === undefined;
  const isLimitReached        = weeklyStatus !== undefined && weeklyStatus.remaining <= 0;
  const remainingThisWeek     = weeklyStatus?.remaining ?? 0;
  const weeklyLimit           = weeklyStatus?.limit ?? 3;
  const hasBusinessProfile    = businessProfile !== undefined && businessProfile !== null && !!businessProfile.businessName;
  const isMissingProfile      = businessProfile !== undefined && !hasBusinessProfile;

  const createPost            = useMutation(api.posts.createPost);
  const generateMarketingPost = useAction(api.generatePost.generateMarketingPost);
  const resetPostsGenerated   = useMutation(api.users.resetPostsGenerated);

  const btnScale = useRef(new Animated.Value(1)).current;
  const btnIn    = () => Animated.spring(btnScale, { toValue: 0.96, useNativeDriver: true, speed: 60 }).start();
  const btnOut   = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true, speed: 35 }).start();

  const generate = async (topic: string, mode: GenerationMode) => {
    if (isQueryLoading || isLimitReached) {
      setShowUpgrade(true);
      return;
    }
    if (!hasBusinessProfile) return; // CTA banner handles this
    setLoading(true);
    setGeneratedPost(null);
    try {
      const result = await generateMarketingPost({ topic });
      setGeneratedPost({
        ...result,
        mode,
        businessName: businessProfile?.businessName,
        businessType: businessProfile?.businessType,
      });
      // Fire a "your post is ready" local notification (~30s later)
      scheduleAfterGenerationNotification().catch(() => {});
    } catch (err: unknown) {
      const msg = String(err);
      // Both old LIMIT_REACHED and new WEEKLY_LIMIT_REACHED open the same upgrade modal
      if (msg.includes('LIMIT_REACHED')) {
        setShowUpgrade(true);
      } else if (msg.includes('NO_BUSINESS_PROFILE')) {
        Alert.alert('פרופיל עסקי חסר', 'כדי ליצור פוסט מותאם אישית, צריך להשלים קודם פרופיל עסקי.');
      } else {
        Alert.alert('שגיאה', 'לא הצלחנו ליצור פוסט. נסה שנית.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    if (loading) return;
    if (isLimitReached) { setShowUpgrade(true); return; }
    if (!content.trim()) return;
    generate(content.trim(), 'manual');
  };
  const handleAutoCreate = () => {
    if (loading) return;
    if (isLimitReached) { setShowUpgrade(true); return; }
    generate(content.trim(), 'auto');
  };
  const handleRedo = () => {
    if (loading) return;
    const lastMode = generatedPost?.mode ?? (content.trim() ? 'manual' : 'auto');
    if (lastMode === 'manual' && content.trim()) generate(content.trim(), 'manual');
    else generate(content.trim(), 'auto');
  };

  const handleSave = async ({ imageUri, captionText, mode, businessName, businessType }: SavedGeneratedPost) => {
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
      <Modal visible={showUpgrade} transparent animationType="fade" onRequestClose={() => setShowUpgrade(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', alignItems: 'center', justifyContent: 'center', padding: 22 }}
          onPress={() => setShowUpgrade(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: C.card, borderRadius: 28,
              borderWidth: 1, borderColor: C.purpleBdr,
              paddingHorizontal: 26, paddingTop: 28, paddingBottom: 22,
              width: '100%',
              shadowColor: C.purple, shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.55, shadowRadius: 32, elevation: 20,
            }}
          >
            {/* Celebration icon */}
            <View style={{ alignItems: 'center', marginBottom: 18 }}>
              <View style={{
                width: 70, height: 70, borderRadius: 22,
                backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: C.purple, shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.45, shadowRadius: 16, elevation: 8,
              }}>
                <Sparkles size={32} color={C.purple} />
              </View>
            </View>

            {/* Title */}
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10, lineHeight: 30 }}>
              ניצלת את כל הפוסטים השבועיים שלך 🎯
            </Text>

            {/* Body */}
            <Text style={{ color: C.textMid, fontSize: 15, textAlign: 'center', lineHeight: 23, marginBottom: 22 }}>
              רוצה להמשיך?{'\n'}שדרג את המנוי שלך
            </Text>

            {/* Benefits list */}
            <View style={{
              backgroundColor: '#16161a',
              borderRadius: 16,
              borderWidth: 1, borderColor: C.border,
              padding: 16, marginBottom: 20,
              gap: 12,
            }}>
              {[
                { icon: Sparkles, label: 'פוסטים מוכנים בלחיצה' },
                { icon: Clock,    label: 'חיסכון בזמן יקר' },
                { icon: Target,   label: 'מותאם בדיוק לעסק שלך' },
              ].map(({ icon: Icon, label }) => (
                <View
                  key={label}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'flex-end', gap: 12,
                  }}
                >
                  <Text style={{ color: '#e4e4e7', fontSize: 14, fontWeight: '600', textAlign: 'right', flex: 1 }}>
                    {label}
                  </Text>
                  <View style={{
                    width: 30, height: 30, borderRadius: 10,
                    backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={14} color={C.purple} />
                  </View>
                  <View style={{
                    width: 18, height: 18, borderRadius: 9,
                    backgroundColor: C.purple,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={11} color="#fff" strokeWidth={3} />
                  </View>
                </View>
              ))}
            </View>

            {/* Primary CTA */}
            <Pressable
              onPress={() => { setShowUpgrade(false); router.push('/(authenticated)/pricing'); }}
              style={{
                backgroundColor: C.purple, borderRadius: 16,
                paddingVertical: 16, width: '100%', alignItems: 'center',
                shadowColor: C.purple, shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>שדרג עכשיו</Text>
            </Pressable>

            {/* Price hint */}
            <Text style={{ color: C.purple, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>
              פחות מ-4₪ לפוסט
            </Text>

            {/* Secondary — soft, not dismissive */}
            <Pressable
              onPress={() => setShowUpgrade(false)}
              style={{ paddingVertical: 12, marginTop: 4, alignItems: 'center' }}
            >
              <Text style={{ color: C.textMid, fontSize: 13 }}>אולי אחר כך</Text>
            </Pressable>

            {/* Dev-only reset button */}
            {__DEV__ && (
              <Pressable
                onPress={async () => {
                  await resetPostsGenerated();
                  setShowUpgrade(false);
                }}
                style={{
                  marginTop: 8, alignSelf: 'center',
                  paddingVertical: 6, paddingHorizontal: 14,
                  borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
                  backgroundColor: 'rgba(239,68,68,0.06)',
                }}
              >
                <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '600' }}>
                  🔧 איפוס פוסט חינמי לבדיקה
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 80 }}>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginBottom: 6 }}>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>יצירת תוכן</Text>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr, alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={22} color={C.purple} fill={C.purple} />
            </View>
          </View>
          <Text style={{ color: C.textSub, fontSize: 14, textAlign: 'right', marginBottom: 28 }}>
            צור פוסט חכם תוך שניות בעזרת AI
          </Text>

          {/* ── Missing business profile CTA ── */}
          {isMissingProfile && (
            <View style={{
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
            }}>
              <View style={{
                width: 52, height: 52, borderRadius: 16,
                backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
                alignItems: 'center', justifyContent: 'center',
                alignSelf: 'flex-end', marginBottom: 14,
              }}>
                <Sparkles size={24} color={C.purple} />
              </View>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'right', marginBottom: 8 }}>
                נדרש פרופיל עסקי
              </Text>
              <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'right', lineHeight: 22, marginBottom: 18 }}>
                כדי ליצור פוסט מותאם אישית, צריך להשלים קודם פרופיל עסקי
              </Text>
              <Pressable
                onPress={() => router.push('/(authenticated)/business-profile')}
                style={{
                  backgroundColor: C.purple,
                  borderRadius: 14, paddingVertical: 14,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  shadowColor: C.purple, shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>השלם פרופיל עסקי ✨</Text>
              </Pressable>
            </View>
          )}

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: C.textMid, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textAlign: 'right', marginBottom: 10 }}>מה הנושא?</Text>
            <View style={{
              backgroundColor: C.card, borderWidth: 1.5,
              borderColor: focused ? C.purple : C.border,
              borderRadius: 18, padding: 16,
              shadowColor: C.purple, shadowOffset: { width: 0, height: 0 },
              shadowOpacity: focused ? 0.30 : 0, shadowRadius: 12, elevation: 2,
            }}>
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
                style={{ color: '#e4e4e7', fontSize: 15, lineHeight: 24, textAlign: 'right', minHeight: 110, opacity: (isLimitReached || isMissingProfile) ? 0.4 : 1 }}
              />
            </View>
          </View>

          <Pressable
            onPress={handleAutoCreate}
            disabled={loading || isLimitReached || isQueryLoading || !hasBusinessProfile}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, paddingVertical: 14, borderRadius: 16,
              backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
              marginBottom: 12, opacity: (loading || isLimitReached || isQueryLoading || !hasBusinessProfile) ? 0.4 : 1,
            }}
          >
            <Text style={{ color: '#a78bfa', fontSize: 15, fontWeight: '700' }}>✨ צור לי פוסט אוטומטי</Text>
          </Pressable>

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <Pressable
              onPressIn={btnIn} onPressOut={btnOut} onPress={handleCreate}
              disabled={loading || isQueryLoading || !hasBusinessProfile}
              style={{
                backgroundColor: (isLimitReached || !hasBusinessProfile) ? '#2a1a4e' : (!content.trim() || loading) ? '#3b1f6e' : C.purple,
                borderRadius: 22, paddingVertical: 18,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                shadowColor: C.purple, shadowOffset: { width: 0, height: 8 },
                shadowOpacity: (isLimitReached || !hasBusinessProfile) ? 0.10 : (!content.trim() || loading) ? 0.20 : 0.50,
                shadowRadius: 20, elevation: 10,
                opacity: (isLimitReached || !hasBusinessProfile) ? 0.6 : 1,
              }}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Sparkles size={20} color={(isLimitReached || !hasBusinessProfile) ? '#6d4ca0' : '#fff'} />}
              <Text style={{ color: (isLimitReached || !hasBusinessProfile) ? '#6d4ca0' : '#fff', fontSize: 17, fontWeight: '700' }}>
                {loading ? 'יוצר...' : 'צור פוסט ⚡'}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Weekly status — show remaining count OR limit-reached notice */}
          {!isQueryLoading && (
            isLimitReached ? (
              <Pressable onPress={() => setShowUpgrade(true)} style={{ marginTop: 10, marginBottom: 24, alignItems: 'center' }}>
                <Text style={{ color: '#a78bfa', fontSize: 13, textAlign: 'center' }}>
                  ניצלת את כל {weeklyLimit} הפוסטים השבועיים ·{' '}
                  <Text style={{ textDecorationLine: 'underline' }}>שדרג למנוי</Text>
                </Text>
              </Pressable>
            ) : (
              <View style={{ marginTop: 10, marginBottom: 24, alignItems: 'center' }}>
                <Text style={{ color: C.textMid, fontSize: 13, textAlign: 'center' }}>
                  נשארו לך{' '}
                  <Text style={{ color: '#a78bfa', fontWeight: '700' }}>{remainingThisWeek}</Text>
                  {' '}פוסטים השבוע
                </Text>
              </View>
            )
          )}
          {isQueryLoading && <View style={{ marginBottom: 28 }} />}

          {loading && <LoadingSkeleton />}

          {!loading && generatedPost && (
            <PostPreviewCard
              imageBase64={generatedPost.imageBase64}
              captionText={generatedPost.captionText}
              mode={generatedPost.mode}
              businessName={generatedPost.businessName}
              businessType={generatedPost.businessType}
              logoUrl={businessProfile?.logoUrl ?? undefined}
              brandStyle={businessProfile?.style ?? undefined}
              onSave={handleSave}
              isSaving={isSaving}
              onRedo={handleRedo}
            />
          )}

          {/* ─── Empty placeholder ─── */}
          {!loading && !generatedPost && hasBusinessProfile && (
            <View style={{
              alignItems: 'center', paddingVertical: 36,
              borderWidth: 1, borderColor: C.border, borderStyle: 'dashed',
              borderRadius: 20, marginTop: 8,
            }}>
              <View style={{
                width: 56, height: 56, borderRadius: 18,
                backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
                alignItems: 'center', justifyContent: 'center', marginBottom: 12,
              }}>
                <Sparkles size={24} color={C.purple} />
              </View>
              <Text style={{ color: '#e4e4e7', fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
                עדיין לא יצרת פוסט
              </Text>
              <Text style={{ color: C.textMid, fontSize: 13, textAlign: 'center', paddingHorizontal: 24, lineHeight: 19 }}>
                לחץ על "צור פוסט" למעלה והפוסט שלך יופיע כאן
              </Text>
            </View>
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
