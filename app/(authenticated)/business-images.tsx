// ─── ניהול תמונות העסק — dedicated media manager ──────────────────────────
// Lets the user manage uploaded business images outside the onboarding flow.
//
// Scope: visuals + per-image actions ONLY. This screen calls the dedicated
// per-image mutations in `convex/businessProfiles.ts` (addBusinessImages,
// deleteBusinessImage, replaceBusinessImage, setFeaturedBusinessImage,
// updateBusinessImageMeta). It does NOT touch the website scanner, post
// generation, or onboarding flow.

import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Camera,
  Check,
  ImagePlus,
  MoreHorizontal,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';
import { position, rtl } from '@/lib/rtl';

// ─── Safe loader for expo-image-picker (same pattern as business-profile) ───
type ImagePickerModule = typeof import('expo-image-picker');
let ImagePicker: ImagePickerModule | null = null;
try {
  ImagePicker = require('expo-image-picker') as ImagePickerModule;
} catch {
  ImagePicker = null;
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
  gold: '#fbbf24',
  goldFaint: 'rgba(251,191,36,0.16)',
  goldBdr: 'rgba(251,191,36,0.45)',
};

// ─── Tag labels (Hebrew) ────────────────────────────────────────────────────
type ImageLabel =
  | 'logo'
  | 'product'
  | 'mood'
  | 'team'
  | 'place'
  | 'food'
  | 'workout'
  | 'before_after';

const LABEL_OPTIONS: { value: ImageLabel; label: string }[] = [
  { value: 'logo',         label: 'לוגו' },
  { value: 'product',      label: 'מוצר' },
  { value: 'mood',         label: 'אווירה' },
  { value: 'team',         label: 'צוות' },
  { value: 'place',        label: 'מקום' },
  { value: 'food',         label: 'אוכל' },
  { value: 'workout',      label: 'אימון' },
  { value: 'before_after', label: 'לפני/אחרי' },
];

function labelText(value: ImageLabel | undefined): string {
  return LABEL_OPTIONS.find((o) => o.value === value)?.label ?? '';
}

// Single source of truth for the action sheet item shape so the bottom-sheet
// renderer stays simple.
type SheetMode = 'menu' | 'tags' | 'rating' | null;

type MediaItem = {
  storageRef: string;
  url?: string;
  label?: ImageLabel;
  rating?: number;
  aiRecommended?: boolean;
  featured?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

export default function BusinessImagesScreen() {
  const router = useRouter();
  const profile = useQuery(api.businessProfiles.getMyBusinessProfile);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addBusinessImages = useMutation(api.businessProfiles.addBusinessImages);
  const deleteBusinessImage = useMutation(api.businessProfiles.deleteBusinessImage);
  const replaceBusinessImage = useMutation(api.businessProfiles.replaceBusinessImage);
  const setFeaturedBusinessImage = useMutation(api.businessProfiles.setFeaturedBusinessImage);
  const updateBusinessImageMeta = useMutation(api.businessProfiles.updateBusinessImageMeta);

  const items: MediaItem[] = (profile?.imageMedia ?? []) as MediaItem[];
  const isLoading = profile === undefined;

  // Bottom sheet state — one selected item, one mode at a time.
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyRef, setBusyRef] = useState<string | null>(null);

  const openMenu = (item: MediaItem) => {
    setActiveItem(item);
    setSheetMode('menu');
  };
  const closeSheet = () => {
    setSheetMode(null);
    setActiveItem(null);
  };

  // ── Picker helpers ──────────────────────────────────────────────────────
  const ensurePicker = (): boolean => {
    if (ImagePicker) return true;
    Alert.alert(
      'נדרש בנייה מחדש',
      'מודול בחירת התמונות לא קיים בבניין הנוכחי. בנה מחדש ונסה שוב.',
    );
    return false;
  };

  const uploadOneFromLibrary = async (): Promise<string | null> => {
    if (!ensurePicker() || !ImagePicker) return null;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('נדרשת הרשאה', 'אנא אפשר גישה לתמונות בהגדרות.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return null;
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(result.assets[0].uri);
    const blob = await response.blob();
    const upload = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'image/jpeg' },
      body: blob,
    });
    const { storageId } = await upload.json();
    if (!storageId) throw new Error('Upload failed: no storageId');
    return storageId as string;
  };

  // ── Action handlers ────────────────────────────────────────────────────
  const handleAddImages = async () => {
    if (!ensurePicker() || !ImagePicker || uploading) return;
    const remaining = 10 - items.length;
    if (remaining <= 0) {
      Alert.alert('הגעת למקסימום', 'אפשר להעלות עד 10 תמונות.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('נדרשת הרשאה', 'אנא אפשר גישה לתמונות בהגדרות.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets.length) return;

    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const upload = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': blob.type || 'image/jpeg' },
          body: blob,
        });
        const { storageId } = await upload.json();
        if (storageId) uploaded.push(storageId as string);
      }
      if (uploaded.length) {
        await addBusinessImages({ storageRefs: uploaded });
      }
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו להעלות חלק מהתמונות. נסה שוב.');
    } finally {
      setUploading(false);
    }
  };

  const handleReplace = async (item: MediaItem) => {
    closeSheet();
    if (!ensurePicker()) return;
    setBusyRef(item.storageRef);
    try {
      const newRef = await uploadOneFromLibrary();
      if (!newRef) return;
      await replaceBusinessImage({
        storageRef: item.storageRef,
        newStorageRef: newRef,
      });
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו להחליף את התמונה. נסה שוב.');
    } finally {
      setBusyRef(null);
    }
  };

  const handleDelete = (item: MediaItem) => {
    Alert.alert(
      'מחיקת תמונה',
      'האם למחוק את התמונה הזו? הפעולה לא ניתנת לביטול.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            closeSheet();
            setBusyRef(item.storageRef);
            try {
              await deleteBusinessImage({ storageRef: item.storageRef });
            } catch {
              Alert.alert('שגיאה', 'לא הצלחנו למחוק. נסה שוב.');
            } finally {
              setBusyRef(null);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const handleSetFeatured = async (item: MediaItem) => {
    closeSheet();
    setBusyRef(item.storageRef);
    try {
      await setFeaturedBusinessImage({
        storageRef: item.featured ? null : item.storageRef,
      });
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לעדכן. נסה שוב.');
    } finally {
      setBusyRef(null);
    }
  };

  const handleToggleAi = async (item: MediaItem) => {
    closeSheet();
    setBusyRef(item.storageRef);
    try {
      await updateBusinessImageMeta({
        storageRef: item.storageRef,
        aiRecommended: !item.aiRecommended,
      });
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לעדכן. נסה שוב.');
    } finally {
      setBusyRef(null);
    }
  };

  const handleSetLabel = async (item: MediaItem, label: ImageLabel | null) => {
    setBusyRef(item.storageRef);
    try {
      await updateBusinessImageMeta({
        storageRef: item.storageRef,
        label,
      });
      // Keep the latest selection visible in the sheet
      setActiveItem((current) =>
        current && current.storageRef === item.storageRef
          ? { ...current, label: label ?? undefined }
          : current,
      );
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לעדכן את התג. נסה שוב.');
    } finally {
      setBusyRef(null);
    }
  };

  const handleSetRating = async (item: MediaItem, rating: number | null) => {
    setBusyRef(item.storageRef);
    try {
      await updateBusinessImageMeta({
        storageRef: item.storageRef,
        rating,
      });
      setActiveItem((current) =>
        current && current.storageRef === item.storageRef
          ? { ...current, rating: rating ?? undefined }
          : current,
      );
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לעדכן את הדירוג. נסה שוב.');
    } finally {
      setBusyRef(null);
    }
  };

  // ── Rendering ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 14,
          flexDirection: rtl.flexDirection,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' }}>
            ניהול תמונות העסק
          </Text>
          <Text style={{ color: C.textMid, fontSize: 12, marginTop: 2, textAlign: 'right', writingDirection: 'rtl' }}>
            {items.length} / 10 תמונות
          </Text>
        </View>
        <Pressable onPress={() => router.back()} accessibilityLabel="חזור" style={{ padding: 6 }}>
          <ArrowRight size={22} color={C.textLight} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        // Generous bottom padding so the floating upload button and the tab
        // bar never cover the last card.
        contentContainerStyle={{ paddingBottom: 150, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ paddingTop: 80, alignItems: 'center' }}>
            <ActivityIndicator color={C.purple} size="large" />
          </View>
        ) : items.length === 0 ? (
          <EmptyState onAdd={handleAddImages} uploading={uploading} />
        ) : (
          <View style={{ gap: 14, marginTop: 4 }}>
            {items.map((item) => (
              <ImageCard
                key={item.storageRef}
                item={item}
                isBusy={busyRef === item.storageRef}
                onPreview={() => setPreviewItem(item)}
                onMenu={() => openMenu(item)}
                onToggleFeatured={() => handleSetFeatured(item)}
                onToggleAi={() => handleToggleAi(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating upload button — always visible, never covered by tab bar */}
      {!isLoading && items.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            bottom: 150,
            width: '100%',
            paddingHorizontal: 20,
          }}
        >
          <Pressable
            onPress={handleAddImages}
            disabled={uploading || items.length >= 10}
            accessibilityLabel="העלה תמונה חדשה"
            style={{
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 16,
              borderRadius: 999,
              backgroundColor: C.purple,
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.5,
              shadowRadius: 16,
              elevation: 12,
              opacity: uploading || items.length >= 10 ? 0.6 : 1,
            }}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ImagePlus size={20} color="#fff" />
            )}
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
              {uploading ? 'מעלה...' : 'העלה תמונה'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* ─── Full-screen preview modal ─── */}
      <Modal
        visible={previewItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewItem(null)}
      >
        <Pressable
          onPress={() => setPreviewItem(null)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.92)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          {previewItem?.url ? (
            <Image
              source={{ uri: previewItem.url }}
              style={{ width: '100%', aspectRatio: 1, borderRadius: 20 }}
              resizeMode="contain"
            />
          ) : null}
          <Pressable
            onPress={() => setPreviewItem(null)}
            accessibilityLabel="סגור"
            style={{
              position: 'absolute',
              top: 60,
              ...position.end(24),
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Bottom action sheet ─── */}
      <ActionSheet
        item={activeItem}
        mode={sheetMode}
        onClose={closeSheet}
        onPreview={(item) => {
          closeSheet();
          setPreviewItem(item);
        }}
        onReplace={handleReplace}
        onDelete={handleDelete}
        onToggleFeatured={handleSetFeatured}
        onToggleAi={handleToggleAi}
        onSelectTags={() => setSheetMode('tags')}
        onSelectRating={() => setSheetMode('rating')}
        onSetLabel={handleSetLabel}
        onSetRating={handleSetRating}
        onBackToMenu={() => setSheetMode('menu')}
      />
    </SafeAreaView>
  );
}

// ─── Image card ────────────────────────────────────────────────────────────
function ImageCard({
  item,
  isBusy,
  onPreview,
  onMenu,
  onToggleFeatured,
  onToggleAi,
}: {
  item: MediaItem;
  isBusy: boolean;
  onPreview: () => void;
  onMenu: () => void;
  onToggleFeatured: () => void;
  onToggleAi: () => void;
}) {
  const tag = labelText(item.label);
  return (
    <View
      style={{
        backgroundColor: C.card,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: item.featured ? C.goldBdr : C.border,
        overflow: 'hidden',
        shadowColor: item.featured ? C.gold : C.purple,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: item.featured ? 0.32 : 0.18,
        shadowRadius: 14,
        elevation: 6,
      }}
    >
      {/* Image (full-bleed, tap to preview) */}
      <Pressable
        onPress={onPreview}
        accessibilityLabel="הצג תמונה"
        style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }}
      >
        {item.url ? (
          <Image
            source={{ uri: item.url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : null}

        {/* Small featured badge (top-start in RTL) */}
        {item.featured ? (
          <View
            style={{
              position: 'absolute',
              top: 12,
              ...position.start(12),
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: C.goldFaint,
              borderWidth: 1,
              borderColor: C.goldBdr,
            }}
          >
            <Star size={12} color={C.gold} fill={C.gold} />
            <Text style={{ color: C.gold, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' }}>
              תמונה ראשית
            </Text>
          </View>
        ) : null}

        {/* AI-recommended badge (top-end in RTL) */}
        {item.aiRecommended ? (
          <View
            style={{
              position: 'absolute',
              top: 12,
              ...position.end(12),
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: C.purpleFaint,
              borderWidth: 1,
              borderColor: C.purpleBdr,
            }}
          >
            <Sparkles size={12} color={C.purpleLight} />
            <Text style={{ color: C.purpleLight, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' }}>
              מומלץ ל-AI
            </Text>
          </View>
        ) : null}

        {/* Working indicator */}
        {isBusy ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '100%',
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : null}
      </Pressable>

      {/* Bottom meta strip: tag, rating, single 3-dot menu */}
      <View
        style={{
          flexDirection: rtl.flexDirection,
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
          paddingVertical: 12,
          gap: 10,
        }}
      >
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          {/* Tag pill */}
          {tag ? (
            <View
              style={{
                flexDirection: rtl.flexDirection,
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: C.cardInner,
                borderWidth: 1,
                borderColor: C.purpleBdr,
              }}
            >
              <Text style={{ color: C.purpleLight, fontSize: 12, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' }}>
                {tag}
              </Text>
            </View>
          ) : (
            <Pressable onPress={onMenu} hitSlop={6}>
              <Text style={{ color: C.textMid, fontSize: 12, textAlign: 'right', writingDirection: 'rtl' }}>
                ללא תג · לחץ להוספה
              </Text>
            </Pressable>
          )}
          {/* Rating row */}
          <View style={{ flexDirection: rtl.flexDirection, gap: 3, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const filled = (item.rating ?? 0) >= n;
              return (
                <Star
                  key={n}
                  size={14}
                  color={filled ? C.gold : 'rgba(251,191,36,0.25)'}
                  fill={filled ? C.gold : 'transparent'}
                />
              );
            })}
          </View>
        </View>
        <Pressable
          onPress={onMenu}
          accessibilityLabel="פעולות תמונה"
          hitSlop={10}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: C.cardInner,
            borderWidth: 1,
            borderColor: C.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MoreHorizontal size={18} color={C.textLight} />
        </Pressable>
      </View>

      {/* Quick toggles — keeps the card cleaner than 5 inline buttons */}
      <View
        style={{
          flexDirection: rtl.flexDirection,
          gap: 8,
          paddingHorizontal: 14,
          paddingBottom: 14,
        }}
      >
        <QuickToggle
          label={item.featured ? 'ראשית ✓' : 'הגדר כראשית'}
          active={Boolean(item.featured)}
          onPress={onToggleFeatured}
          activeColor={C.gold}
          activeBg={C.goldFaint}
          activeBorder={C.goldBdr}
        />
        <QuickToggle
          label={item.aiRecommended ? 'מומלץ ל-AI ✓' : 'מומלץ ל-AI'}
          active={Boolean(item.aiRecommended)}
          onPress={onToggleAi}
          activeColor={C.purpleLight}
          activeBg={C.purpleFaint}
          activeBorder={C.purpleBdr}
        />
      </View>
    </View>
  );
}

function QuickToggle({
  label,
  active,
  onPress,
  activeColor,
  activeBg,
  activeBorder,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: active ? activeBg : C.cardInner,
        borderWidth: 1,
        borderColor: active ? activeBorder : C.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: active ? activeColor : C.textLight,
          fontSize: 13,
          fontWeight: '700',
          textAlign: 'center',
          writingDirection: 'rtl',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────
function EmptyState({ onAdd, uploading }: { onAdd: () => void; uploading: boolean }) {
  return (
    <View
      style={{
        marginTop: 40,
        padding: 28,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: C.purpleBdr,
        backgroundColor: C.card,
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 22,
          backgroundColor: C.purpleFaint,
          borderWidth: 1,
          borderColor: C.purpleBdr,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Camera size={28} color={C.purpleLight} />
      </View>
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch' }}>
        עדיין לא העלית תמונות
      </Text>
      <Text style={{ color: C.textMid, fontSize: 13, textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch', lineHeight: 19 }}>
        תמונות אמיתיות של העסק עוזרות ל-AI ליצור פוסטים מותאמים אישית.
      </Text>
      <Pressable
        onPress={onAdd}
        disabled={uploading}
        accessibilityLabel="העלה תמונות"
        style={{
          marginTop: 6,
          flexDirection: rtl.flexDirection,
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 999,
          backgroundColor: C.purple,
          opacity: uploading ? 0.7 : 1,
        }}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <ImagePlus size={18} color="#fff" />
        )}
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' }}>
          {uploading ? 'מעלה...' : 'העלה תמונה ראשונה'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Bottom action sheet ───────────────────────────────────────────────────
function ActionSheet({
  item,
  mode,
  onClose,
  onPreview,
  onReplace,
  onDelete,
  onToggleFeatured,
  onToggleAi,
  onSelectTags,
  onSelectRating,
  onSetLabel,
  onSetRating,
  onBackToMenu,
}: {
  item: MediaItem | null;
  mode: SheetMode;
  onClose: () => void;
  onPreview: (item: MediaItem) => void;
  onReplace: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onToggleFeatured: (item: MediaItem) => void;
  onToggleAi: (item: MediaItem) => void;
  onSelectTags: () => void;
  onSelectRating: () => void;
  onSetLabel: (item: MediaItem, label: ImageLabel | null) => void;
  onSetRating: (item: MediaItem, rating: number | null) => void;
  onBackToMenu: () => void;
}) {
  const visible = Boolean(item && mode);
  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: C.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderColor: C.purpleBdr,
            paddingHorizontal: 22,
            paddingTop: 14,
            paddingBottom: 32,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 4,
              borderRadius: 2,
              backgroundColor: C.border,
              marginBottom: 16,
            }}
          />

          {mode === 'menu' ? (
            <>
              <SheetRow label="הצג תמונה" onPress={() => onPreview(item)} />
              <SheetRow label="החלף תמונה" onPress={() => onReplace(item)} />
              <SheetRow
                label={item.featured ? 'הסר כראשית' : 'הגדר כתמונה ראשית'}
                onPress={() => onToggleFeatured(item)}
                activeIcon={item.featured ? <Check size={16} color={C.gold} /> : null}
              />
              <SheetRow
                label={item.aiRecommended ? 'בטל סימון ל-AI' : 'סמן כמומלץ ל-AI'}
                onPress={() => onToggleAi(item)}
                activeIcon={item.aiRecommended ? <Check size={16} color={C.purpleLight} /> : null}
              />
              <SheetRow label="ערוך תגים" onPress={onSelectTags} hint={labelText(item.label) || 'ללא תג'} />
              <SheetRow label="דירוג" onPress={onSelectRating} hint={`${item.rating ?? 0}/5`} />
              <SheetRow
                label="מחק תמונה"
                destructive
                icon={<Trash2 size={18} color="#f87171" />}
                onPress={() => onDelete(item)}
              />
            </>
          ) : null}

          {mode === 'tags' ? (
            <>
              <Pressable
                onPress={onBackToMenu}
                style={{ alignItems: 'flex-end', marginBottom: 10 }}
              >
                <Text style={{ color: C.purpleLight, fontSize: 13, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' }}>
                  ← חזור
                </Text>
              </Pressable>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginBottom: 12 }}>
                בחר תג
              </Text>
              <View style={{ flexDirection: rtl.flexDirection, flexWrap: 'wrap', gap: 8 }}>
                {LABEL_OPTIONS.map((opt) => {
                  const selected = item.label === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => onSetLabel(item, selected ? null : opt.value)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 14,
                        backgroundColor: selected ? C.purple : C.cardInner,
                        borderWidth: 1.5,
                        borderColor: selected ? C.purple : C.border,
                      }}
                    >
                      <Text
                        style={{
                          color: selected ? '#fff' : C.textLight,
                          fontSize: 14,
                          fontWeight: selected ? '800' : '600',
                          textAlign: 'right',
                          writingDirection: 'rtl',
                        }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {mode === 'rating' ? (
            <>
              <Pressable
                onPress={onBackToMenu}
                style={{ alignItems: 'flex-end', marginBottom: 10 }}
              >
                <Text style={{ color: C.purpleLight, fontSize: 13, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' }}>
                  ← חזור
                </Text>
              </Pressable>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginBottom: 12 }}>
                דרג את התמונה
              </Text>
              <View
                style={{
                  flexDirection: rtl.flexDirection,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 14,
                }}
              >
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = (item.rating ?? 0) >= n;
                  return (
                    <Pressable
                      key={n}
                      hitSlop={8}
                      onPress={() => onSetRating(item, (item.rating ?? 0) === n ? null : n)}
                    >
                      <Star
                        size={36}
                        color={filled ? C.gold : 'rgba(251,191,36,0.28)'}
                        fill={filled ? C.gold : 'transparent'}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: C.textMid, fontSize: 12, textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch', marginTop: 4 }}>
                לחץ על אותו כוכב כדי לבטל את הדירוג
              </Text>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetRow({
  label,
  hint,
  onPress,
  destructive,
  icon,
  activeIcon,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  destructive?: boolean;
  icon?: React.ReactNode;
  activeIcon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
      style={({ pressed }) => ({
        flexDirection: rtl.flexDirection,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent',
      })}
    >
      <View style={{ width: 28, alignItems: 'flex-end' }}>
        {activeIcon ?? icon ?? null}
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {hint ? (
          <Text style={{ color: C.textMid, fontSize: 11, fontWeight: '600', marginBottom: 2, textAlign: 'right', writingDirection: 'rtl' }}>
            {hint}
          </Text>
        ) : null}
        <Text
          style={{
            color: destructive ? '#f87171' : '#e4e4e7',
            fontSize: 15,
            fontWeight: '700',
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// Mark this name as exported to satisfy router scanning; unused Animated import
// reserved for future entry animations.
void Animated;
