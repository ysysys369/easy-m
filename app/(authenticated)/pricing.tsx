import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Check,
  Crown,
  Flame,
  Sparkles,
} from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rtl } from '@/lib/rtl';

const C = {
  bg:          '#0a0a0a',
  card:        '#111114',
  cardInner:   '#16161a',
  purple:      '#7C3AED',
  purpleBdr:   'rgba(124,58,237,0.35)',
  purpleFaint: 'rgba(124,58,237,0.12)',
  purpleLight: '#a78bfa',
  border:      'rgba(63,63,70,0.55)',
  textSub:     '#52525b',
  textMid:     '#a1a1aa',
  orange:      '#f97316',
  orangeFaint: 'rgba(249,115,22,0.14)',
  orangeBdr:   'rgba(249,115,22,0.45)',
};

const BENEFITS = [
  '3 פוסטים שיווקיים בשבוע',
  'תמונות ברמה גבוהה',
  'טקסט שיווקי מוכן בעברית',
  'התאמה מלאה לעסק שלך',
  'מוכן לפרסום תוך שניות',
];

export default function PricingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

          {/* ── Back button ── */}
          <Pressable
            onPress={() => router.back()}
            style={{ flexDirection: rtl.flexDirection, alignItems: 'center', gap: 6, marginBottom: 28, alignSelf: 'flex-end' }}
          >
            <Text style={{ color: C.textMid, fontSize: 14 }}>חזרה</Text>
            <ArrowRight size={16} color={C.textMid} />
          </Pressable>

          {/* ── Crown header ── */}
          <View style={{ alignItems: 'flex-end', marginBottom: 24 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 20,
              backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              shadowColor: C.purple, shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
            }}>
              <Crown size={28} color={C.purple} />
            </View>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch', marginBottom: 8 }}>
              שדרג את העסק שלך
            </Text>
            <Text style={{ color: C.textMid, fontSize: 14, textAlign: 'right', writingDirection: 'rtl', alignSelf: 'stretch', lineHeight: 22 }}>
              תוכן שיווקי מקצועי{'\n'}שמוכן לפרסום מיד
            </Text>
          </View>

          {/* ── 🔥 First post free banner ── */}
          <View style={{
            flexDirection: rtl.flexDirection,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: C.orangeFaint,
            borderWidth: 1,
            borderColor: C.orangeBdr,
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginBottom: 18,
            shadowColor: C.orange,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
          }}>
            <Text style={{ color: '#fed7aa', fontSize: 14, fontWeight: '700' }}>
              הפוסט הראשון חינם
            </Text>
            <Flame size={16} color={C.orange} fill={C.orange} />
          </View>

          {/* ── Main plan card ── */}
          <View style={{
            backgroundColor: C.card,
            borderRadius: 24,
            borderWidth: 2,
            borderColor: C.purple,
            overflow: 'hidden',
            shadowColor: C.purple,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.45,
            shadowRadius: 24,
            elevation: 14,
            marginBottom: 16,
          }}>

            <View style={{ padding: 24 }}>
              {/* Card heading */}
              <View style={{ flexDirection: rtl.flexDirection, alignItems: 'center', justifyContent: 'flex-start', gap: 10, marginBottom: 22 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 12,
                  backgroundColor: C.purpleFaint, borderWidth: 1, borderColor: C.purpleBdr,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={16} color={C.purple} />
                </View>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' }}>
                  מה מקבלים במנוי:
                </Text>
              </View>

              {/* Benefits list */}
              <View style={{ gap: 14, marginBottom: 24 }}>
                {BENEFITS.map((benefit) => (
                  <View key={benefit} style={{
                    flexDirection: rtl.flexDirection,
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 12,
                  }}>
                    <Text style={{
                      color: '#e4e4e7', fontSize: 15, fontWeight: '500',
                      textAlign: 'right', writingDirection: 'rtl', flex: 1, lineHeight: 22,
                    }}>
                      {benefit}
                    </Text>
                    <View style={{
                      width: 26, height: 26, borderRadius: 8,
                      backgroundColor: C.purple,
                      alignItems: 'center', justifyContent: 'center',
                      shadowColor: C.purple, shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.45, shadowRadius: 6, elevation: 3,
                    }}>
                      <Check size={14} color="#fff" strokeWidth={3} />
                    </View>
                  </View>
                ))}
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: C.border, marginBottom: 20 }} />

              {/* Price block (subtle, value-first) */}
              <View style={{ alignItems: 'center', marginBottom: 22 }}>
                <View style={{ flexDirection: rtl.flexDirection, alignItems: 'baseline', gap: 6 }}>
                  <Text style={{ color: C.textMid, fontSize: 14, fontWeight: '600' }}>לחודש</Text>
                  <Text style={{ color: '#fff', fontSize: 42, fontWeight: '800', letterSpacing: -1 }}>
                    ₪59
                  </Text>
                </View>
              </View>

              {/* CTA */}
              <Pressable
                onPress={() => router.push('/(authenticated)/paywall')}
                style={{
                  backgroundColor: C.purple,
                  borderRadius: 16,
                  paddingVertical: 17,
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: C.purple, shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.55, shadowRadius: 14, elevation: 10,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>
                  התחל מנוי
                </Text>
              </Pressable>
            </View>
          </View>

          {/* ── Footer note ── */}
          <Text style={{ color: C.textSub, fontSize: 12, textAlign: 'right', writingDirection: 'rtl', marginTop: 4 }}>
            ביטול בכל עת · ללא התחייבות
          </Text>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
