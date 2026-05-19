import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, X } from 'lucide-react-native';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';

// ─── Safe loader for expo-image-picker ──────────────────────────────────────
// If the native module isn't present in the running binary (stale dev build
// before rebuild), we degrade gracefully instead of throwing a red screen.
type ImagePickerModule = typeof import('expo-image-picker');
let ImagePicker: ImagePickerModule | null = null;
let imagePickerLoadError: string | null = null;
try {
  ImagePicker = require('expo-image-picker') as ImagePickerModule;
} catch (e) {
  imagePickerLoadError = e instanceof Error ? e.message : String(e);
}

const C = {
  bg:          '#0a0a0a',
  card:        '#111114',
  cardInner:   '#16161a',
  purple:      '#7C3AED',
  purpleLight: '#a78bfa',
  purpleFaint: 'rgba(124,58,237,0.12)',
  purpleBdr:   'rgba(124,58,237,0.35)',
  border:      'rgba(63,63,70,0.55)',
  textSub:     '#52525b',
  textMid:     '#71717a',
  textLight:   '#a1a1aa',
};

const BUSINESS_TYPES = [
  '🍕 מסעדה / בית קפה',
  '💪 כושר ובריאות',
  '💆 קוסמטיקה ויופי',
  '💅 ציפורניים',
  '✂️ מספרה',
  '🛍️ חנות',
  '⚖️ שירותים מקצועיים',
  '🏠 נדל"ן',
  '📱 טכנולוגיה',
  '🌟 אחר',
];

const STYLES = ['יוקרתי', 'מצחיק', 'מקצועי', 'צעיר', 'רגוע'];

const GOALS = [
  'להביא לקוחות חדשים',
  'לפרסם מבצעים',
  'לחזק את המותג',
  'להזכיר ללקוחות',
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
  logoUrl: string;
  images: string[];
};

const EMPTY: Profile = {
  businessName: '', businessType: '', description: '', audience: '',
  style: '', city: '', website: '', socialInstagram: '', socialFacebook: '',
  goal: '', services: '', uniqueness: '', logoUrl: '', images: [],
};

const TOTAL_STEPS = 13;

function isValidUrl(url: string): boolean {
  if (!url.trim()) return true; // optional
  const pattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/i;
  return pattern.test(url.trim());
}

export default function BusinessProfile() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const existing = useQuery(api.businessProfiles.getMyBusinessProfile);
  const saveProfile = useMutation(api.businessProfiles.saveBusinessProfile);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  useEffect(() => {
    if (!existing) return;
    setProfile({
      businessName: existing.businessName ?? '',
      businessType: existing.businessType ?? '',
      description:  existing.description ?? '',
      audience:     existing.audience ?? '',
      style:        existing.style ?? '',
      city:         existing.city ?? '',
      website:      existing.website ?? '',
      socialInstagram: existing.socialInstagram ?? '',
      socialFacebook:  existing.socialFacebook ?? '',
      goal:         existing.goal ?? '',
      services:     existing.services ?? '',
      uniqueness:   existing.uniqueness ?? '',
      logoUrl:      existing.logoUrl ?? '',
      images:       existing.images ?? [],
    });
  }, [existing]);

  // Slide animation between steps
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    slide.setValue(20);
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }).start();
  }, [step, slide]);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

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
    const base = process.env.EXPO_PUBLIC_CONVEX_URL?.replace('.convex.cloud', '.convex.site') ?? '';
    return `${base}/storage/${storageId}`;
  };

  const ensureImagePicker = (): boolean => {
    if (ImagePicker) return true;
    Alert.alert(
      'נדרש בנייה מחדש',
      'מודול בחירת התמונות עדיין לא קיים באפליקציה. הרץ:\n\nnpx expo prebuild --clean\nnpx expo run:ios\n\nכדי לכלול אותו בבניין.',
    );
    return false;
  };

  const pickLogo = async () => {
    if (!ensureImagePicker() || !ImagePicker) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('נדרשת הרשאה', 'אנא אפשר גישה לתמונות בהגדרות'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;
    setIsUploadingLogo(true);
    try {
      const url = await uploadImage(result.assets[0].uri);
      update('logoUrl', url);
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו להעלות את הלוגו');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const pickImages = async () => {
    if (!ensureImagePicker() || !ImagePicker) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('נדרשת הרשאה', 'אנא אפשר גישה לתמונות בהגדרות'); return; }
    const remaining = 10 - profile.images.length;
    if (remaining <= 0) { Alert.alert('הגעת למקסימום', 'אפשר להעלות עד 10 תמונות'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets.length) return;
    setIsUploadingImages(true);
    try {
      const urls = await Promise.all(result.assets.map((a) => uploadImage(a.uri)));
      update('images', [...profile.images, ...urls]);
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו להעלות חלק מהתמונות');
    } finally {
      setIsUploadingImages(false);
    }
  };

  const removeImage = (i: number) => {
    update('images', profile.images.filter((_, idx) => idx !== i));
  };

  const canProceed = (s: number): boolean => {
    switch (s) {
      case 1:  return profile.businessName.trim().length > 0;
      case 2:  return profile.businessType.length > 0;
      case 3:  return profile.description.trim().length > 0;
      case 4:  return profile.audience.trim().length > 0;
      case 5:  return profile.style.length > 0;
      case 6:  return profile.city.trim().length > 0;
      case 7:  return isValidUrl(profile.website);
      case 8:  return true;
      case 9:  return profile.goal.length > 0;
      case 10: return profile.services.trim().length > 0;
      case 11: return profile.uniqueness.trim().length > 0;
      case 12: return true;
      case 13: return true;
      default: return true;
    }
  };

  const next = () => {
    if (!canProceed(step)) {
      if (step === 7) Alert.alert('כתובת לא תקינה', 'אנא הזן כתובת URL תקינה (למשל: www.example.com)');
      return;
    }
    if (step < TOTAL_STEPS) setStep(step + 1);
  };
  const back = () => { if (step > 1) setStep(step - 1); };

  const finish = async () => {
    if (!canProceed(step)) return;
    setIsSaving(true);
    try {
      await saveProfile({
        businessName: profile.businessName.trim(),
        businessType: profile.businessType || undefined,
        description:  profile.description.trim() || undefined,
        audience:     profile.audience.trim() || undefined,
        style:        profile.style || undefined,
        city:         profile.city.trim() || undefined,
        website:      profile.website.trim() || undefined,
        socialInstagram: profile.socialInstagram.trim() || undefined,
        socialFacebook:  profile.socialFacebook.trim() || undefined,
        goal:         profile.goal || undefined,
        services:     profile.services.trim() || undefined,
        uniqueness:   profile.uniqueness.trim() || undefined,
        logoUrl:      profile.logoUrl || undefined,
        images:       profile.images.length ? profile.images : undefined,
      });
      Alert.alert('נשמר! ✅', 'פרטי העסק נשמרו בהצלחה', [
        { text: 'אישור', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור. נסה שנית.');
    } finally {
      setIsSaving(false);
    }
  };

  if (existing === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
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

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Pressable onPress={() => router.back()} style={{ padding: 4 }}>
              <X size={22} color={C.textLight} />
            </Pressable>
            <Text style={{ color: C.textLight, fontSize: 13, fontWeight: '600' }}>
              שלב {step} מתוך {TOTAL_STEPS}
            </Text>
          </View>

          <View style={{ height: 4, backgroundColor: C.border, borderRadius: 2, marginBottom: 32, overflow: 'hidden' }}>
            <View style={{
              width: `${(step / TOTAL_STEPS) * 100}%`,
              height: '100%',
              backgroundColor: C.purple,
              borderRadius: 2,
            }} />
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{ transform: [{ translateY: slide }], opacity: slide.interpolate({ inputRange: [0, 20], outputRange: [1, 0] }) }}>

              {step === 1  && <TextStep title="מה שם העסק?" placeholder="לדוגמה: קפה הגינה" value={profile.businessName} onChange={(v) => update('businessName', v)} />}
              {step === 2  && <ChipsStep title="איזה סוג עסק?" options={BUSINESS_TYPES} value={profile.businessType} onChange={(v) => update('businessType', v)} />}
              {step === 3  && <TextStep title="תיאור קצר על העסק" placeholder="ספר מה העסק עושה..." value={profile.description} onChange={(v) => update('description', v)} multiline />}
              {step === 4  && <TextStep title="מי קהל היעד שלך?" placeholder="לדוגמה: נשים בגיל 25-45, משפחות צעירות..." value={profile.audience} onChange={(v) => update('audience', v)} />}
              {step === 5  && <ChipsStep title="איזה סגנון שיווקי אתה אוהב?" options={STYLES} value={profile.style} onChange={(v) => update('style', v)} />}
              {step === 6  && <TextStep title="באיזה עיר / אזור?" placeholder="תל אביב, מרכז..." value={profile.city} onChange={(v) => update('city', v)} />}
              {step === 7  && <TextStep title="אתר העסק (אופציונלי)" placeholder="www.my-business.co.il" value={profile.website} onChange={(v) => update('website', v)} keyboardType="url" autoCapitalize="none" />}
              {step === 8  && (
                <View>
                  <StepHeader title="רשתות חברתיות" subtitle="אופציונלי — דלג אם אין" />
                  <FieldLabel label="אינסטגרם" />
                  <BareInput placeholder="@my-business" value={profile.socialInstagram} onChange={(v) => update('socialInstagram', v)} autoCapitalize="none" />
                  <View style={{ height: 16 }} />
                  <FieldLabel label="פייסבוק" />
                  <BareInput placeholder="facebook.com/my-business" value={profile.socialFacebook} onChange={(v) => update('socialFacebook', v)} autoCapitalize="none" />
                </View>
              )}
              {step === 9  && <ChipsStep title="מה המטרה של הפוסטים?" options={GOALS} value={profile.goal} onChange={(v) => update('goal', v)} />}
              {step === 10 && <TextStep title="אילו שירותים / מוצרים אתה מציע?" placeholder="לדוגמה: מספרה לגברים, תספורות, זקנים, שעווה..." value={profile.services} onChange={(v) => update('services', v)} multiline />}
              {step === 11 && <TextStep title="מה מיוחד בעסק שלך?" placeholder="ספר מה מבדיל אותך מהמתחרים. חשוב מאוד לאיכות הפוסטים..." value={profile.uniqueness} onChange={(v) => update('uniqueness', v)} multiline />}
              {step === 12 && (
                <View>
                  <StepHeader title="העלאת לוגו" subtitle="אופציונלי — לוגו אחד" />
                  <View style={{ alignItems: 'center', marginTop: 8 }}>
                    {profile.logoUrl ? (
                      <View style={{ position: 'relative' }}>
                        <Image source={{ uri: profile.logoUrl }} style={{ width: 160, height: 160, borderRadius: 24, borderWidth: 2, borderColor: C.purpleBdr }} />
                        <Pressable
                          onPress={() => update('logoUrl', '')}
                          style={{
                            position: 'absolute', top: -8, left: -8,
                            backgroundColor: '#ef4444', borderRadius: 16,
                            width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
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
                          width: 160, height: 160, borderRadius: 24,
                          backgroundColor: C.purpleFaint, borderWidth: 2, borderColor: C.purpleBdr,
                          borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8,
                          opacity: isUploadingLogo ? 0.6 : 1,
                        }}
                      >
                        {isUploadingLogo ? (
                          <ActivityIndicator color={C.purple} />
                        ) : (
                          <>
                            <Camera size={32} color={C.purple} />
                            <Text style={{ color: C.purpleLight, fontSize: 13, fontWeight: '600' }}>בחר לוגו</Text>
                          </>
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
              )}
              {step === 13 && (
                <View>
                  <StepHeader title="תמונות של העסק" subtitle="העלה 3-10 תמונות (אופציונלי)" />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
                    {profile.images.map((uri, i) => (
                      <View key={`${uri}-${i}`} style={{ position: 'relative' }}>
                        <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: 14, borderWidth: 1, borderColor: C.purpleBdr }} />
                        <Pressable
                          onPress={() => removeImage(i)}
                          style={{
                            position: 'absolute', top: -6, left: -6,
                            backgroundColor: '#ef4444', borderRadius: 14,
                            width: 26, height: 26, alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <X size={14} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                    {profile.images.length < 10 && (
                      <Pressable
                        onPress={pickImages}
                        disabled={isUploadingImages}
                        style={{
                          width: 100, height: 100, borderRadius: 14,
                          backgroundColor: C.purpleFaint, borderWidth: 2, borderColor: C.purpleBdr,
                          borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
                          opacity: isUploadingImages ? 0.6 : 1,
                        }}
                      >
                        {isUploadingImages
                          ? <ActivityIndicator color={C.purple} />
                          : <ImagePlus size={28} color={C.purple} />}
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: C.textMid, fontSize: 12, textAlign: 'center', marginTop: 14 }}>
                    {profile.images.length} / 10 תמונות
                  </Text>
                </View>
              )}

            </Animated.View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 16, paddingBottom: 24 }}>
            {step > 1 && (
              <Pressable
                onPress={back}
                style={{
                  paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16,
                  borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}
              >
                <ArrowRight size={16} color={C.textLight} />
                <Text style={{ color: C.textLight, fontSize: 14, fontWeight: '600' }}>חזור</Text>
              </Pressable>
            )}
            {step < TOTAL_STEPS ? (
              <Pressable
                onPress={next}
                disabled={!canProceed(step)}
                style={{
                  flex: 1, paddingVertical: 16, borderRadius: 16,
                  backgroundColor: canProceed(step) ? C.purple : '#3b1f6e',
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  shadowColor: C.purple, shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: canProceed(step) ? 0.45 : 0.15, shadowRadius: 14, elevation: 8,
                  opacity: canProceed(step) ? 1 : 0.6,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>הבא</Text>
                <ArrowLeft size={18} color="#fff" />
              </Pressable>
            ) : (
              <Pressable
                onPress={finish}
                disabled={isSaving || !canProceed(step)}
                style={{
                  flex: 1, paddingVertical: 16, borderRadius: 16,
                  backgroundColor: C.purple,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                  shadowColor: C.purple, shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
                  opacity: isSaving ? 0.65 : 1,
                }}
              >
                {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Check size={18} color="#fff" />}
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  {isSaving ? 'שומר...' : 'סיום ✨'}
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
      <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'right', marginBottom: 8 }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'right' }}>{subtitle}</Text>
      )}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text style={{ color: C.textLight, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textAlign: 'right', marginBottom: 8 }}>
      {label}
    </Text>
  );
}

function BareInput({
  placeholder, value, onChange, multiline, keyboardType, autoCapitalize,
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
    <View style={{
      backgroundColor: C.cardInner, borderWidth: 1.5,
      borderColor: focused ? C.purple : C.border,
      borderRadius: 16, paddingHorizontal: 16,
      shadowColor: C.purple, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: focused ? 0.25 : 0, shadowRadius: 10,
    }}>
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
          color: '#e4e4e7', fontSize: 16, textAlign: 'right',
          paddingVertical: multiline ? 16 : 18,
          minHeight: multiline ? 130 : undefined,
          lineHeight: multiline ? 24 : undefined,
        }}
      />
    </View>
  );
}

function TextStep({
  title, placeholder, value, onChange, multiline, keyboardType, autoCapitalize,
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

function ChipsStep({
  title, options, value, onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View>
      <StepHeader title={title} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={{
                paddingHorizontal: 18, paddingVertical: 13,
                borderRadius: 14,
                backgroundColor: selected ? C.purple : C.cardInner,
                borderWidth: 1.5, borderColor: selected ? C.purple : C.border,
                shadowColor: C.purple,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: selected ? 0.4 : 0,
                shadowRadius: 10, elevation: selected ? 6 : 0,
              }}
            >
              <Text style={{
                color: selected ? '#fff' : '#d4d4d8',
                fontSize: 14, fontWeight: selected ? '700' : '500',
              }}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
