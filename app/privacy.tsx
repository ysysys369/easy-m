import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { TERMS_URL } from '@/config/appConfig';

const C = {
  bg:      '#0a0a0a',
  text:    '#e4e4e7',
  mid:     '#a1a1aa',
  sub:     '#71717a',
  purple:  '#7C3AED',
  border:  'rgba(63,63,70,0.50)',
};

const SECTIONS = [
  {
    title: '1. מידע שאנו אוספים',
    body:
      'אנו אוספים מידע שאתה מספק בעת יצירת חשבון, כגון כתובת דואר אלקטרוני ופרטי העסק שלך. ' +
      'בנוסף, אנו אוספים מידע שנוצר בעת השימוש בשירות, כולל פוסטים שנוצרו, העדפות עיצוב, ' +
      'ונתוני שימוש כלליים כדי לשפר את החוויה שלך.',
  },
  {
    title: '2. כיצד אנו משתמשים במידע',
    body:
      'המידע שאנו אוספים משמש למטרות הבאות:\n' +
      '• הפעלת השירות ויצירת תוכן שיווקי מותאם אישית לעסק שלך\n' +
      '• שיפור האפליקציה ופיתוח פיצ\'רים חדשים\n' +
      '• שליחת עדכונים ותקשורת שירותית רלוונטית\n' +
      '• ניתוח נתוני שימוש כלליים לצרכי אופטימיזציה',
  },
  {
    title: '3. שיתוף מידע עם צדדים שלישיים',
    body:
      'אנו לא מוכרים, מסחרים או מעבירים את פרטיך האישיים לצדדים שלישיים ללא הסכמתך, ' +
      'למעט ספקי שירות שאנו עובדים איתם לצורך הפעלת האפליקציה (כגון ספקי ענן ובינה מלאכותית). ' +
      'ספקים אלה מחויבים בחוזה לשמור על סודיות המידע ולא לעשות בו שימוש למטרות אחרות.',
  },
  {
    title: '4. אבטחת מידע',
    body:
      'אנו נוקטים באמצעי אבטחה סבירים להגנה על המידע שלך, ' +
      'כולל הצפנה ואחסון מאובטח. עם זאת, אין מערכת אבטחה מושלמת, ' +
      'ואיננו יכולים להבטיח אבטחה מוחלטת של המידע.',
  },
  {
    title: '5. שמירת מידע',
    body:
      'אנו שומרים את המידע שלך כל עוד חשבונך פעיל, ' +
      'או כפי שנדרש לצורך מתן השירות. ' +
      'בעת מחיקת חשבונך, נמחק את המידע האישי שלך ממערכותינו בהתאם למדיניות זו.',
  },
  {
    title: '6. זכויותיך',
    body:
      'יש לך הזכות לגשת למידע האישי שלך, לתקן אותו, או לבקש את מחיקתו. ' +
      'תוכל למחוק את חשבונך בכל עת מתוך הגדרות האפליקציה. ' +
      'לבקשות נוספות או שאלות הקשורות לפרטיות, ניתן לפנות אלינו בכתובת: privacy@easy-m.app',
  },
  {
    title: '7. שינויים במדיניות',
    body:
      'אנו עשויים לעדכן מדיניות פרטיות זו מעת לעת. ' +
      'שינויים מהותיים יפורסמו באפליקציה לפחות 14 ימים לפני כניסתם לתוקף. ' +
      'המשך השימוש בשירות לאחר מועד כניסתם לתוקף של השינויים מהווה הסכמה למדיניות המעודכנת.',
  },
  {
    title: '8. צור קשר',
    body:
      'לשאלות או בקשות הנוגעות למדיניות פרטיות זו, ניתן לפנות אלינו:\n' +
      'Easy-M\n' +
      'דואר אלקטרוני: privacy@easy-m.app',
  },
];

export default function PrivacyPolicyPage() {
  const openTerms = async () => {
    try {
      const canOpen = await Linking.canOpenURL(TERMS_URL);
      if (!canOpen) throw new Error('Cannot open terms URL');
      await Linking.openURL(TERMS_URL);
    } catch {
      Alert.alert('שגיאה', 'לא הצלחנו לפתוח את המסמך. נסה שוב בעוד רגע.');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 56,
        paddingBottom: 80,
        maxWidth: 700,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      {/* Logo + header */}
      <View style={{ marginBottom: 40 }}>
        <Text
          style={{
            color: C.purple,
            fontSize: 13,
            fontWeight: '700',
            textAlign: 'right',
            letterSpacing: 1.5,
            marginBottom: 10,
          }}
        >
          EASY-M
        </Text>
        <Text
          style={{
            color: '#fff',
            fontSize: 34,
            fontWeight: '800',
            textAlign: 'right',
            marginBottom: 10,
          }}
        >
          מדיניות פרטיות
        </Text>
        <Text style={{ color: C.sub, fontSize: 14, textAlign: 'right' }}>
          עדכון אחרון: יוני 2025
        </Text>
      </View>

      {/* Intro */}
      <View
        style={{
          backgroundColor: '#111114',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: C.border,
          padding: 20,
          marginBottom: 36,
        }}
      >
        <Text style={{ color: C.mid, fontSize: 15, lineHeight: 26, textAlign: 'right' }}>
          ברוכים הבאים ל-Easy-M. אנו מכבדים את פרטיותך ומחויבים להגן על המידע האישי שלך.
          מדיניות זו מסבירה אילו נתונים אנו אוספים, כיצד אנו משתמשים בהם, וכיצד אנו שומרים עליהם.
        </Text>
      </View>

      {/* Sections */}
      {SECTIONS.map((section, i) => (
        <View key={i} style={{ marginBottom: 32 }}>
          <Text
            style={{
              color: '#fff',
              fontSize: 17,
              fontWeight: '700',
              textAlign: 'right',
              marginBottom: 10,
            }}
          >
            {section.title}
          </Text>
          <View
            style={{
              height: 1,
              backgroundColor: C.border,
              marginBottom: 14,
            }}
          />
          <Text
            style={{
              color: C.mid,
              fontSize: 15,
              lineHeight: 26,
              textAlign: 'right',
            }}
          >
            {section.body}
          </Text>
        </View>
      ))}

      {/* Footer */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: C.border,
          paddingTop: 24,
          marginTop: 8,
        }}
      >
        <Text style={{ color: C.sub, fontSize: 13, textAlign: 'right' }}>
          © {new Date().getFullYear()} Easy-M. כל הזכויות שמורות.
        </Text>
        <Text
          style={{
            color: C.purple,
            fontSize: 13,
            textAlign: 'right',
            marginTop: 6,
          }}
          onPress={openTerms}
        >
          תנאי שימוש ← Google Docs
        </Text>
      </View>
    </ScrollView>
  );
}
