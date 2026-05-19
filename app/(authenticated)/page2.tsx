import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  CalendarDays,
  Copy,
  FileText,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { useState } from 'react';
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

type PostStatus = 'draft' | 'scheduled' | 'published';

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
  green:       '#10b981',
  greenFaint:  'rgba(16,185,129,0.14)',
  greenBdr:    'rgba(16,185,129,0.35)',
  gray:        '#a1a1aa',
  grayFaint:   'rgba(113,113,122,0.18)',
  grayBdr:     'rgba(113,113,122,0.40)',
  red:         '#ef4444',
  redFaint:    'rgba(239,68,68,0.10)',
  redBdr:      'rgba(239,68,68,0.30)',
};

const TABS: { label: string; status: PostStatus }[] = [
  { label: 'טיוטות',    status: 'draft'     },
  { label: 'מתוזמנים', status: 'scheduled' },
  { label: 'פורסמו',    status: 'published' },
];

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PostStatus }) {
  const cfg = {
    draft:     { label: 'טיוטה',  bg: C.grayFaint,   bdr: C.grayBdr,   text: C.gray         },
    scheduled: { label: 'מתוזמן', bg: C.purpleFaint, bdr: C.purpleBdr, text: C.purpleLight  },
    published: { label: 'פורסם',  bg: C.greenFaint,  bdr: C.greenBdr,  text: C.green        },
  }[status];
  return (
    <View style={{
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
      backgroundColor: cfg.bg, borderWidth: 1, borderColor: cfg.bdr,
    }}>
      <Text style={{ color: cfg.text, fontSize: 10, fontWeight: '700', letterSpacing: 0.3 }}>
        {cfg.label}
      </Text>
    </View>
  );
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
  status: PostStatus;
  createdAt: number;
};

function PostCard({
  post,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  post: Post;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const status = (post.status ?? 'draft') as PostStatus;
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
      {/* Top row: image + content + status */}
      <View style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
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

        {/* Right column: badge + business + caption */}
        <View style={{ flex: 1, justifyContent: 'space-between', minHeight: 72 }}>
          {/* Top row: status + business name */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <StatusBadge status={status} />
            {post.businessName && (
              <Text
                numberOfLines={1}
                style={{ color: '#e4e4e7', fontSize: 12, fontWeight: '700', textAlign: 'right', flexShrink: 1, marginLeft: 8 }}
              >
                {post.businessName}
              </Text>
            )}
          </View>

          {/* Caption preview - max 2 lines */}
          <Text
            numberOfLines={2}
            style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 19, textAlign: 'right' }}
          >
            {captionText}
          </Text>

          {/* Meta row: date + (time if scheduled) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            {status === 'scheduled' && (
              <Text style={{ color: C.purpleLight, fontSize: 11, fontWeight: '700' }}>
                {formatTime(post.createdAt)}
              </Text>
            )}
            <Text style={{ color: C.textMid, fontSize: 11 }}>
              {formatDate(post.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: C.border, marginHorizontal: 12 }} />

      {/* Actions row */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8 }}>
        <Pressable
          onPress={onEdit}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}
        >
          <Pencil size={14} color={C.purpleLight} />
          <Text style={{ color: C.purpleLight, fontSize: 12, fontWeight: '700' }}>ערוך</Text>
        </Pressable>

        <View style={{ width: 1, backgroundColor: C.border, marginVertical: 4 }} />

        <Pressable
          onPress={onDuplicate}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}
        >
          <Copy size={14} color={C.textLight} />
          <Text style={{ color: C.textLight, fontSize: 12, fontWeight: '700' }}>שכפל</Text>
        </Pressable>

        <View style={{ width: 1, backgroundColor: C.border, marginVertical: 4 }} />

        <Pressable
          onPress={onDelete}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 }}
        >
          <Trash2 size={14} color={C.red} />
          <Text style={{ color: C.red, fontSize: 12, fontWeight: '700' }}>מחק</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────
function EmptyState({ activeTab, onCreate }: { activeTab: PostStatus; onCreate: () => void }) {
  const messages = {
    draft:     'אין לך פוסטים עדיין',
    scheduled: 'אין פוסטים מתוזמנים',
    published: 'עדיין לא פרסמת פוסטים',
  };
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24, gap: 14 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 24,
        backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <FileText size={30} color={C.purple} />
      </View>
      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', textAlign: 'center' }}>
        {messages[activeTab]}
      </Text>
      <Text style={{ color: C.textMid, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
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
  const [activeTab, setActiveTab] = useState<PostStatus>('draft');

  const posts = useQuery(api.posts.getUserPosts);
  const deletePost = useMutation(api.posts.deletePost);
  const createPost = useMutation(api.posts.createPost);

  const safeStatus = (s?: string): PostStatus =>
    s === 'scheduled' || s === 'published' ? s : 'draft';

  const filtered = (posts ?? []).filter((p) => safeStatus(p.status) === activeTab);

  const counts = {
    draft:     (posts ?? []).filter((p) => safeStatus(p.status) === 'draft').length,
    scheduled: (posts ?? []).filter((p) => safeStatus(p.status) === 'scheduled').length,
    published: (posts ?? []).filter((p) => safeStatus(p.status) === 'published').length,
  };

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
      Alert.alert('שוכפל ✅', 'הפוסט שוכפל לטיוטות');
      setActiveTab('draft');
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשכפל את הפוסט');
    }
  };

  const handleEdit = () =>
    Alert.alert('עריכת פוסט', 'עריכת פוסטים תהיה זמינה בקרוב ✨');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

          {/* ─── Header ─── */}
          <View style={{
            flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
            marginBottom: 24,
          }}>
            {/* Calendar icon (top-left) */}
            <Pressable
              onPress={() => Alert.alert('בקרוב', 'תצוגת לוח שנה תהיה זמינה בקרוב 📅')}
              style={{
                width: 40, height: 40, borderRadius: 14,
                backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
                alignItems: 'center', justifyContent: 'center', marginTop: 6,
              }}
            >
              <CalendarDays size={18} color={C.textMid} />
            </Pressable>

            {/* Title block (right) */}
            <View style={{ alignItems: 'flex-end', flex: 1, marginLeft: 12 }}>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'right', marginBottom: 6 }}>
                הפוסטים שלך
              </Text>
              <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'right' }}>
                נהל, תזמן ופרסם תוכן בקלות
              </Text>
            </View>
          </View>

          {/* ─── Tabs ─── */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: C.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: C.border,
            padding: 4,
            marginBottom: 20,
          }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.status;
              const count = counts[tab.status];
              return (
                <Pressable
                  key={tab.status}
                  onPress={() => setActiveTab(tab.status)}
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    borderRadius: 12,
                    backgroundColor: isActive ? C.purpleFaint : 'transparent',
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={{
                    color: isActive ? C.purpleLight : C.textMid,
                    fontSize: 13,
                    fontWeight: isActive ? '800' : '600',
                  }}>
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View style={{
                      minWidth: 18, height: 18, borderRadius: 9,
                      backgroundColor: isActive ? C.purple : 'rgba(113,113,122,0.30)',
                      paddingHorizontal: 5,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                        {count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Active tab indicator (purple underline) */}
          <View style={{ flexDirection: 'row', marginBottom: 20, marginTop: -16 }}>
            {TABS.map((tab) => (
              <View key={tab.status} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{
                  height: 2, width: 32,
                  backgroundColor: activeTab === tab.status ? C.purple : 'transparent',
                  borderRadius: 1,
                }} />
              </View>
            ))}
          </View>

          {/* ─── Posts list / loading / empty ─── */}
          {posts === undefined ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <ActivityIndicator size="large" color={C.purple} />
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState activeTab={activeTab} onCreate={goCreate} />
          ) : (
            <View style={{ gap: 14 }}>
              {filtered.map((post) => (
                <PostCard
                  key={post._id}
                  post={post as Post}
                  onEdit={handleEdit}
                  onDelete={() => handleDelete(post._id)}
                  onDuplicate={() => handleDuplicate(post as Post)}
                />
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      {/* ─── Floating CTA ─── */}
      <View style={{
        position: 'absolute',
        bottom: 100, // above the floating tab bar
        left: 20, right: 20,
      }}>
        <Pressable
          onPress={goCreate}
          style={{
            backgroundColor: C.purple,
            borderRadius: 18,
            paddingVertical: 16,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
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
    </SafeAreaView>
  );
}
