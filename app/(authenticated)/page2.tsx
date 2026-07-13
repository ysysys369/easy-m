import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  Copy,
  FileText,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { rtl } from '@/lib/rtl';

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
  red:         '#ef4444',
};

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

// ─── Post card ─────────────────────────────────────────────────────────────
type Post = {
  _id: Id<'posts'>;
  content: string;
  captionText?: string;
  imageUri?: string;
  businessName?: string;
  businessType?: string;
  generationMode?: 'auto' | 'manual';
  createdAt: number;
};

function PostCard({
  post,
  onDelete,
  onDuplicate,
}: {
  post: Post;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const captionText = post.captionText ?? post.content;

  return (
    <View
      style={{
        backgroundColor: C.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: C.purpleBdr,
        overflow: 'hidden',
        shadowColor: C.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 5,
      }}
    >
      {/* Top row: image + content */}
      <View style={{ flexDirection: rtl.flexDirection, gap: 12, padding: 12 }}>
        {/* Image (right side in RTL) */}
        {post.imageUri ? (
          <Image
            source={{ uri: post.imageUri }}
            style={{
              width: 72, height: 72, borderRadius: 12,
              borderWidth: 1, borderColor: C.border,
            }}
            resizeMode="cover"
          />
        ) : (
          <View style={{
            width: 72, height: 72, borderRadius: 12,
            backgroundColor: C.cardInner, borderWidth: 1, borderColor: C.border,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <FileText size={22} color={C.textMid} />
          </View>
        )}

        {/* Right column: business + caption + date */}
        <View style={{ flex: 1, justifyContent: 'space-between', minHeight: 72 }}>
          {post.businessName ? (
            <Text
              numberOfLines={1}
              style={{ color: '#e4e4e7', fontSize: 12, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl', marginBottom: 6 }}
            >
              {post.businessName}
            </Text>
          ) : null}

          {/* Caption preview - max 2 lines */}
          <Text
            numberOfLines={2}
            style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' }}
          >
            {captionText}
          </Text>

          {/* Meta row: date */}
          <View style={{ flexDirection: rtl.flexDirection, alignItems: 'center', justifyContent: 'flex-start', marginTop: 6 }}>
            <Text style={{ color: C.textMid, fontSize: 11 }}>
              {formatDate(post.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 12 }} />

      {/* Actions row */}
      <View style={{ flexDirection: rtl.flexDirection, justifyContent: 'space-around', paddingVertical: 8 }}>
        <Pressable
          onPress={onDuplicate}
          style={{ flex: 1, flexDirection: rtl.flexDirection, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}
        >
          <Copy size={14} color={C.textLight} />
          <Text style={{ color: C.textLight, fontSize: 12, fontWeight: '700' }}>שכפל</Text>
        </Pressable>

        <View style={{ width: 1, backgroundColor: C.border, marginVertical: 4 }} />

        <Pressable
          onPress={onDelete}
          style={{ flex: 1, flexDirection: rtl.flexDirection, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}
        >
          <Trash2 size={14} color={C.red} />
          <Text style={{ color: C.red, fontSize: 12, fontWeight: '700' }}>מחק</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24, gap: 14 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 24,
        backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <FileText size={30} color={C.purple} />
      </View>
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl' }}>
        עדיין לא יצרת פוסטים
      </Text>
      <Text style={{ color: C.textMid, fontSize: 13, textAlign: 'center', writingDirection: 'rtl', lineHeight: 20 }}>
        צור את הפוסט הראשון שלך{'\n'}ותתחיל לנהל את התוכן שלך
      </Text>
      <Pressable
        onPress={onCreate}
        style={{
          marginTop: 6,
          backgroundColor: C.purple,
          paddingHorizontal: 28, paddingVertical: 14,
          borderRadius: 14,
          flexDirection: 'row', alignItems: 'center', gap: 8,
          shadowColor: C.purple, shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
        }}
      >
        <Sparkles size={16} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>צור פוסט ראשון</Text>
      </Pressable>
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────
export default function Page2() {
  const router = useRouter();

  const posts = useQuery(api.posts.getUserPosts);
  const deletePost = useMutation(api.posts.deletePost);
  const createPost = useMutation(api.posts.createPost);

  const goCreate = () => router.push('/(authenticated)/create');

  const handleDelete = (id: Id<'posts'>) =>
    Alert.alert('מחיקת פוסט', 'האם אתה בטוח שברצונך למחוק?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          try { await deletePost({ id }); }
          catch { Alert.alert('שגיאה', 'לא הצלחנו למחוק'); }
        },
      },
    ]);

  const handleDuplicate = async (post: Post) => {
    try {
      await createPost({
        content:        post.captionText ?? post.content,
        captionText:    post.captionText ?? post.content,
        imageUri:       post.imageUri,
        businessName:   post.businessName,
        businessType:   post.businessType,
        generationMode: post.generationMode,
      });
      Alert.alert('שוכפל ✅', 'הפוסט שוכפל');
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשכפל את הפוסט');
    }
  };

  const allPosts = posts ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

          {/* ─── Header ─── */}
          <View style={{
            flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
            marginBottom: 24,
          }}>
            <View style={{ flex: 1, marginEnd: 12 }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'left', marginBottom: 6 }}>
                הפוסטים שלך
              </Text>
              <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'left' }}>
                נהל את התוכן שלך במקום אחד
              </Text>
            </View>
          </View>

          {/* ─── Posts list / loading / empty ─── */}
          {posts === undefined ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <ActivityIndicator size="large" color={C.purple} />
            </View>
          ) : allPosts.length === 0 ? (
            <EmptyState onCreate={goCreate} />
          ) : (
            <View style={{ gap: 14 }}>
              {allPosts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post as Post}
                  onDelete={() => handleDelete(post._id)}
                  onDuplicate={() => handleDuplicate(post as Post)}
                />
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      {/* ─── Floating CTA — only when there are posts ─── */}
      {allPosts.length > 0 ? (
        <View style={{
          position: 'absolute',
          bottom: 150, // above the fixed tab bar
          width: '100%',
          paddingHorizontal: 20,
        }}>
          <Pressable
            onPress={goCreate}
            style={{
              backgroundColor: C.purple,
              borderRadius: 18,
              paddingVertical: 16,
              flexDirection: rtl.flexDirection, alignItems: 'center', justifyContent: 'center', gap: 8,
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.55,
              shadowRadius: 18,
              elevation: 12,
            }}
          >
            <Plus size={18} color="#fff" strokeWidth={3} />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
              צור פוסט חדש
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
