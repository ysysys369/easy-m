import { useAction, useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Crown,
  ImagePlus,
  Pencil,
  RefreshCw,
  Sparkles,
  Star,
  X,
} from 'lucide-react-native';
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
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';
import { position, rtl } from '@/lib/rtl';

// ─── Safe loader for expo-image-picker ──────────────────────────────────────
// If the native module isn't present in the running binary (stale dev build
// before rebuild), we degrade gracefully instead of throwing a red screen.
type ImagePickerModule = typeof import('expo-image-picker');
let ImagePicker: ImagePickerModule | null = null;
let _imagePickerLoadError: string | null = null;
try {
  ImagePicker = require('expo-image-picker') as ImagePickerModule;
} catch (e) {
  _imagePickerLoadError = e instanceof Error ? e.message : String(e);
}

const C = {
  bg: '#0a0a0a',
  card: '#111114',
  cardInner: '#16161a',
  purple: '#7C3AED',
  purpleLight: '#a78bfa',
  purpleFaint: 'rgba(124,58,237,0.12)',
  purpleBdr: 'rgba(124,58,237,0.35)',
  border: 'rgba(63,63,70,0.55)',
  textSub: '#52525b',
  textMid: '#71717a',
  textLight: '#a1a1aa',
};

const BUSINESS_TYPES = [
  'מסעדה 🍽️',
  'בית קפה ☕',
  'בר / פאב 🍸',
  'מאפייה 🥐',
  'אוכל מהיר 🍔',
  'סושי / אסייתי 🍣',
  'קוסמטיקה ויופי 💆‍♀️',
  'ציפורניים 💅',
  'מספרה ✂️',
  'כושר ובריאות 💪',
  'חנות 🛍️',
  'נדל״ן 🏠',
  'שירותים מקצועיים ⚖️',
  'טכנולוגיה 📱',
];

const BUSINESS_TYPE_OTHER = 'אחר ✨';

const STYLES = ['יוקרתי', 'מצחיק', 'מקצועי', 'צעיר', 'רגוע'];

const AUDIENCE_QUICK_OPTIONS = [
  'כולם',
  'נשים',
  'גברים',
  'צעירים',
  'משפחות',
  'עסקים',
  'ילדים',
  'בני נוער',
  'מבוגרים',
];

const GOALS = [
  'להביא לקוחות חדשים',
  'לפרסם מבצעים',
  'לחזק את המותג',
  'להזכיר ללקוחות',
];

type ImageLabelKey =
  | 'logo'
  | 'product'
  | 'mood'
  | 'team'
  | 'place'
  | 'food'
  | 'workout'
  | 'before_after';

type BusinessImageMetadata = {
  storageRef: string;
  label?: ImageLabelKey;
  rating?: number;
  aiRecommended?: boolean;
  featured?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

const IMAGE_LABELS: ReadonlyArray<{ key: ImageLabelKey; label: string }> = [
  { key: 'logo', label: 'לוגו' },
  { key: 'product', label: 'מוצר' },
  { key: 'mood', label: 'אווירה' },
  { key: 'team', label: 'צוות' },
  { key: 'place', label: 'מקום' },
  { key: 'food', label: 'אוכל' },
  { key: 'workout', label: 'אימון' },
  { key: 'before_after', label: 'לפני/אחרי' },
];

type Profile = {
  businessName: string;
  businessType: string;
  description: string;
  audience: string;
  style: string;
  city: string;
  website: string;
  socialInstagram: string;
  socialFacebook: string;
  goal: string;
  services: string;
  uniqueness: string;
  // logoUrl/images hold what's displayed (local file:// URI or resolved https:// URL)
  logoUrl: string;
  images: string[];
  imageMetadata: BusinessImageMetadata[];
  // logoStorageRef/imageStorageRefs hold what's persisted to the DB (Convex storage IDs).
  // They run in parallel with logoUrl/images so we can show fresh picks instantly
  // while still saving stable storage IDs that the server can re-resolve later.
  logoStorageRef: string;
  imageStorageRefs: string[];
};

const EMPTY: Profile = {
  businessName: '',
  businessType: '',
  description: '',
  audience: '',
  style: '',
  city: '',
  website: '',
  socialInstagram: '',
  socialFacebook: '',
  goal: '',
  services: '',
  uniqueness: '',
  logoUrl: '',
  images: [],
  imageMetadata: [],
  logoStorageRef: '',
  imageStorageRefs: [],
};

const TOTAL_STEPS = 13;

function isValidUrl(url: string): boolean {
  if (!url.trim()) return true; // optional
  const pattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/i;
  return pattern.test(url.trim());
}

function formatScanDate(timestamp: number | undefined): string {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

export default function BusinessProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanningWebsite, setIsScanningWebsite] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const existing = useQuery(api.businessProfiles.getMyBusinessProfile);
  const saveProfile = useMutation(api.businessProfiles.saveBusinessProfile);
  const scanBusinessWebsite = useAction(
    api.businessWebsiteScan.scanBusinessWebsite
  );
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  useEffect(() => {
    if (!existing) return;
    const imageStorageRefs = (existing as any).imageStorageRefs ?? [];
    const serverMetadata = ((existing as any).imageMetadata ??
      []) as BusinessImageMetadata[];
    const serverMetadataByRef = new Map(
      serverMetadata.map((item) => [item.storageRef, item])
    );
    setProfile({
      businessName: existing.businessName ?? '',
      businessType: existing.businessType ?? '',
      description: existing.description ?? '',
      audience: existing.audience ?? '',
      style: existing.style ?? '',
      city: existing.city ?? '',
      website: existing.websiteUrl ?? existing.website ?? '',
      socialInstagram: existing.socialInstagram ?? '',
      socialFacebook: existing.socialFacebook ?? '',
      goal: existing.goal ?? '',
      services: existing.services ?? '',
      uniqueness: existing.uniqueness ?? '',
      logoUrl: existing.logoUrl ?? '',
      images: existing.images ?? [],
      imageMetadata: imageStorageRefs.map((storageRef: string) => ({
        storageRef,
        ...serverMetadataByRef.get(storageRef),
      })),
      // Raw refs come from the server so we know what to re-save unchanged
      logoStorageRef: (existing as any).logoStorageRef ?? '',
      imageStorageRefs,
    });
  }, [existing]);

  // Slide animation between steps
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    void step;
    slide.setValue(20);
    Animated.spring(slide, {
      toValue: 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 6,
    }).start();
  }, [step, slide]);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  // Upload a local image to Convex storage and return the storage ID.
  // The server's getMyBusinessProfile resolves IDs to real public URLs at read time.
  const uploadImage = async (uri: string): Promise<string> => {
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uri);
    const blob = await response.blob();
    const result = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
    });
    const { storageId } = await result.json();
    if (!storageId) throw new Error('Upload failed: no storageId returned');
    return storageId;
  };

  const ensureImagePicker = (): boolean => {
    if (ImagePicker) return true;
    Alert.alert(
      'נדרש בנייה מחדש',
      'מודול בחירת התמונות עדיין לא קיים באפליקציה. הרץ:\n\nnpx expo prebuild --clean\nnpx expo run:ios\n\nכדי לכלול אותו בבניין.'
    );
    return false;
  };

  const pickLogo = async () => {
    if (!ensureImagePicker() || !ImagePicker) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('נדרשת הרשאה', 'אנא אפשר גישה לתמונות בהגדרות');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setIsUploadingLogo(true);
    try {
      const localUri = result.assets[0].uri;
      const storageId = await uploadImage(localUri);
      // Local URI for instant preview; storage ID for persistence
      setProfile((p) => ({
        ...p,
        logoUrl: localUri,
        logoStorageRef: storageId,
      }));
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו להעלות את הלוגו');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const pickImages = async () => {
    if (!ensureImagePicker() || !ImagePicker) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('נדרשת הרשאה', 'אנא אפשר גישה לתמונות בהגדרות');
      return;
    }
    const remaining = 10 - profile.images.length;
    if (remaining <= 0) {
      Alert.alert('הגעת למקסימום', 'אפשר להעלות עד 10 תמונות');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets.length) return;
    setIsUploadingImages(true);
    try {
      const pairs = await Promise.all(
        result.assets.map(async (a) => ({
          localUri: a.uri,
          storageId: await uploadImage(a.uri),
        }))
      );
      setProfile((p) => ({
        ...p,
        images: [...p.images, ...pairs.map((x) => x.localUri)],
        imageStorageRefs: [
          ...p.imageStorageRefs,
          ...pairs.map((x) => x.storageId),
        ],
        imageMetadata: [
          ...p.imageMetadata,
          ...pairs.map((x, index) => ({
            storageRef: x.storageId,
            featured: p.images.length === 0 && index === 0,
            aiRecommended: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })),
        ],
      }));
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו להעלות חלק מהתמונות');
    } finally {
      setIsUploadingImages(false);
    }
  };

  const replaceImage = async (i: number) => {
    if (!ensureImagePicker() || !ImagePicker) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('נדרשת הרשאה', 'אנא אפשר גישה לתמונות בהגדרות');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setIsUploadingImages(true);
    try {
      const localUri = result.assets[0].uri;
      const storageId = await uploadImage(localUri);
      setProfile((p) => {
        const oldRef = p.imageStorageRefs[i];
        const oldMeta = p.imageMetadata.find(
          (item) => item.storageRef === oldRef
        );
        return {
          ...p,
          images: p.images.map((uri, idx) => (idx === i ? localUri : uri)),
          imageStorageRefs: p.imageStorageRefs.map((ref, idx) =>
            idx === i ? storageId : ref
          ),
          imageMetadata: p.imageMetadata
            .filter((item) => item.storageRef !== oldRef)
            .concat({
              ...(oldMeta ?? {}),
              storageRef: storageId,
              updatedAt: Date.now(),
            }),
        };
      });
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו להחליף את התמונה');
    } finally {
      setIsUploadingImages(false);
    }
  };

  const removeImage = (i: number) => {
    setProfile((p) => ({
      ...p,
      images: p.images.filter((_, idx) => idx !== i),
      imageStorageRefs: p.imageStorageRefs.filter((_, idx) => idx !== i),
      imageMetadata: p.imageMetadata.filter(
        (item) => item.storageRef !== p.imageStorageRefs[i]
      ),
    }));
  };

  const confirmRemoveImage = (i: number) => {
    Alert.alert('למחוק תמונה?', 'התמונה תוסר מפרופיל העסק אחרי השמירה.', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => removeImage(i) },
    ]);
  };

  const updateImageMetadata = (
    storageRef: string,
    patch: Partial<BusinessImageMetadata>
  ) => {
    setProfile((p) => {
      const existingMeta = p.imageMetadata.find(
        (item) => item.storageRef === storageRef
      );
      const nextMeta = {
        ...(existingMeta ?? { storageRef }),
        ...patch,
        storageRef,
        updatedAt: Date.now(),
      };
      return {
        ...p,
        imageMetadata: existingMeta
          ? p.imageMetadata.map((item) =>
              item.storageRef === storageRef ? nextMeta : item
            )
          : [...p.imageMetadata, nextMeta],
      };
    });
  };

  const setFeaturedImage = (storageRef: string) => {
    setProfile((p) => ({
      ...p,
      imageMetadata: p.imageStorageRefs.map((ref) => {
        const existingMeta = p.imageMetadata.find(
          (item) => item.storageRef === ref
        );
        return {
          ...(existingMeta ?? { storageRef: ref }),
          storageRef: ref,
          featured: ref === storageRef,
          updatedAt: Date.now(),
        };
      }),
    }));
  };

  const canProceed = (s: number): boolean => {
    switch (s) {
      case 1:
        return profile.businessName.trim().length > 0;
      case 2:
        return profile.businessType.length > 0;
      case 3:
        return profile.description.trim().length > 0;
      case 4:
        return profile.audience.trim().length > 0;
      case 5:
        return profile.style.length > 0;
      case 6:
        return true;
      case 7:
        return isValidUrl(profile.website);
      case 8:
        return true;
      case 9:
        return profile.goal.length > 0;
      case 10:
        return profile.services.trim().length > 0;
      case 11:
        return profile.uniqueness.trim().length > 0;
      case 12:
        return true;
      case 13:
        return true;
      default:
        return true;
    }
  };

  const next = () => {
    if (!canProceed(step)) {
      if (step === 7)
        Alert.alert(
          'כתובת לא תקינה',
          'אנא הזן כתובת URL תקינה (למשל: www.example.com)'
        );
      return;
    }
    if (step < TOTAL_STEPS) setStep(step + 1);
  };
  const back = () => {
    if (step > 1) setStep(step - 1);
  };

  // Build the full saveProfile payload from the current in-progress form state.
  // Extracted so both `finish` and the mid-onboarding rescan can persist the
  // same shape without drift.
  const buildProfilePayload = () => {
    const websiteUrl = profile.website.trim() || undefined;
    const imageMetadataForSave = profile.imageStorageRefs.map((storageRef) => {
      const meta = profile.imageMetadata.find(
        (item) => item.storageRef === storageRef
      );
      const next: BusinessImageMetadata = { storageRef };
      if (meta?.label) next.label = meta.label;
      if (typeof meta?.rating === 'number') next.rating = meta.rating;
      if (typeof meta?.aiRecommended === 'boolean') {
        next.aiRecommended = meta.aiRecommended;
      }
      if (typeof meta?.featured === 'boolean') next.featured = meta.featured;
      if (typeof meta?.createdAt === 'number')
        next.createdAt = meta.createdAt;
      if (typeof meta?.updatedAt === 'number')
        next.updatedAt = meta.updatedAt;
      return next;
    });
    return {
      businessName: profile.businessName.trim(),
      businessType: profile.businessType || undefined,
      description: profile.description.trim() || undefined,
      audience: profile.audience.trim() || undefined,
      style: profile.style || undefined,
      city: profile.city.trim() || undefined,
      website: websiteUrl,
      websiteUrl,
      socialInstagram: profile.socialInstagram.trim() || undefined,
      socialFacebook: profile.socialFacebook.trim() || undefined,
      goal: profile.goal || undefined,
      services: profile.services.trim() || undefined,
      uniqueness: profile.uniqueness.trim() || undefined,
      // Persist Convex storage IDs, not display URIs. Server resolves them
      // back to public URLs on read via resolveStorageRef.
      logoUrl: profile.logoStorageRef || undefined,
      images: profile.imageStorageRefs.length
        ? profile.imageStorageRefs
        : undefined,
      image:
        profile.imageMetadata.find((item) => item.featured)?.storageRef ??
        undefined,
      imageMetadata: profile.imageStorageRefs.length
        ? imageMetadataForSave
        : undefined,
    };
  };

  const finish = async () => {
    if (!canProceed(step)) return;
    // Snapshot this BEFORE the mutation runs. `existing` is null/undefined
    // only for a user who has never saved a business profile — i.e. the
    // signup → onboarding → business-profile chain. On subsequent saves
    // (edits from Settings, etc.) `existing` is populated and we keep the
    // legacy router.back() behaviour so the user returns to where they came
    // from without seeing the paywall every time they edit their profile.
    const isFirstSave = !existing;
    setIsSaving(true);
    try {
      const payload = buildProfilePayload();
      const websiteUrl = payload.websiteUrl;
      await saveProfile(payload);
      let message = 'פרטי העסק נשמרו בהצלחה';
      if (websiteUrl) {
        setIsScanningWebsite(true);
        const scanResult = await scanBusinessWebsite({ websiteUrl });
        if (!scanResult.success && scanResult.debug && __DEV__) {
          console.warn(
            'Website scan failed after profile save',
            scanResult.debug
          );
        }
        message = scanResult.success
          ? `${message}\n\n${scanResult.message}`
          : `${message}\n\nלא הצלחנו לסרוק את האתר, אבל אפשר להמשיך עם הפרטים שהזנת`;
      }

      Alert.alert('נשמר! ✅', message, [
        {
          text: 'אישור',
          onPress: () => {
            if (isFirstSave) {
              // First-time onboarding path — introduce the subscription
              // offer before the user lands on the app. router.replace so
              // that the paywall's close button falls back cleanly to
              // /(authenticated) without popping back to this form.
              // The paywall itself must NOT force payment; its native
              // close button + our overlay close both allow "continue to
              // app" so the free post remains available.
              router.replace('/(authenticated)/paywall');
            } else {
              router.back();
            }
          },
        },
      ]);
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור. נסה שנית.');
    } finally {
      setIsScanningWebsite(false);
      setIsSaving(false);
    }
  };

  const handleRescanWebsite = async () => {
    const websiteUrl = profile.website.trim();
    if (!websiteUrl || !isValidUrl(websiteUrl)) {
      Alert.alert(
        'כתובת לא תקינה',
        'אנא הזן כתובת URL תקינה כדי לסרוק את האתר.'
      );
      return;
    }

    setIsScanningWebsite(true);
    try {
      // Mid-onboarding path: no profile row exists yet, so the scan action
      // would throw NO_BUSINESS_PROFILE. Persist a draft profile with the
      // fields the user has already entered (businessName is required, filled
      // in step 1) before running the scan. `finish` later patches the same
      // row via `saveBusinessProfile`, so no duplicate is created.
      if (!existing) {
        if (!profile.businessName.trim()) {
          Alert.alert(
            'חסר שם עסק',
            'כדי לסרוק את האתר, מלא קודם את שם העסק בשלב 1.'
          );
          return;
        }
        await saveProfile(buildProfilePayload());
      }

      const result = await scanBusinessWebsite({ websiteUrl });
      if (!result.success && result.debug && __DEV__) {
        console.warn('Website rescan failed', result.debug);
      }
      Alert.alert(
        result.success ? 'הסריקה הושלמה' : 'לא הצלחנו לסרוק',
        result.message
      );
    } catch {
      Alert.alert(
        'לא הצלחנו לסרוק',
        'לא הצלחנו לסרוק את האתר, אבל אפשר להמשיך עם הפרטים שהזנת'
      );
    } finally {
      setIsScanningWebsite(false);
    }
  };

  if (existing === undefined) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: C.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        edges={['top']}
      >
        <ActivityIndicator size="large" color={C.purple} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
          <View
            style={{
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <Text
              style={{ color: C.textLight, fontSize: 13, fontWeight: '600', textAlign: 'right', writingDirection: 'rtl' }}
            >
              שלב {step} מתוך {TOTAL_STEPS}
            </Text>
            <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
              <X size={22} color={C.textLight} />
            </Pressable>
          </View>

          <View
            style={{
              height: 4,
              backgroundColor: C.border,
              borderRadius: 2,
              marginBottom: 32,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${(step / TOTAL_STEPS) * 100}%`,
                height: '100%',
                backgroundColor: C.purple,
                borderRadius: 2,
              }}
            />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 150 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={{
                transform: [{ translateY: slide }],
                opacity: slide.interpolate({
                  inputRange: [0, 20],
                  outputRange: [1, 0],
                }),
              }}
            >
              {step === 1 && (
                <TextStep
                  title="מה שם העסק?"
                  placeholder="לדוגמה: קפה הגינה"
                  value={profile.businessName}
                  onChange={(v) => update('businessName', v)}
                />
              )}
              {step === 2 && (
                <BusinessTypeStep
                  value={profile.businessType}
                  onChange={(v) => update('businessType', v)}
                />
              )}
              {step === 3 && (
                <TextStep
                  title="תיאור קצר על העסק"
                  placeholder="ספר מה העסק עושה..."
                  value={profile.description}
                  onChange={(v) => update('description', v)}
                  multiline
                />
              )}
              {step === 4 && (
                <AudienceStep
                  value={profile.audience}
                  onChange={(v) => update('audience', v)}
                />
              )}
              {step === 5 && (
                <ChipsStep
                  title="איזה סגנון שיווקי אתה אוהב?"
                  options={STYLES}
                  value={profile.style}
                  onChange={(v) => update('style', v)}
                />
              )}
              {step === 6 && (
                <TextStep
                  title="מה הכתובת המדויקת של העסק?"
                  placeholder="לדוגמה: הרצל 10, תל אביב"
                  value={profile.city}
                  onChange={(v) => update('city', v)}
                />
              )}
              {step === 7 && (
                <View>
                  <TextStep
                    title="אתר העסק (אופציונלי)"
                    placeholder="www.my-business.co.il"
                    value={profile.website}
                    onChange={(v) => update('website', v)}
                    keyboardType="url"
                    autoCapitalize="none"
                  />

                  <View style={{ marginTop: 18, gap: 10 }}>
                    <Pressable
                      onPress={handleRescanWebsite}
                      disabled={
                        isScanningWebsite ||
                        !profile.website.trim() ||
                        !isValidUrl(profile.website)
                      }
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel="סרוק אתר מחדש"
                      style={{
                        minHeight: 48,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: C.purpleBdr,
                        backgroundColor: C.cardInner,
                        flexDirection: rtl.flexDirection,
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        opacity:
                          isScanningWebsite ||
                          !profile.website.trim() ||
                          !isValidUrl(profile.website)
                            ? 0.5
                            : 1,
                      }}
                    >
                      {isScanningWebsite ? (
                        <ActivityIndicator size="small" color={C.purpleLight} />
                      ) : (
                        <RefreshCw size={16} color={C.purpleLight} />
                      )}
                      <Text
                        style={{
                          color: C.purpleLight,
                          fontSize: 14,
                          fontWeight: '700',
                          textAlign: 'center',
                          writingDirection: 'rtl',
                        }}
                      >
                        סרוק אתר מחדש
                      </Text>
                    </Pressable>

                    <Text
                      style={{
                        color: C.textMid,
                        fontSize: 13,
                        textAlign: 'right',
                        writingDirection: 'rtl',
                        lineHeight: 20,
                      }}
                    >
                      {isScanningWebsite
                        ? 'סורק את האתר ולומד את העסק שלך...'
                        : existing?.lastWebsiteScanAt
                          ? `סריקה אחרונה: ${formatScanDate(existing.lastWebsiteScanAt)}`
                          : 'נשמור את הכתובת ונשתמש בה כדי לשפר את הפוסטים שה-AI יוצר.'}
                    </Text>
                  </View>
                </View>
              )}
              {step === 8 && (
                <View>
                  <StepHeader
                    title="רשתות חברתיות"
                    subtitle="אופציונלי — דלג אם אין"
                  />
                  <FieldLabel label="אינסטגרם" />
                  <BareInput
                    placeholder="@my-business"
                    value={profile.socialInstagram}
                    onChange={(v) => update('socialInstagram', v)}
                    autoCapitalize="none"
                  />
                  <View style={{ height: 16 }} />
                  <FieldLabel label="פייסבוק" />
                  <BareInput
                    placeholder="facebook.com/my-business"
                    value={profile.socialFacebook}
                    onChange={(v) => update('socialFacebook', v)}
                    autoCapitalize="none"
                  />
                </View>
              )}
              {step === 9 && (
                <ChipsStep
                  title="מה המטרה של הפוסטים?"
                  options={GOALS}
                  value={profile.goal}
                  onChange={(v) => update('goal', v)}
                />
              )}
              {step === 10 && (
                <TextStep
                  title="אילו שירותים / מוצרים אתה מציע?"
                  placeholder="לדוגמה: מספרה לגברים, תספורות, זקנים, שעווה..."
                  value={profile.services}
                  onChange={(v) => update('services', v)}
                  multiline
                />
              )}
              {step === 11 && (
                <TextStep
                  title="מה מיוחד בעסק שלך?"
                  placeholder="ספר מה מבדיל אותך מהמתחרים. חשוב מאוד לאיכות הפוסטים..."
                  value={profile.uniqueness}
                  onChange={(v) => update('uniqueness', v)}
                  multiline
                />
              )}
              {step === 12 && (
                <View>
                  <StepHeader
                    title="העלאת לוגו"
                    subtitle="אופציונלי — לוגו אחד"
                  />
                  <View style={{ alignItems: 'center', marginTop: 8 }}>
                    {profile.logoUrl ? (
                      <View style={{ position: 'relative' }}>
                        <Image
                          source={{ uri: profile.logoUrl }}
                          style={{
                            width: 160,
                            height: 160,
                            borderRadius: 24,
                            borderWidth: 2,
                            borderColor: C.purpleBdr,
                          }}
                        />
                        <Pressable
                          onPress={() =>
                            setProfile((p) => ({
                              ...p,
                              logoUrl: '',
                              logoStorageRef: '',
                            }))
                          }
                          style={{
                            position: 'absolute',
                            top: -8,
                            ...position.end(-8),
                            backgroundColor: '#ef4444',
                            borderRadius: 16,
                            width: 32,
                            height: 32,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <X size={18} color="#fff" />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={pickLogo}
                        disabled={isUploadingLogo}
                        style={{
                          width: 160,
                          height: 160,
                          borderRadius: 24,
                          backgroundColor: C.purpleFaint,
                          borderWidth: 2,
                          borderColor: C.purpleBdr,
                          borderStyle: 'dashed',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          opacity: isUploadingLogo ? 0.6 : 1,
                        }}
                      >
                        {isUploadingLogo ? (
                          <ActivityIndicator color={C.purple} />
                        ) : (
                          <>
                            <Camera size={32} color={C.purple} />
                            <Text
                              style={{
                                color: C.purpleLight,
                                fontSize: 13,
                                fontWeight: '600',
                                textAlign: 'center',
                                writingDirection: 'rtl',
                              }}
                            >
                              בחר לוגו
                            </Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
              {step === 13 && (
                <View>
                  <StepHeader
                    title="תמונות של העסק"
                    subtitle="נהל תמונות, תיוגים והמלצות ל-AI"
                  />
                  <View
                    style={{
                      flexDirection: rtl.flexDirection,
                      flexWrap: 'wrap',
                      gap: 12,
                      marginTop: 8,
                      justifyContent: 'flex-start',
                    }}
                  >
                    {profile.images.map((uri, i) => {
                      const storageRef = profile.imageStorageRefs[i] ?? uri;
                      const meta = profile.imageMetadata.find(
                        (item) => item.storageRef === storageRef
                      );
                      const activeLabel = IMAGE_LABELS.find(
                        (item) => item.key === meta?.label
                      );
                      return (
                        <View
                          key={storageRef}
                          style={{
                            width: '48%',
                            minWidth: 150,
                            borderRadius: 18,
                            backgroundColor: C.card,
                            borderWidth: 1,
                            borderColor: meta?.featured ? C.purple : C.border,
                            overflow: 'hidden',
                          }}
                        >
                          <View style={{ position: 'relative' }}>
                            <Image
                              source={{ uri }}
                              style={{
                                width: '100%',
                                aspectRatio: 1,
                                backgroundColor: C.cardInner,
                              }}
                            />
                            {meta?.featured && (
                              <View
                                style={{
                                  position: 'absolute',
                                  top: 8,
                                  ...position.start(8),
                                  borderRadius: 999,
                                  backgroundColor: 'rgba(124,58,237,0.92)',
                                  paddingHorizontal: 9,
                                  paddingVertical: 5,
                                  flexDirection: rtl.flexDirection,
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Crown size={12} color="#fff" />
                                <Text
                                  style={{
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: '800',
                                    textAlign: 'right',
                                    writingDirection: 'rtl',
                                  }}
                                >
                                  ראשית
                                </Text>
                              </View>
                            )}
                            {activeLabel && (
                              <View
                                style={{
                                  position: 'absolute',
                                  bottom: 8,
                                  ...position.start(8),
                                  borderRadius: 999,
                                  backgroundColor: 'rgba(10,10,10,0.72)',
                                  paddingHorizontal: 9,
                                  paddingVertical: 5,
                                }}
                              >
                                <Text
                                  style={{
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: '700',
                                    textAlign: 'right',
                                    writingDirection: 'rtl',
                                  }}
                                >
                                  {activeLabel.label}
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={{ padding: 10, gap: 10 }}>
                            <View style={{ flexDirection: rtl.flexDirection, gap: 8 }}>
                              <Pressable
                                onPress={() => confirmRemoveImage(i)}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel="מחק תמונה"
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 12,
                                  backgroundColor: 'rgba(239,68,68,0.12)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <X size={17} color="#f87171" />
                              </Pressable>
                              <Pressable
                                onPress={() => replaceImage(i)}
                                disabled={isUploadingImages}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel="החלף תמונה"
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 12,
                                  backgroundColor: C.cardInner,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  opacity: isUploadingImages ? 0.6 : 1,
                                }}
                              >
                                <Pencil size={16} color={C.textLight} />
                              </Pressable>
                              <Pressable
                                onPress={() => setFeaturedImage(storageRef)}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel="קבע כתמונה ראשית"
                                style={{
                                  flex: 1,
                                  minHeight: 38,
                                  borderRadius: 12,
                                  backgroundColor: meta?.featured
                                    ? C.purple
                                    : C.purpleFaint,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexDirection: rtl.flexDirection,
                                  gap: 5,
                                }}
                              >
                                <Crown
                                  size={14}
                                  color={
                                    meta?.featured ? '#fff' : C.purpleLight
                                  }
                                />
                                <Text
                                  style={{
                                    color: meta?.featured
                                      ? '#fff'
                                      : C.purpleLight,
                                    fontSize: 12,
                                    fontWeight: '800',
                                    textAlign: 'center',
                                    writingDirection: 'rtl',
                                  }}
                                >
                                  ראשית
                                </Text>
                              </Pressable>
                            </View>

                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator={false}
                              contentContainerStyle={{
                                gap: 6,
                                flexDirection: rtl.flexDirection,
                              }}
                            >
                              {IMAGE_LABELS.map((item) => {
                                const selected = meta?.label === item.key;
                                return (
                                  <Pressable
                                    key={item.key}
                                    onPress={() =>
                                      updateImageMetadata(storageRef, {
                                        label: selected ? undefined : item.key,
                                      })
                                    }
                                    accessible={true}
                                    accessibilityRole="button"
                                    accessibilityLabel={`תגית ${item.label}`}
                                    style={{
                                      minHeight: 32,
                                      paddingHorizontal: 10,
                                      borderRadius: 999,
                                      backgroundColor: selected
                                        ? C.purple
                                        : C.cardInner,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: selected ? '#fff' : C.textLight,
                                        fontSize: 12,
                                        fontWeight: '700',
                                        textAlign: 'center',
                                        writingDirection: 'rtl',
                                      }}
                                    >
                                      {item.label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </ScrollView>

                            <View
                              style={{
                                flexDirection: rtl.flexDirection,
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <View
                                style={{ flexDirection: rtl.flexDirection, gap: 2 }}
                              >
                                {[1, 2, 3, 4, 5].map((rating) => {
                                  const selected =
                                    (meta?.rating ?? 0) >= rating;
                                  return (
                                    <Pressable
                                      key={rating}
                                      onPress={() =>
                                        updateImageMetadata(storageRef, {
                                          rating,
                                        })
                                      }
                                      accessible={true}
                                      accessibilityRole="button"
                                      accessibilityLabel={`דירוג ${rating} כוכבים`}
                                      style={{
                                        width: 26,
                                        height: 26,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      <Star
                                        size={16}
                                        color={selected ? '#facc15' : C.textSub}
                                        fill={
                                          selected ? '#facc15' : 'transparent'
                                        }
                                      />
                                    </Pressable>
                                  );
                                })}
                              </View>
                              <Pressable
                                onPress={() =>
                                  updateImageMetadata(storageRef, {
                                    aiRecommended: !meta?.aiRecommended,
                                  })
                                }
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel="סמן מומלץ ל-AI"
                                style={{
                                  minHeight: 32,
                                  paddingHorizontal: 9,
                                  borderRadius: 999,
                                  backgroundColor: meta?.aiRecommended
                                    ? C.purple
                                    : C.purpleFaint,
                                  flexDirection: rtl.flexDirection,
                                  alignItems: 'center',
                                  gap: 5,
                                }}
                              >
                                <Sparkles
                                  size={13}
                                  color={
                                    meta?.aiRecommended ? '#fff' : C.purpleLight
                                  }
                                />
                                <Text
                                  style={{
                                    color: meta?.aiRecommended
                                      ? '#fff'
                                      : C.purpleLight,
                                    fontSize: 11,
                                    fontWeight: '800',
                                    textAlign: 'center',
                                    writingDirection: 'rtl',
                                  }}
                                >
                                  מומלץ ל-AI
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                    {profile.images.length < 10 && (
                      <Pressable
                        onPress={pickImages}
                        disabled={isUploadingImages}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="הוסף תמונות עסק"
                        style={{
                          width: '48%',
                          minWidth: 150,
                          aspectRatio: 1,
                          borderRadius: 18,
                          backgroundColor: C.purpleFaint,
                          borderWidth: 2,
                          borderColor: C.purpleBdr,
                          borderStyle: 'dashed',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          opacity: isUploadingImages ? 0.6 : 1,
                        }}
                      >
                        {isUploadingImages ? (
                          <ActivityIndicator color={C.purple} />
                        ) : (
                          <>
                            <ImagePlus size={28} color={C.purple} />
                            <Text
                              style={{
                                color: C.purpleLight,
                                fontSize: 13,
                                fontWeight: '700',
                                textAlign: 'center',
                                writingDirection: 'rtl',
                              }}
                            >
                              הוסף תמונות
                            </Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                  <Text
                    style={{
                      color: C.textMid,
                      fontSize: 12,
                      textAlign: 'center',
                      writingDirection: 'rtl',
                      marginTop: 14,
                    }}
                  >
                    {profile.images.length} / 10 תמונות
                  </Text>
                </View>
              )}
            </Animated.View>
          </ScrollView>

          <View
            style={{
              flexDirection: rtl.flexDirection,
              gap: 10,
              paddingTop: 16,
              paddingBottom: insets.bottom + 98,
            }}
          >
            {step > 1 && (
              <Pressable
                onPress={back}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="חזור"
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: C.border,
                  backgroundColor: C.card,
                  flexDirection: rtl.flexDirection,
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ArrowRight size={16} color={C.textLight} />
                <Text
                  style={{
                    color: C.textLight,
                    fontSize: 14,
                    fontWeight: '600',
                    textAlign: 'center',
                    writingDirection: 'rtl',
                  }}
                >
                  חזור
                </Text>
              </Pressable>
            )}
            {step < TOTAL_STEPS ? (
              <Pressable
                onPress={next}
                disabled={!canProceed(step)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="הבא"
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 16,
                  backgroundColor: canProceed(step) ? C.purple : '#3b1f6e',
                  flexDirection: rtl.flexDirection,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: canProceed(step) ? 0.45 : 0.15,
                  shadowRadius: 14,
                  elevation: 8,
                  opacity: canProceed(step) ? 1 : 0.6,
                }}
              >
                <Text
                  style={{ color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl' }}
                >
                  הבא
                </Text>
                <ArrowLeft size={18} color="#fff" />
              </Pressable>
            ) : (
              <Pressable
                onPress={finish}
                disabled={isSaving || isScanningWebsite || !canProceed(step)}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="סיום"
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  borderRadius: 16,
                  backgroundColor: C.purple,
                  flexDirection: rtl.flexDirection,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  shadowColor: C.purple,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.5,
                  shadowRadius: 14,
                  elevation: 8,
                  opacity: isSaving || isScanningWebsite ? 0.65 : 1,
                }}
              >
                {isSaving || isScanningWebsite ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Check size={18} color="#fff" />
                )}
                <Text
                  style={{ color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl' }}
                >
                  {isSaving
                    ? 'שומר...'
                    : isScanningWebsite
                      ? 'סורק אתר...'
                      : 'סיום ✨'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Small step components ──────────────────────────────────────────────────

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{
          color: '#fff',
          fontSize: 26,
          fontWeight: '800',
          textAlign: rtl.textAlign,
          writingDirection: 'rtl',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      {subtitle && (
        <Text style={{ color: C.textMid, fontSize: 14, textAlign: rtl.textAlign, writingDirection: 'rtl' }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        color: C.textLight,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.6,
        textAlign: 'right',
        writingDirection: 'rtl',
        marginBottom: 8,
      }}
    >
      {label}
    </Text>
  );
}

function BareInput({
  placeholder,
  value,
  onChange,
  multiline,
  keyboardType,
  autoCapitalize,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'url' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        backgroundColor: C.cardInner,
        borderWidth: 1.5,
        borderColor: focused ? C.purple : C.border,
        borderRadius: 16,
        paddingHorizontal: 16,
        shadowColor: C.purple,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: focused ? 0.25 : 0,
        shadowRadius: 10,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor="#3f3f46"
        multiline={multiline}
        numberOfLines={multiline ? 5 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={{
          color: '#e4e4e7',
          fontSize: 16,
          textAlign: 'right',
          writingDirection: 'rtl',
          paddingVertical: multiline ? 16 : 18,
          minHeight: multiline ? 130 : undefined,
          lineHeight: multiline ? 24 : undefined,
        }}
      />
    </View>
  );
}

function TextStep({
  title,
  placeholder,
  value,
  onChange,
  multiline,
  keyboardType,
  autoCapitalize,
}: {
  title: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'url' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  return (
    <View>
      <StepHeader title={title} />
      <BareInput
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function AudienceStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // Split the current input on commas so a chip already present in the text
  // renders as "active" — lets the user visually confirm which quick options
  // are baked into their answer, and prevents duplicate appends.
  const currentTokens = value
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const handleChipPress = (opt: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      onChange(opt);
      return;
    }
    if (currentTokens.includes(opt)) return; // already picked — no-op
    // Preserve whatever the user typed, drop any trailing comma/space, then
    // append the new chip with a clean ", " separator.
    const cleanBase = trimmed.replace(/[,\s]+$/, '');
    onChange(`${cleanBase}, ${opt}`);
  };

  return (
    <View>
      <StepHeader title="מי קהל היעד שלך?" />

      <BareInput
        placeholder="לדוגמה: נשים בגיל 25-45, משפחות צעירות..."
        value={value}
        onChange={onChange}
      />

      <Text
        style={{
          color: C.textLight,
          fontSize: 13,
          fontWeight: '600',
          textAlign: rtl.textAlign,
          writingDirection: 'rtl',
          marginTop: 18,
          marginBottom: 10,
        }}
      >
        או בחר במהירות:
      </Text>

      <View
        style={{
          flexDirection: rtl.flexDirection,
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'flex-start',
        }}
      >
        {AUDIENCE_QUICK_OPTIONS.map((opt) => {
          const selected = currentTokens.includes(opt);
          return (
            <Pressable
              key={opt}
              onPress={() => handleChipPress(opt)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: selected
                  ? C.purple
                  : pressed
                    ? C.purpleFaint
                    : C.cardInner,
                borderWidth: 1.5,
                borderColor: selected ? C.purple : C.purpleBdr,
                shadowColor: C.purple,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: selected ? 0.4 : 0,
                shadowRadius: 10,
                elevation: selected ? 6 : 0,
              })}
            >
              <Text
                style={{
                  color: selected ? '#fff' : '#d4d4d8',
                  fontSize: 14,
                  fontWeight: selected ? '800' : '600',
                  textAlign: 'center',
                  writingDirection: 'rtl',
                }}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BusinessTypeStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isOtherValue = value !== '' && !BUSINESS_TYPES.includes(value);
  const [otherSelected, setOtherSelected] = useState(isOtherValue);
  const [otherText, setOtherText] = useState(isOtherValue ? value : '');

  const selectedChip = otherSelected
    ? BUSINESS_TYPE_OTHER
    : BUSINESS_TYPES.includes(value)
      ? value
      : '';

  const handleChipPress = (opt: string) => {
    if (opt === BUSINESS_TYPE_OTHER) {
      if (!otherSelected) {
        // User is actively switching TO "אחר" — always start with an empty input
        // so old category values or stale data never bleed in.
        setOtherText('');
        onChange(''); // canProceed stays false until user types
      }
      setOtherSelected(true);
    } else {
      setOtherSelected(false);
      onChange(opt);
    }
  };

  const handleOtherTextChange = (text: string) => {
    setOtherText(text);
    onChange(text);
  };

  const allOptions = [...BUSINESS_TYPES, BUSINESS_TYPE_OTHER];

  return (
    <View>
      <StepHeader title="איזה סוג עסק?" />
      <View
        style={{
          flexDirection: rtl.flexDirection,
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'flex-start',
        }}
      >
        {allOptions.map((opt) => {
          const selected = selectedChip === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => handleChipPress(opt)}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: selected ? C.purple : C.cardInner,
                borderWidth: 1.5,
                borderColor: selected ? C.purple : C.border,
                shadowColor: C.purple,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: selected ? 0.4 : 0,
                shadowRadius: 10,
                elevation: selected ? 6 : 0,
              }}
            >
              <Text
                style={{
                  color: selected ? '#fff' : '#d4d4d8',
                  fontSize: 14,
                  fontWeight: selected ? '700' : '500',
                  textAlign: rtl.textAlign,
                  writingDirection: 'rtl',
                }}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {otherSelected && (
        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              color: C.textLight,
              fontSize: 13,
              fontWeight: '600',
              textAlign: rtl.textAlign,
              writingDirection: 'rtl',
              marginBottom: 8,
            }}
          >
            לא מצאת את סוג העסק שלך? כתוב אותו כאן
          </Text>
          <TextInput
            value={otherText}
            onChangeText={handleOtherTextChange}
            placeholder="לדוגמה: סטודיו לקעקועים, יועץ משכנתאות, מאלף כלבים..."
            placeholderTextColor={C.textSub}
            style={{
              backgroundColor: C.cardInner,
              borderWidth: 1.5,
              borderColor: C.purpleBdr,
              borderRadius: 14,
              paddingHorizontal: 16,
              paddingVertical: 14,
              color: '#fff',
              fontSize: 15,
              textAlign: rtl.textAlign,
              writingDirection: 'rtl',
            }}
          />
          {otherText.trim() === '' && (
            <Text
              style={{
                color: '#f87171',
                fontSize: 12,
                textAlign: rtl.textAlign,
                writingDirection: 'rtl',
                marginTop: 8,
              }}
            >
              כתוב איזה סוג עסק זה כדי להמשיך
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function ChipsStep({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View>
      <StepHeader title={title} />
      <View
        style={{
          flexDirection: rtl.flexDirection,
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'flex-start',
        }}
      >
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: selected ? C.purple : C.cardInner,
                borderWidth: 1.5,
                borderColor: selected ? C.purple : C.border,
                shadowColor: C.purple,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: selected ? 0.4 : 0,
                shadowRadius: 10,
                elevation: selected ? 6 : 0,
              }}
            >
              <Text
                style={{
                  color: selected ? '#fff' : '#d4d4d8',
                  fontSize: 14,
                  fontWeight: selected ? '700' : '500',
                  textAlign: 'right',
                  writingDirection: 'rtl',
                }}
              >
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
