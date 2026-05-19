import { useMutation, useQuery } from 'convex/react';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Copy, FileText, Image as ImageIcon, LayoutDashboard, Share2, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Share as NativeShare,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoTopLeft } from '@/components/LogoTopLeft';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

const C = {
  bg:          '#0a0a0a',
  card:        '#111114',
  purple:      '#7C3AED',
  purpleBdr:   'rgba(124,58,237,0.30)',
  purpleFaint: 'rgba(124,58,237,0.12)',
  border:      'rgba(63,63,70,0.55)',
  textSub:     '#52525b',
  textMid:     '#71717a',
};

const MARKETING_TEMPLATE = require('@/assets/images/easym-marketing-post.png');

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function PostCard({
  post,
  onDelete,
}: {
  post: {
    _id: Id<'posts'>;
    content: string;
    captionText?: string;
    imageUri?: string;
    createdAt: number;
    businessName?: string;
    businessType?: string;
    generationMode?: 'auto' | 'manual';
  };
  onDelete: (id: Id<'posts'>) => void;
}) {
  const [isSharingImage, setIsSharingImage] = useState(false);
  const [isSharingBoth, setIsSharingBoth]   = useState(false);
  const captionText = post.captionText ?? post.content;

  const confirmDelete = () =>
    Alert.alert('מחיקת פוסט', 'האם אתה בטוח שברצונך למחוק?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: () => onDelete(post._id) },
    ]);

  const shareImageOnly = async () => {
    if (isSharingImage) return;
    setIsSharingImage(true);
    try {
      const uri = post.imageUri;
      if (!uri) { Alert.alert('אין תמונה', 'לפוסט זה אין תמונה.'); return; }
      const [available, info] = await Promise.all([
        Sharing.isAvailableAsync(),
        FileSystem.getInfoAsync(uri),
      ]);
      if (available && info.exists) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'שתף תמונה', UTI: 'public.png' });
      } else {
        Alert.alert('שגיאה', 'לא נמצאה התמונה.');
      }
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשתף את התמונה.');
    } finally {
      setIsSharingImage(false);
    }
  };

  const copyCaption = async () => {
    await NativeShare.share({ message: captionText });
  };

  const shareBoth = async () => {
    if (isSharingBoth) return;
    setIsSharingBoth(true);
    try {
      const uri = post.imageUri;
      if (uri) {
        const [available, info] = await Promise.all([
          Sharing.isAvailableAsync(),
          FileSystem.getInfoAsync(uri),
        ]);
        if (available && info.exists) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'שתף פוסט', UTI: 'public.png' });
          Alert.alert('קפשן לפוסט', captionText, [{ text: 'סגור', style: 'cancel' }]);
          return;
        }
      }
      await NativeShare.share({ message: captionText });
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשתף.');
    } finally {
      setIsSharingBoth(false);
    }
  };

  const blockCard = {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.purpleBdr,
    borderRadius: 20,
    overflow: 'hidden' as const,
    shadowColor: C.purple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  };

  return (
    <View style={{ marginBottom: 28 }}>

      {/* ─ מטא-דאטה: עסק / מצב יצירה / תאריך ─ */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        {/* Right side: business name + mode badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          {post.businessName && (
            <Text
              numberOfLines={1}
              style={{ color: '#e4e4e7', fontSize: 13, fontWeight: '700', textAlign: 'right', flexShrink: 1 }}
            >
              {post.businessName}
            </Text>
          )}
          {post.generationMode && (
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
              backgroundColor: post.generationMode === 'auto' ? C.purpleFaint : 'rgba(63,63,70,0.4)',
              borderWidth: 1,
              borderColor: post.generationMode === 'auto' ? C.purpleBdr : C.border,
            }}>
              <Text style={{
                color: post.generationMode === 'auto' ? '#a78bfa' : C.textMid,
                fontSize: 10, fontWeight: '700',
              }}>
                {post.generationMode === 'auto' ? '✨ אוטומטי' : '✍️ ידני'}
              </Text>
            </View>
          )}
        </View>
        {/* Left side: date */}
        <Text style={{ color: C.textMid, fontSize: 11 }}>
          {formatDate(post.createdAt)}
        </Text>
      </View>

      {/* ══ כרטיס תמונה ══ */}
      <View style={[blockCard, { marginBottom: 12 }]}>
        <View style={{ backgroundColor: '#000', alignItems: 'center' }}>
          <Image
            source={post.imageUri ? { uri: post.imageUri } : MARKETING_TEMPLATE}
            style={{ width: '100%', height: 220 }}
            resizeMode="contain"
          />
        </View>
        <Pressable
          onPress={shareImageOnly}
          disabled={isSharingImage}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, paddingVertical: 12,
            backgroundColor: C.purpleFaint,
            opacity: isSharingImage ? 0.6 : 1,
          }}
        >
          {isSharingImage
            ? <ActivityIndicator size="small" color="#a78bfa" />
            : <ImageIcon size={14} color="#a78bfa" />}
          <Text style={{ color: '#a78bfa', fontSize: 13, fontWeight: '700' }}>
            {isSharingImage ? 'מכין...' : 'שתף תמונה'}
          </Text>
        </Pressable>
      </View>

      {/* ══ כרטיס כיתוב שיווקי ══ */}
      <View style={[blockCard, { marginBottom: 12 }]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
          <Text style={{ color: C.textMid, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textAlign: 'right', marginBottom: 8 }}>
            כיתוב שיווקי
          </Text>
          <Text selectable style={{ color: '#e4e4e7', fontSize: 14, lineHeight: 22, textAlign: 'right' }}>
            {captionText}
          </Text>
        </View>
        <Pressable
          onPress={copyCaption}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, paddingVertical: 12,
            backgroundColor: C.purpleFaint,
            borderTopWidth: 1, borderTopColor: C.purpleBdr,
          }}
        >
          <Copy size={14} color="#a78bfa" />
          <Text style={{ color: '#a78bfa', fontSize: 13, fontWeight: '700' }}>שתף כיתוב</Text>
        </Pressable>
      </View>

      {/* ══ כפתורים תחתונים ══ */}
      <View style={{ flexDirection: 'row', gap: 8 }}>

        <Pressable
          accessible={true}
          accessibilityLabel="שתף תמונה וכיתוב ביחד"
          accessibilityRole="button"
          onPress={shareBoth}
          disabled={isSharingBoth}
          style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, paddingVertical: 13, borderRadius: 16,
            backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
            opacity: isSharingBoth ? 0.6 : 1,
          }}
        >
          {isSharingBoth
            ? <ActivityIndicator size="small" color="#a78bfa" />
            : <Share2 size={14} color="#a78bfa" />}
          <Text style={{ color: '#a78bfa', fontSize: 13, fontWeight: '700' }}>
            {isSharingBoth ? 'מכין...' : 'שתף ביחד'}
          </Text>
        </Pressable>

        <Pressable
          accessible={true}
          accessibilityLabel="מחק פוסט"
          accessibilityRole="button"
          onPress={confirmDelete}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, paddingVertical: 13, paddingHorizontal: 20, borderRadius: 16,
            backgroundColor: 'rgba(239,68,68,0.10)',
            borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
          }}
        >
          <Trash2 size={14} color="#f87171" />
          <Text style={{ color: '#f87171', fontSize: 13, fontWeight: '700' }}>מחק</Text>
        </Pressable>

      </View>
    </View>
  );
}

// ─── מסך ראשי ────────────────────────────────────────────────────────────────
export default function PostsPage() {
  const posts     = useQuery(api.posts.getUserPosts);
  const deletePost = useMutation(api.posts.deletePost);

  const handleDelete = async (id: Id<'posts'>) => {
    try { await deletePost({ id }); }
    catch { Alert.alert('שגיאה', 'לא הצלחנו למחוק. נסה שנית.'); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <LogoTopLeft />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 80 }}>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginBottom: 6 }}>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>פוסטים</Text>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr, alignItems: 'center', justifyContent: 'center' }}>
              <LayoutDashboard size={20} color={C.purple} />
            </View>
          </View>
          <Text style={{ color: C.textSub, fontSize: 14, marginBottom: 28, textAlign: 'right' }}>
            הפוסטים השמורים שלך
          </Text>

          {posts === undefined ? (
            <ActivityIndicator color={C.purple} style={{ marginTop: 40 }} />
          ) : posts.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 60, gap: 14 }}>
              <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr, alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={28} color={C.purple} />
              </View>
              <Text style={{ color: C.textMid, fontSize: 16, fontWeight: '600' }}>אין פוסטים עדיין</Text>
              <Text style={{ color: C.textSub, fontSize: 13, textAlign: 'center' }}>
                צור פוסט בטאב יצירה ולחץ "שמור פוסט"
              </Text>
            </View>
          ) : (
            posts.map((post) => (
              <PostCard key={post._id} post={post} onDelete={handleDelete} />
            ))
          )}

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
