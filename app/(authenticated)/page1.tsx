import { useMutation, useQuery } from 'convex/react';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  CalendarDays,
  Copy,
  Download,
  Image as ImageIcon,
  LayoutDashboard,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Share as NativeShare,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoTopLeft } from '@/components/LogoTopLeft';
import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { position, rtl } from '@/lib/rtl';

const C = {
  bg: '#0a0a0a',
  card: '#111114',
  cardSoft: '#16161a',
  purple: '#7C3AED',
  purpleLight: '#a78bfa',
  purpleBdr: 'rgba(124,58,237,0.34)',
  purpleFaint: 'rgba(124,58,237,0.12)',
  border: 'rgba(63,63,70,0.55)',
  textSub: '#52525b',
  textMid: '#a1a1aa',
  textSoft: '#d4d4d8',
  red: '#f87171',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_WARNING_DAYS = 7;
const POST_RETENTION_DAYS = 30;
const POST_RETENTION_MS = POST_RETENTION_DAYS * DAY_MS;

type Post = Doc<'posts'> & {
  captionText?: string;
  imageUrl?: string;
  retentionExpiresAt?: number;
};

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(ts));
}

function captionFor(post: Post): string {
  return post.captionText ?? post.content;
}

function generationLabel(mode?: 'auto' | 'manual'): string | null {
  if (mode === 'auto') return 'אוטומטי';
  if (mode === 'manual') return 'ידני';
  return null;
}

function postImageUri(post: Post): string | undefined {
  return post.imageUri || post.imageUrl;
}

function getPostExpiresAt(post: Post): number {
  return post.retentionExpiresAt ?? post.createdAt + POST_RETENTION_MS;
}

function isMonthCloseToEnding(now = new Date()): boolean {
  const nextMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  ).getTime();
  return nextMonthStart - now.getTime() <= RETENTION_WARNING_DAYS * DAY_MS;
}

function hasExpiringPost(posts: Post[], now = Date.now()): boolean {
  return posts.some((post) => {
    const msUntilExpiry = getPostExpiresAt(post) - now;
    return msUntilExpiry > 0 && msUntilExpiry <= RETENTION_WARNING_DAYS * DAY_MS;
  });
}

function shouldShowRetentionWarning(posts: Post[] | undefined): boolean {
  if (!posts?.length) return false;
  return isMonthCloseToEnding() || hasExpiringPost(posts);
}

function RetentionWarningBanner() {
  return (
    <View
      style={{
        backgroundColor: C.purpleFaint,
        borderColor: C.purpleBdr,
        borderWidth: 1,
        borderRadius: 18,
        padding: 16,
        marginBottom: 18,
        flexDirection: rtl.flexDirection,
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          backgroundColor: 'rgba(124,58,237,0.20)',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Text style={{ fontSize: 17 }}>✨</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: '#fff',
            fontSize: 15,
            fontWeight: '900',
            textAlign: 'right',
            writingDirection: 'rtl',
            marginBottom: 5,
          }}
        >
          החודש עומד להתחלף
        </Text>
        <Text
          style={{
            color: C.textSoft,
            fontSize: 13,
            lineHeight: 20,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          אם עדיין לא שמרת את הפוסטים שלך, זה הזמן לשמור אותם. בתחילת חודש חדש הפוסטים הישנים יימחקו.
        </Text>
      </View>
    </View>
  );
}

function PostImagePreview({
  post,
  accessibilityLabel,
  fill = false,
}: {
  post: Post;
  accessibilityLabel: string;
  fill?: boolean;
}) {
  const uri = postImageUri(post);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const baseStyle = fill
    ? { width: '100%' as const, height: '100%' as const }
    : { width: '100%' as const, aspectRatio: 1 };

  if (!uri || failed) {
    return (
      <View
        style={{
          ...baseStyle,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#050505',
          padding: 16,
        }}
      >
        <ImageIcon size={28} color={C.textSub} />
        <Text
          style={{
            color: C.textMid,
            fontSize: 13,
            fontWeight: '700',
            textAlign: 'center',
            writingDirection: 'rtl',
            marginTop: 8,
          }}
        >
          התמונה לא נטענה
        </Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      source={{ uri }}
      style={baseStyle}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

async function prepareImageUri(uri?: string): Promise<string | null> {
  if (!uri) return null;
  if (/^https?:\/\//i.test(uri)) {
    const target = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}easy_m_post_${Date.now()}.png`;
    const downloaded = await FileSystem.downloadAsync(uri, target);
    return downloaded.uri;
  }

  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? uri : null;
}

async function copyTextToClipboardOrShare(text: string): Promise<void> {
  const navigatorWithClipboard = globalThis.navigator as
    | { clipboard?: { writeText?: (value: string) => Promise<void> } }
    | undefined;

  if (navigatorWithClipboard?.clipboard?.writeText) {
    await navigatorWithClipboard.clipboard.writeText(text);
    return;
  }

  await NativeShare.share({ message: text });
}

function buildVariationTopic(post: Post): string {
  const caption = captionFor(post).replace(/\s+/g, ' ').trim().slice(0, 650);
  return [
    'צור וריאציה חדשה לפוסט הזה.',
    'שמור על אותו עסק ואותו כיוון שיווקי, אבל אל תעתיק את הפוסט.',
    'שנה סגנון, פריסה, ניסוח וקונספט ויזואלי כדי שירגיש כמו גרסה חדשה.',
    post.businessName ? `שם העסק: ${post.businessName}` : '',
    post.businessType ? `סוג העסק / מטרה משוערת: ${post.businessType}` : '',
    `הפוסט המקורי להשראה: ${caption}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function ActionButton({
  icon,
  label,
  onPress,
  danger = false,
  loading = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  const color = danger ? C.red : C.purpleLight;
  return (
    <Pressable
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 46,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: danger ? 'rgba(248,113,113,0.28)' : C.purpleBdr,
        backgroundColor: danger ? 'rgba(248,113,113,0.10)' : C.purpleFaint,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        opacity: loading ? 0.65 : 1,
      }}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : icon}
      <Text numberOfLines={1} style={{ color, fontSize: 11, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function PostCard({
  post,
  onOpen,
  onSharePost,
  onSaveGallery,
  onCopyText,
  onShareImageOnly,
  onShareImageText,
  onVariation,
  onDelete,
  busyAction,
}: {
  post: Post;
  onOpen: (post: Post) => void;
  onSharePost: (post: Post) => void;
  onSaveGallery: (post: Post) => void;
  onCopyText: (post: Post) => void;
  onShareImageOnly: (post: Post) => void;
  onShareImageText: (post: Post) => void;
  onVariation: (post: Post) => void;
  onDelete: (post: Post) => void;
  busyAction: string | null;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const caption = captionFor(post);
  const modeLabel = generationLabel(post.generationMode);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 11,
      bounciness: 4,
    }).start();
  }, [anim]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <Pressable
        accessible={true}
        accessibilityLabel="פתח פוסט מלא"
        accessibilityRole="button"
        onPress={() => onOpen(post)}
        style={{
          backgroundColor: C.card,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: C.purpleBdr,
          overflow: 'hidden',
          marginBottom: 18,
          shadowColor: C.purple,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.22,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <View style={{ backgroundColor: '#050505', aspectRatio: 1, width: '100%' }}>
          <PostImagePreview
            post={post}
            accessibilityLabel="תמונת הפוסט"
            fill
          />
          <View style={{
            position: 'absolute',
            top: 12,
            ...position.start(12),
            flexDirection: rtl.flexDirection,
            gap: 8,
          }}>
            <View style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.62)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
            }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' }}>
                {formatDate(post.createdAt)}
              </Text>
            </View>
          </View>
          <View style={{
            position: 'absolute',
            bottom: 12,
            ...position.start(12),
            flexDirection: rtl.flexDirection,
            gap: 8,
          }}>
            <View style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: 'rgba(124,58,237,0.82)',
            }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>צפייה מלאה</Text>
            </View>
          </View>
        </View>

        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: rtl.flexDirection, justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <View style={{ flexDirection: rtl.flexDirection, gap: 7, flexShrink: 0 }}>
              {modeLabel ? (
                <View style={{
                  borderRadius: 999,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  backgroundColor: C.purpleFaint,
                  borderWidth: 1,
                  borderColor: C.purpleBdr,
                }}>
                  <Text style={{ color: C.purpleLight, fontSize: 10, fontWeight: '800' }}>
                    {modeLabel}
                  </Text>
                </View>
              ) : null}
              {post.businessType ? (
                <View style={{
                  borderRadius: 999,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  backgroundColor: 'rgba(63,63,70,0.38)',
                  borderWidth: 1,
                  borderColor: C.border,
                }}>
                <Text numberOfLines={1} style={{ color: C.textMid, fontSize: 10, fontWeight: '800', maxWidth: 110, textAlign: 'right', writingDirection: 'rtl' }}>
                    {post.businessType}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={{ color: '#fff', fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', flex: 1 }}>
              {post.businessName || 'פוסט שיווקי'}
            </Text>
          </View>

          <Text numberOfLines={3} style={{ color: C.textSoft, fontSize: 14, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl', marginBottom: 14 }}>
            {caption}
          </Text>

          {busyAction?.endsWith(`:${post._id}`) ? (
            <Text style={{ color: C.purpleLight, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 }}>
              מכין את הפוסט לשיתוף...
            </Text>
          ) : null}

          <Pressable
            accessible={true}
            accessibilityLabel="שיתוף פוסט"
            accessibilityRole="button"
            disabled={Boolean(busyAction)}
            onPress={() => onSharePost(post)}
            style={{
              minHeight: 50,
              borderRadius: 16,
              backgroundColor: C.purple,
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 10,
              opacity: busyAction === `post:${post._id}` ? 0.7 : 1,
            }}
          >
            {busyAction === `post:${post._id}`
              ? <ActivityIndicator size="small" color="#fff" />
              : <Share2 size={17} color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>
              שיתוף פוסט
            </Text>
          </Pressable>

          <View style={{ flexDirection: rtl.flexDirection, gap: 8, marginBottom: 8 }}>
            <ActionButton
              icon={<Download size={15} color={C.purpleLight} />}
              label="שמור לגלריה"
              loading={busyAction === `save:${post._id}`}
              onPress={() => onSaveGallery(post)}
            />
            <ActionButton
              icon={<Copy size={15} color={C.purpleLight} />}
              label="העתק טקסט"
              loading={busyAction === `text:${post._id}`}
              onPress={() => onCopyText(post)}
            />
          </View>
          <View style={{ flexDirection: rtl.flexDirection, gap: 8, marginBottom: 8 }}>
            <ActionButton
              icon={<ImageIcon size={15} color={C.purpleLight} />}
              label="תמונה בלבד"
              loading={busyAction === `image:${post._id}`}
              onPress={() => onShareImageOnly(post)}
            />
            <ActionButton
              icon={<Share2 size={15} color={C.purpleLight} />}
              label="תמונה + טקסט"
              loading={busyAction === `both:${post._id}`}
              onPress={() => onShareImageText(post)}
            />
          </View>
          <View style={{ flexDirection: rtl.flexDirection, gap: 8 }}>
            <ActionButton
              icon={<RefreshCw size={15} color={C.purpleLight} />}
              label="וריאציה"
              onPress={() => onVariation(post)}
            />
            <ActionButton
              icon={<Trash2 size={15} color={C.red} />}
              label="מחק"
              danger
              onPress={() => onDelete(post)}
            />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function PostDetailModal({
  post,
  visible,
  onClose,
  onSharePost,
  onSaveGallery,
  onCopyText,
  onShareImageOnly,
  onShareImageText,
  onVariation,
  onDelete,
  busyAction,
}: {
  post: Post | null;
  visible: boolean;
  onClose: () => void;
  onSharePost: (post: Post) => void;
  onSaveGallery: (post: Post) => void;
  onCopyText: (post: Post) => void;
  onShareImageOnly: (post: Post) => void;
  onShareImageText: (post: Post) => void;
  onVariation: (post: Post) => void;
  onDelete: (post: Post) => void;
  busyAction: string | null;
}) {
  if (!post) return null;
  const caption = captionFor(post);
  const modeLabel = generationLabel(post.generationMode);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' }}>
        <View style={{
          maxHeight: '92%',
          backgroundColor: C.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderWidth: 1,
          borderColor: C.purpleBdr,
          overflow: 'hidden',
        }}>
          <View style={{
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 12,
            flexDirection: rtl.flexDirection,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <View style={{ flex: 1, alignItems: 'flex-end', marginEnd: 12 }}>
              <Text style={{ color: '#fff', fontSize: 19, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' }}>
                {post.businessName || 'פוסט שיווקי'}
              </Text>
              <Text style={{ color: C.textMid, fontSize: 12, textAlign: 'right', writingDirection: 'rtl', marginTop: 3 }}>
                {formatDate(post.createdAt)}
                {modeLabel ? ` · ${modeLabel}` : ''}
                {post.businessType ? ` · ${post.businessType}` : ''}
              </Text>
            </View>
            <Pressable
              accessible={true}
              accessibilityLabel="סגור"
              accessibilityRole="button"
              onPress={onClose}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: C.card,
                borderWidth: 1,
                borderColor: C.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} color="#fff" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            <View style={{
              borderRadius: 22,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: C.purpleBdr,
              backgroundColor: '#050505',
              marginBottom: 16,
            }}>
              <PostImagePreview
                post={post}
                accessibilityLabel="תצוגה גדולה של הפוסט"
              />
            </View>

            <View style={{
              backgroundColor: C.card,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: C.border,
              padding: 16,
              marginBottom: 14,
            }}>
              <Text style={{ color: C.purpleLight, fontSize: 12, fontWeight: '900', textAlign: 'right', marginBottom: 9 }}>
                כיתוב שיווקי
              </Text>
              <Text selectable style={{ color: '#fff', fontSize: 15, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' }}>
                {caption}
              </Text>
            </View>

            {busyAction?.endsWith(`:${post._id}`) ? (
              <Text style={{ color: C.purpleLight, fontSize: 13, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 }}>
                מכין את הפוסט לשיתוף...
              </Text>
            ) : null}

            <Pressable
              accessible={true}
              accessibilityLabel="שיתוף פוסט"
              accessibilityRole="button"
              disabled={Boolean(busyAction)}
              onPress={() => onSharePost(post)}
              style={{
                minHeight: 52,
                borderRadius: 17,
                backgroundColor: C.purple,
                flexDirection: rtl.flexDirection,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: 10,
                opacity: busyAction === `post:${post._id}` ? 0.7 : 1,
              }}
            >
              {busyAction === `post:${post._id}`
                ? <ActivityIndicator size="small" color="#fff" />
                : <Share2 size={18} color="#fff" />}
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>שיתוף פוסט</Text>
            </Pressable>

            <View style={{ flexDirection: rtl.flexDirection, gap: 8, marginBottom: 8 }}>
              <ActionButton
                icon={<Download size={16} color={C.purpleLight} />}
                label="שמור לגלריה"
                loading={busyAction === `save:${post._id}`}
                onPress={() => onSaveGallery(post)}
              />
              <ActionButton
                icon={<Copy size={16} color={C.purpleLight} />}
                label="העתק טקסט"
                loading={busyAction === `text:${post._id}`}
                onPress={() => onCopyText(post)}
              />
            </View>
            <View style={{ flexDirection: rtl.flexDirection, gap: 8, marginBottom: 8 }}>
              <ActionButton
                icon={<ImageIcon size={16} color={C.purpleLight} />}
                label="שתף תמונה בלבד"
                loading={busyAction === `image:${post._id}`}
                onPress={() => onShareImageOnly(post)}
              />
              <ActionButton
                icon={<Share2 size={16} color={C.purpleLight} />}
                label="שתף תמונה + טקסט"
                loading={busyAction === `both:${post._id}`}
                onPress={() => onShareImageText(post)}
              />
            </View>
            <View style={{ flexDirection: rtl.flexDirection, gap: 8 }}>
              <ActionButton
                icon={<RefreshCw size={16} color={C.purpleLight} />}
                label="צור וריאציה"
                onPress={() => onVariation(post)}
              />
              <ActionButton
                icon={<Trash2 size={16} color={C.red} />}
                label="מחק"
                danger
                onPress={() => onDelete(post)}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 72, paddingHorizontal: 24 }}>
      <View style={{
        width: 78,
        height: 78,
        borderRadius: 26,
        backgroundColor: C.purpleFaint,
        borderWidth: 1,
        borderColor: C.purpleBdr,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
      }}>
        <Sparkles size={32} color={C.purpleLight} />
      </View>
      <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>
        עדיין אין לך פוסטים
      </Text>
      <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 20 }}>
        צור את הפוסט הראשון שלך עם AI
      </Text>
      <Pressable
        accessible={true}
        accessibilityLabel="צור פוסט"
        accessibilityRole="button"
        onPress={onCreate}
        style={{
          backgroundColor: C.purple,
          borderRadius: 18,
          paddingHorizontal: 30,
          paddingVertical: 15,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          shadowColor: C.purple,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 16,
          elevation: 10,
        }}
      >
        <Sparkles size={17} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>צור פוסט</Text>
      </Pressable>
    </View>
  );
}

export default function PostsPage() {
  const router = useRouter();
  const posts = useQuery(api.posts.getUserPosts);
  const deletePost = useMutation(api.posts.deletePost);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const goCreate = () => router.push('/(authenticated)/create');

  const sharePostFile = async (
    post: Post,
    target: 'post' | 'image' | 'both',
  ): Promise<void> => {
    const caption = captionFor(post);
    const imageUri = await prepareImageUri(postImageUri(post));

    if ((target === 'post' || target === 'both') && imageUri) {
      try {
        await NativeShare.share({
          title: 'Easy-M',
          message: caption,
          url: imageUri,
        });
        return;
      } catch {
        // Fall through to expo-sharing, which is more reliable for image files
        // on many Android targets.
      }
    }

    const available = await Sharing.isAvailableAsync();
    if (imageUri && available) {
      await Sharing.shareAsync(imageUri, {
        mimeType: 'image/png',
        dialogTitle: target === 'image' ? 'שתף תמונה בלבד' : 'שיתוף פוסט',
        UTI: 'public.png',
      });
      if (target !== 'image') {
        Alert.alert('הקפשן לפוסט', caption, [{ text: 'סגור', style: 'cancel' }]);
      }
      return;
    }

    await NativeShare.share({ message: caption });
  };

  const handleSharePost = async (post: Post) => {
    if (busyAction) return;
    setBusyAction(`post:${post._id}`);
    try {
      await sharePostFile(post, 'post');
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשתף כרגע, נסה שוב');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveGallery = async (post: Post) => {
    if (busyAction) return;
    setBusyAction(`save:${post._id}`);
    try {
      const imageUri = await prepareImageUri(postImageUri(post));
      if (!imageUri || !FileSystem.documentDirectory) {
        Alert.alert('אין תמונה', 'לא נמצאה תמונה לשמירה.');
        return;
      }
      const dest = `${FileSystem.documentDirectory}easy_m_post_${post._id}_${Date.now()}.png`;
      await FileSystem.copyAsync({ from: imageUri, to: dest });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(dest, {
          mimeType: 'image/png',
          dialogTitle: 'שמור לגלריה',
          UTI: 'public.png',
        });
      } else {
        Alert.alert('התמונה נשמרה', 'התמונה נשמרה בקבצי האפליקציה.');
      }
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשמור את התמונה.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyText = async (post: Post) => {
    if (busyAction) return;
    setBusyAction(`text:${post._id}`);
    try {
      await copyTextToClipboardOrShare(captionFor(post));
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשתף כרגע, נסה שוב');
    } finally {
      setBusyAction(null);
    }
  };

  const handleShareImageOnly = async (post: Post) => {
    if (busyAction) return;
    setBusyAction(`image:${post._id}`);
    try {
      await sharePostFile(post, 'image');
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשתף כרגע, נסה שוב');
    } finally {
      setBusyAction(null);
    }
  };

  const handleShareImageText = async (post: Post) => {
    if (busyAction) return;
    setBusyAction(`both:${post._id}`);
    try {
      await sharePostFile(post, 'both');
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לשתף כרגע, נסה שוב');
    } finally {
      setBusyAction(null);
    }
  };

  const handleVariation = (post: Post) => {
    setSelectedPost(null);
    router.push({
      pathname: '/(authenticated)/create',
      params: { topic: buildVariationTopic(post) },
    });
  };

  const handleDelete = (post: Post) => {
    Alert.alert('מחיקת פוסט', 'האם למחוק את הפוסט הזה?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost({ id: post._id as Id<'posts'> });
            if (selectedPost?._id === post._id) setSelectedPost(null);
          } catch {
            Alert.alert('שגיאה', 'לא הצלחנו למחוק. נסה שנית.');
          }
        },
      },
    ]);
  };

  const visiblePosts = posts as Post[] | undefined;
  const postCount = visiblePosts?.length ?? 0;
  const showRetentionWarning = shouldShowRetentionWarning(visiblePosts);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <LogoTopLeft />
      <PostDetailModal
        post={selectedPost}
        visible={Boolean(selectedPost)}
        onClose={() => setSelectedPost(null)}
        onSharePost={handleSharePost}
        onSaveGallery={handleSaveGallery}
        onCopyText={handleCopyText}
        onShareImageOnly={handleShareImageOnly}
        onShareImageText={handleShareImageText}
        onVariation={handleVariation}
        onDelete={handleDelete}
        busyAction={busyAction}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 80 }}>
          <View style={{ flexDirection: rtl.flexDirection, alignItems: 'center', justifyContent: 'flex-start', gap: 10, marginBottom: 8 }}>
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: C.purpleFaint,
              borderWidth: 1,
              borderColor: C.purpleBdr,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <LayoutDashboard size={22} color={C.purpleLight} />
            </View>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'right' }}>
              הפוסטים שלך
            </Text>
            <View style={{
              minWidth: 40,
              height: 40,
              borderRadius: 999,
              backgroundColor: C.card,
              borderWidth: 1,
              borderColor: C.border,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 12,
            }}>
              <Text style={{ color: C.purpleLight, fontSize: 13, fontWeight: '900' }}>
                {postCount}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: rtl.flexDirection, alignItems: 'center', justifyContent: 'flex-start', gap: 6, marginBottom: 22 }}>
            <CalendarDays size={14} color={C.textMid} />
            <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'right' }}>
              גלריית הפוסטים השמורים והמודעות שיצרת
            </Text>
          </View>

          {showRetentionWarning ? <RetentionWarningBanner /> : null}

          {visiblePosts === undefined ? (
            <View style={{ alignItems: 'center', paddingVertical: 70 }}>
              <ActivityIndicator color={C.purpleLight} size="large" />
              <Text style={{ color: C.textMid, marginTop: 14, fontSize: 13 }}>
                טוען את הגלריה...
              </Text>
            </View>
          ) : visiblePosts.length === 0 ? (
            <EmptyState onCreate={goCreate} />
          ) : (
            <View>
              {visiblePosts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  busyAction={busyAction}
                  onOpen={setSelectedPost}
                  onSharePost={handleSharePost}
                  onSaveGallery={handleSaveGallery}
                  onCopyText={handleCopyText}
                  onShareImageOnly={handleShareImageOnly}
                  onShareImageText={handleShareImageText}
                  onVariation={handleVariation}
                  onDelete={handleDelete}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {visiblePosts !== undefined && visiblePosts.length > 0 ? (
        <View style={{ position: 'absolute', width: '100%', paddingHorizontal: 20, bottom: 150 }}>
          <Pressable
            accessible={true}
            accessibilityLabel="צור פוסט"
            accessibilityRole="button"
            onPress={goCreate}
            style={{
              backgroundColor: C.purple,
              borderRadius: 18,
              paddingVertical: 16,
              flexDirection: rtl.flexDirection,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.55,
              shadowRadius: 18,
              elevation: 12,
            }}
          >
            <Sparkles size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>צור פוסט חדש</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
