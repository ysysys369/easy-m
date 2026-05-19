import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Building2,
  Camera,
  ChevronRight,
  Facebook,
  Globe,
  Heart,
  Image as ImageIcon,
  Instagram,
  MapPin,
  Pencil,
  Sparkles,
  Star,
  Tag,
  Target,
  Users,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';

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

type IconType = React.ComponentType<{ size: number; color: string }>;

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: IconType;
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: C.purpleFaint,
          borderWidth: 1,
          borderColor: C.purpleBdr,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={17} color={C.purple} />
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ color: C.textMid, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, marginBottom: 4 }}>
          {label}
        </Text>
        <Text selectable style={{ color: '#e4e4e7', fontSize: 14, lineHeight: 21, textAlign: 'right' }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: C.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: C.purpleBdr,
        paddingHorizontal: 18,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: C.purple,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      {children}
    </View>
  );
}

function SectionTitle({ title, icon: Icon }: { title: string; icon: IconType }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 10, marginTop: 6 }}>
      <Text style={{ color: C.textLight, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textAlign: 'right' }}>
        {title}
      </Text>
      <Icon size={14} color={C.purpleLight} />
    </View>
  );
}

export default function BusinessDetails() {
  const router = useRouter();
  const profile = useQuery(api.businessProfiles.getMyBusinessProfile);

  const goToEdit = () => router.push('/(authenticated)/business-profile');

  if (profile === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator size="large" color={C.purple} />
      </SafeAreaView>
    );
  }

  // No profile yet → show CTA to create
  if (!profile || !profile.businessName) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>
          <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginBottom: 30 }}>
            <Text style={{ color: C.textMid, fontSize: 14 }}>חזרה</Text>
            <ArrowRight size={16} color={C.textMid} />
          </Pressable>

          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 24,
              backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Building2 size={36} color={C.purple} />
            </View>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
              עדיין לא הוגדר פרופיל עסקי
            </Text>
            <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 12 }}>
              צור את פרופיל העסק שלך כדי{'\n'}לקבל פוסטים מותאמים אישית
            </Text>
            <Pressable
              onPress={goToEdit}
              style={{
                backgroundColor: C.purple, borderRadius: 16,
                paddingVertical: 16, paddingHorizontal: 36,
                flexDirection: 'row', alignItems: 'center', gap: 10,
                shadowColor: C.purple, shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.5, shadowRadius: 14, elevation: 8,
              }}
            >
              <Sparkles size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>צור פרופיל עסקי</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

          {/* Top bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: C.textMid, fontSize: 14 }}>חזרה</Text>
              <ArrowRight size={16} color={C.textMid} />
            </Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800' }}>פרטי העסק</Text>
              <View style={{
                width: 40, height: 40, borderRadius: 12,
                backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Building2 size={18} color={C.purple} />
              </View>
            </View>
          </View>

          {/* ── Logo & name header ── */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            {profile.logoUrl ? (
              <Image
                source={{ uri: profile.logoUrl }}
                style={{
                  width: 100, height: 100, borderRadius: 24,
                  borderWidth: 2, borderColor: C.purpleBdr, marginBottom: 12,
                }}
              />
            ) : (
              <View style={{
                width: 100, height: 100, borderRadius: 24,
                backgroundColor: C.purpleFaint, borderWidth: 2, borderColor: C.purpleBdr,
                borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Camera size={32} color={C.purple} />
              </View>
            )}
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
              {profile.businessName}
            </Text>
            {profile.businessType && (
              <Text style={{ color: C.purpleLight, fontSize: 13, fontWeight: '600', marginTop: 4 }}>
                {profile.businessType}
              </Text>
            )}
          </View>

          {/* ── Section 1: About the business ── */}
          <SectionTitle title="על העסק" icon={Building2} />
          <SectionCard>
            <Row icon={Tag}     label="שם העסק"        value={profile.businessName} />
            <Row icon={Building2} label="סוג העסק"     value={profile.businessType} />
            <Row icon={Sparkles} label="תיאור"          value={profile.description} />
            <Row icon={Star}    label="מה מיוחד"        value={profile.uniqueness} />
            <Row icon={Tag}     label="שירותים / מוצרים" value={profile.services} />
          </SectionCard>

          {/* ── Section 2: Marketing & audience ── */}
          <SectionTitle title="קהל ושיווק" icon={Target} />
          <SectionCard>
            <Row icon={Users}   label="קהל יעד"        value={profile.audience} />
            <Row icon={Heart}   label="סגנון שיווקי"   value={profile.style} />
            <Row icon={Target}  label="מטרת הפוסטים"   value={profile.goal} />
          </SectionCard>

          {/* ── Section 3: Location & online ── */}
          {(profile.city || profile.website || profile.socialInstagram || profile.socialFacebook) && (
            <>
              <SectionTitle title="מיקום ורשתות" icon={Globe} />
              <SectionCard>
                <Row icon={MapPin}    label="עיר / אזור"  value={profile.city} />
                <Row icon={Globe}     label="אתר"         value={profile.website} />
                <Row icon={Instagram} label="אינסטגרם"    value={profile.socialInstagram} />
                <Row icon={Facebook}  label="פייסבוק"     value={profile.socialFacebook} />
              </SectionCard>
            </>
          )}

          {/* ── Section 4: Business images ── */}
          {profile.images && profile.images.length > 0 && (
            <>
              <SectionTitle title="תמונות העסק" icon={ImageIcon} />
              <View style={{
                backgroundColor: C.card, borderRadius: 20,
                borderWidth: 1, borderColor: C.purpleBdr,
                padding: 14, marginBottom: 16,
              }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                  {profile.images.map((uri, i) => (
                    <Image
                      key={`${uri}-${i}`}
                      source={{ uri }}
                      style={{
                        width: 96, height: 96, borderRadius: 12,
                        borderWidth: 1, borderColor: C.border,
                      }}
                    />
                  ))}
                </View>
                <Text style={{ color: C.textMid, fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                  {profile.images.length} תמונות
                </Text>
              </View>
            </>
          )}

          {/* ── Edit button ── */}
          <Pressable
            onPress={goToEdit}
            style={{
              backgroundColor: C.purple,
              borderRadius: 18,
              paddingVertical: 16,
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              shadowColor: C.purple,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5,
              shadowRadius: 14,
              elevation: 8,
            }}
          >
            <Pencil size={17} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>ערוך פרטים</Text>
            <ChevronRight size={18} color="#fff" />
          </Pressable>

          <Text style={{ color: C.textSub, fontSize: 12, textAlign: 'center', marginTop: 12 }}>
            כל המידע משמש את ה-AI כדי לייצר פוסטים מותאמים אישית
          </Text>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
