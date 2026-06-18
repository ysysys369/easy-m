import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { PRIVACY_URL } from '@/config/appConfig';

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
    title: '1. קבלת התנאים',
    body:
      'בשימוש באפליקציית Easy-M ("השירות"), אתה מסכים לתנאי שימוש אלה. ' +
      'אם אינך מסכים לתנאים, אנא הימנע משימוש בשירות. ' +
      'תנאים אלה חלים על כל משתמשי השירות, לרבות מבקרים, משתמשים רשומים ומנויים.',
  },
  {
    title: '2. תיאור השירות',
    body:
      'Easy-M היא פלטפורמה לייצור תוכן שיווקי לעסקים קטנים ובינוניים, ' +
      'המשתמשת בטכנולוגיית בינה מלאכותית ליצירת פוסטים, תמונות וטקסטים שיווקיים. ' +
      'השירות מיועד לשימוש עסקי בלבד.',
  },
  {
    title: '3. חשבון משתמש',
    body:
      'כדי להשתמש בשירות, עליך ליצור חשבון ולספק פרטים מדויקים ועדכניים. ' +
      'אתה אחראי על שמירת סודיות פרטי הגישה לחשבונך ' +
      'ועל כל הפעילות שמתרחשת תחת חשבונך. ' +
      'עליך להודיע לנו מיידית על כל שימוש בלתי מורשה בחשבונך.',
  },
  {
    title: '4. תנאי תשלום ומנויים',
    body:
      'Easy-M מציעה מנוי בתשלום המעניק גישה לתכונות מתקדמות. ' +
      'התשלומים מעובדים דרך חנות האפליקציות (Apple App Store). ' +
      'החיוב מתבצע לפי המחזור שנבחר (חודשי / שנתי). ' +
      'ביטול מנוי יש לבצע דרך הגדרות חשבון ה-Apple שלך לפחות 24 שעות לפני סיום תקופת החיוב הנוכחית. ' +
      'לא ניתן לקבל החזר כספי עבור תקופות שימוש חלקיות.',
  },
  {
    title: '5. קניין רוחני',
    body:
      'Easy-M ותכניה (לוגו, עיצוב, קוד, טקסטים) הם קניינה הרוחני של החברה ומוגנים בזכויות יוצרים. ' +
      'התוכן שנוצר עבורך באמצעות השירות שייך לך, ' +
      'אך Easy-M שומרת לעצמה את הזכות לשימוש אנונימי בדוגמאות תוכן לצרכי שיפור המוצר.',
  },
  {
    title: '6. הגבלות שימוש',
    body:
      'אסור להשתמש בשירות למטרות הבאות:\n' +
      '• יצירת תוכן בלתי חוקי, פוגעני, מטעה או מפר זכויות יוצרים\n' +
      '• ניסיון לעקוף מנגנוני אבטחה או לגשת לנתונים של משתמשים אחרים\n' +
      '• שימוש אוטומטי בשירות (בוטים, סריפינג) ללא אישור מפורש מראש\n' +
      '• כל שימוש שעלול להזיק לשירות, למשתמשים אחרים, או לצדדים שלישיים',
  },
  {
    title: '7. הגבלת אחריות',
    body:
      'Easy-M מסופקת "כפי שהיא" (AS IS) ללא אחריות מפורשת או משתמעת. ' +
      'אנו לא נישא באחריות לנזקים עקיפים, מקריים או תוצאתיים הנובעים מהשימוש בשירות. ' +
      'אחריותנו הכוללת כלפיך לא תעלה על הסכום ששולם בעד השירות ב-12 החודשים שקדמו לתביעה.',
  },
  {
    title: '8. ביטול חשבון',
    body:
      'תוכל לבטל את חשבונך בכל עת מתוך הגדרות האפליקציה. ' +
      'עם ביטול החשבון, נמחק את נתוניך האישיים בהתאם למדיניות הפרטיות שלנו. ' +
      'ביטול החשבון אינו מבטל אוטומטית את המנוי — יש לבטלו בנפרד דרך Apple.',
  },
  {
    title: '9. שינויים בתנאים',
    body:
      'אנו עשויים לעדכן תנאים אלה מעת לעת. ' +
      'שינויים מהותיים יפורסמו באפליקציה לפחות 14 ימים לפני כניסתם לתוקף. ' +
      'המשך השימוש בשירות לאחר מועד כניסתם לתוקף של השינויים מהווה הסכמה לתנאים המעודכנים.',
  },
  {
    title: '10. דין חל וסמכות שיפוט',
    body:
      'תנאים אלה כפופים לדיני מדינת ישראל. ' +
      'כל מחלוקת הנוגעת לתנאים אלה תידון בבתי המשפט המוסמכים בישראל.',
  },
  {
    title: '11. יצירת קשר',
    body:
      'לשאלות הנוגעות לתנאי שימוש אלה, ניתן לפנות אלינו:\n' +
      'Easy-M\n' +
      'דואר אלקטרוני: support@easy-m.app',
  },
];

export default function TermsOfUsePage() {
  const openPrivacy = async () => {
    try {
      const canOpen = await Linking.canOpenURL(PRIVACY_URL);
      if (!canOpen) throw new Error('Cannot open privacy URL');
      await Linking.openURL(PRIVACY_URL);
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
          onPress={openPrivacy}
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
          תנאי שימוש
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
          ברוכים הבאים ל-Easy-M, הפלטפורמה לשיווק חכם לעסקים קטנים.
          אנא קראו תנאים אלה בעיון לפני השימוש בשירות.
          השימוש באפליקציה מהווה הסכמה מלאה לתנאים המפורטים להלן.
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
        >
          מדיניות פרטיות ← Google Docs
        </Text>
      </View>
    </ScrollView>
  );
}
