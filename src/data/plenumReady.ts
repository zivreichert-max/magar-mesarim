// Data for the "מוכן למליאה" calculator — which mapped bills (judicial-overhaul
// / harmful-legislation mapping) can pass the plenum during the election recess.
// MANUAL data file — weekly updates replace the arrays below (statuses change if
// the plenum convenes during the recess). No code changes needed for updates.
// Source xlsx snapshot kept at data/מיפוי_חקיקה_לפי_הסטטוס_הרשמי_בכנסת_19-07-2026.xlsx.
//
// Scope: ONLY bills from the mapping (הפיכה משפטית, זכויות, פוליטיזציה, תקשורת
// וכו') — not all legislation pending in the Knesset.
//
// Link rule: only URLs present in the source data. Never invent addresses.

export const PLENUM_AS_OF = '19.7.2026';
export const PLENUM_SOURCE =
  'מיפוי חקיקה לפי הסטטוס הרשמי בכנסת, 19.7.2026 (על בסיס קובץ פורום המדענים + מאגר הכנסת)';

export interface PlenumBill {
  name: string;
  symbol: string;
  officialStatus: string;
  billType: 'פרטית' | 'ממשלתית';
  committee?: string;
  initiators?: string;
  category: string;
  meaning: string; // המשמעות לפי פורום המדענים, כלשונה — לא לשכתב
  note?: string;
  // Official committee-version title (tikkun number) — to be completed from the
  // bill's page on the Knesset legislation DB. Shown only when verified.
  // TODO: פ/3157/25 — ככל הנראה "תיקון מס' 12"; לא להציג לפני אימות מול הנוסח שהונח.
  officialSecondThirdTitle?: string;
  knessetUrl: string;
  mappingUrl: string;
}

const KNESSET_BILLS_URL = 'https://main.knesset.gov.il/apps/legislation/main/bills?KNS=25';
const MAPPING_URL = 'https://osf.io/9ewst/?view_only=479cc15ff81b40b799537c881ac0c391';

// מדרגה 1 — הונחו לקריאה שנייה ושלישית: עבירוֹת בכל רגע, ללא מסננת הסכמות.
export const READY_SECOND_THIRD: PlenumBill[] = [
  {
    name: `הצעת חוק המאבק בטרור (תיקון - הזדהות עם מבצע עבירת טרור מסוג המתה), התשפ"ג-2023`,
    symbol: `פ/3157/25`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה שנייה-שלישית`,
    billType: 'פרטית',
    committee: `ועדת חוקה חוק ומשפט`,
    initiators: `צבי סוכות`,
    category: `זכויות אדם ואזרח`,
    meaning: `להוסיף, לצד התמיכה וההזדהות עם מעשי טרור, גם את התמיכה וההזדהות עם מבצע פעולת טרור הכוללת את עבירות ההמתה.`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
  {
    name: `הצעת חוק לתיקון פקודת סדר הדין הפלילי (מעצר וחיפוש) (מס' 19) (חיפוש שלא לפי צו חיפוש), התשפ"ו-2026`,
    symbol: `מ/1956`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה שנייה-שלישית`,
    billType: 'ממשלתית',
    category: `זכויות אדם ואזרח`,
    meaning: `מעצר וחיפוש ללא צו בית משפט (מופנה כלפי ערבים)`,
    note: `ההצעה התקדמה מאז עדכון המיפוי מקריאה ראשונה לשלב המליאה לקריאה שנייה ושלישית.`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
  {
    name: `הצעת חוק זכויות הסטודנט (תיקון - הרחקת סטודנטים תומכי טרור ממוסד לימוד ופירוק תאים תומכי טרור), התשפ"ג-2023`,
    symbol: `פ/2368/25`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה שנייה-שלישית`,
    billType: 'פרטית',
    initiators: `לימור סון הר מלך`,
    category: `חינוך ואקדמיה`,
    meaning: `פיצלו את הצעת החוק: חוק 1 דן בשלילת זכאות לתואר והכרה בתואר שנרכש בחו"ל לסטודנטים שהניפו דגל מדינת אויב, כולל דגל הרשות הפלסטינית.  חוק 2 שקודם ב-25/2/25 דן ב:קביעת תקנונים ורגולציות לפעילות של תאי סטודנטים בקמפוסים בייחוד בכל הקשור להסתה ועידוד טרור: בעת הכנת הצעת החוק לקריאה הראשונה הוצע  להרחיב את ההוראה המחייבת התייחסות מפורשת  בתקנוני הפעילות הציבורית ולכלול בה גם התבטאויות  חמורות אחרות שלהן אופי דומה המהוות הסתה לגזענות  או לאלימות כמשמעותן בחוק העונשין  התשל"ז–.197 בהמשך הליכי החקיקה תבחן ועדת החינוך אם להרחיב  את ההוראה כאמור, בין השאר בהתבסס על נתונים בדבר  היקף התבטאויות כאמור ואופן הטיפול בהן במוסדות`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
  {
    name: `הצעת חוק השידור הציבור הישראלי (תיקון – דיווח שנתי לוועדת הכלכלה של הכנסת), התשפ"ג–2023`,
    symbol: `פ/3776/25`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה שנייה-שלישית`,
    billType: 'פרטית',
    committee: `ועדת הכלכלה`,
    initiators: `אריאל קלנר`,
    category: `תקשורת`,
    meaning: `מוצע לקבוע כי הדוחות הכספיים השנתיים והדוח השנתי על פעילותו של התאגיד יועברו לוועדת הכלכלה של הכנסת מדי שנה, עד יום ה-30 באפריל – חודש לאחר המועד האחרון להגשת הדוחות לשר התקשורת. עוד מוצע, לנוכח היקף פעילותו הרחב של התאגיד, השפעתו הרבה, תקציבו הגבוה יחסית ומספר העובדים הגדול יחסית המועסקים על ידו,  כי ועדת הכלכלה של הכנסת תקיים מדי שנה דיון בעיקרי הדוחות לאחר הגשתם בהשתתפותם של יושב ראש המועצה והמנהל הכללי של התאגיד.`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
];

// מדרגה 2 — הונחו לקריאה ראשונה: הממשלה יכולה להעבירן קריאה ראשונה בפגרה,
// אך ההכנה לקריאה שנייה-שלישית דורשת ועדה — וּועדה דורשת אישור ועדת ההסכמות.
export const AWAITING_FIRST: PlenumBill[] = [
  {
    name: `הצעת חוק ועדת חקירה ממלכתית-לאומית לאירועי טבח שמיני עצרת התשפ״ד (טבח 7 באוקטובר 2023), התשפ"ו-2025`,
    symbol: `פ/6380/25`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה ראשונה`,
    billType: 'פרטית',
    initiators: `אריאל קלנר`,
    category: `הפיכה משפטית`,
    meaning: `במקום ועדת חקירה ממלכתית שנבחרת על ידי נשיא ביהמ"ש העליון תקום ועדה פוליטית. סעיף 1 קובע כי הממשלה תקבע את נושאי החקירה של הועדה. הקמת ועדה בת 6 או 7 חברים. בשלב ראשון מנסים הליך בהסכמת חברי הכנסת ברוב של 80 חכים. לא מצליחים עוברים לשלב שני : יו"ר הכנסת ממנה 3 מהקואליציה. יו"ר האופוזיציה ממנה 3 מהאופוזיציה. אם לא ממנים תוך 14 יום יו"ר הכנסת ימנה את כולם.`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
  {
    name: `הצעת חוק-יסוד: השפיטה (תיקון - סמכויות שיפוט ותקנות סדרי דין באישור ועדה)`,
    symbol: `פ/435/25`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה ראשונה`,
    billType: 'פרטית',
    initiators: `שמחה רוטמן`,
    category: `הפיכה משפטית`,
    meaning: `פיקוח על מימוש הזכות לגישה לרשמי בתי משפט ודין אזרחי בידי ועדת חוקה חוק ומשפט`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
  {
    name: `הצעת חוק-יסוד: שכר נושאי משרה ברשויות השלטון (תיקוני חקיקה)`,
    symbol: `פ/5532/25`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה ראשונה`,
    billType: 'פרטית',
    initiators: `אביחי אברהם בוארון`,
    category: `הפיכה משפטית`,
    meaning: `במסגרת הצעת החוק-- להפחית את השכר של השופטים (ושיהיה פחות מהשכר של רה"מ)`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
  {
    name: `הצעת חוק המאבק בארגוני פשיעה (תיקון - הכרזה על ארגון פשיעה כארגון טרור), התשפ"ה-2025`,
    symbol: `פ/6158/25`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה ראשונה`,
    billType: 'פרטית',
    initiators: `צביקה פוגל`,
    category: `זכויות אדם ואזרח`,
    meaning: `השר לביטחון לאומי, באישור שר הביטחון, רשאי להכריז בצו על ארגון פשיעה כארגון טרור, בהתאם להוראת פרק ב' בחוק המאבק בטרור, ואז כל ההגבלות על תומכים בארגון טרור כולל הגבלת הצבעה וכדומה יכולו-- וזאת ללא פס"ד של ביהמ"ש.`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
  {
    name: `הצעת חוק העמותות (תיקון מס' 20) (עיצומים כספיים), התשפ"ו- 2025`,
    symbol: `מ/1917`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה ראשונה`,
    billType: 'ממשלתית',
    category: `זכויות אדם ואזרח`,
    meaning: `הפרה עמותה הוראה מההוראות לפי חוק זה או לפי חוק חובת גילוי לגבי מי שנתמך על ידי ישות מדינית זרה, רשאי הרשם להטיל עליה עיצום כספי.`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
  {
    name: `הצעת חוק לתיקון פקודת בתי הסוהר (שלילת ביקורים מאסירים ביטחוניים המשתייכים לארגון טרור המחזיק בשבויים ישראליים), התשפ"ד-2023`,
    symbol: `פ/4134/25`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה ראשונה`,
    billType: 'פרטית',
    initiators: `גלית דיסטל אטבריאן, קטי קטרין שטרית`,
    category: `זכויות אדם ואזרח`,
    meaning: `שלילת ביקורים לאסירים מארגונים המזיקים בשבויים ישראלים. הצעות חוק דומות הונחו מאז הכנסת ה - 17`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
  {
    name: `הצעת חוק החברות הממשלתיות (תיקון - כשירות מיוחדת), התשפ"ג-2022`,
    symbol: `פ/565/25`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה ראשונה`,
    billType: 'פרטית',
    committee: `ועדת החוקה, חוק ומשפט`,
    initiators: `ניסים ואטורי`,
    category: `פגיעה ופוליטיזציה במנהל הציבורי`,
    meaning: `כיום אסורה זיקה פוליטית לשר (עבור מועמד לדירקטריון) אלא בכישורים מיוחדים ובית המשפט מפרש זאת מאוד מאוד שמרני כלומר לא מאפשר. ההצעה מבקשת לבטל במקרה של כישורים מיוחדים את ההגבלה על זיקה לשר-- כלומר להרבות עוד מינויים פוליטיים.`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
  {
    name: `הצעת חוק השידור הציבורי הישראלי (תיקון - תקציב תאגיד השידור הישראלי), התשפ"ד-2024`,
    symbol: `פ/4736/25`,
    officialStatus: `הונחה על שולחן הכנסת לקריאה ראשונה`,
    billType: 'פרטית',
    committee: `ועדת הכלכלה`,
    initiators: `אביחי אברהם בוארון`,
    category: `תקשורת`,
    meaning: `בחינת תקציב התאגיד ואישור של הממשלה כל שנה! ניסיון להשתלט על התאגיד`,
    knessetUrl: KNESSET_BILLS_URL,
    mappingUrl: MAPPING_URL,
  },
];

// מדרגה 3 — כל שאר ההצעות במיפוי (דיון מוקדם / הכנה בוועדה / הוסרו / מוזגו):
// לא ניתן לקדמן ללא אישור ועדת ההסכמות. מוצג כמונה בלבד.
export const BLOCKED_FROZEN_COUNT = 416;

export const PLENUM_CATEGORIES = [
  'הפיכה משפטית',
  'זכויות אדם ואזרח',
  'חינוך ואקדמיה',
  'תקשורת',
  'פגיעה ופוליטיזציה במנהל הציבורי',
];
