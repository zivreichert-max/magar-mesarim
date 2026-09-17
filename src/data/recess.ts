// Data for the election-recess sekira (סקירה — תקופת פגרת הבחירות).
// MANUAL data file (like papers.ts) — weekly content updates edit this file
// only; the components render whatever is here. No docx pipeline.
//
// Inline markers inside text fields: **bold** and [label](url) for an in-text link.
// Link rule: only verified URLs. Missing links stay as plain text with a
// `// TODO:` comment next to the entry — never guess an address.
//
// TABS (17.9.2026 →): the Knesset is dissolved, so the sekira is organised by
// TOPIC, not by arena. SEKIRA_TABS below is the single source of truth for the
// tab strip, the print version, the intro carousel and the WhatsApp export —
// restoring a כנסת tab after the 26th Knesset convenes is a data edit here
// (add a tab entry with card blocks), not a code change.

export const RECESS_TITLE = 'סקירה';
export const RECESS_UPDATED = 'תקופת פגרת הבחירות · 17.9-3.10.2026 · עודכן 17.9.2026';

export const ELECTION_DAY = { year: 2026, month: 10, day: 27 };
export const ELECTION_LABEL = 'ימים ליום הבחירות · 27.10.2026';

export function daysToElection(): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(ELECTION_DAY.year, ELECTION_DAY.month - 1, ELECTION_DAY.day);
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
}

export interface RLink { label: string; url: string; }

export type TagKind = 'ok' | 'need' | 'frozen' | 'pending' | 'info';
export interface Tag { label: string; kind: TagKind; }

// todo: renders an orange [TODO קישור] chip — a source with no verified URL.
export interface RPara { head?: string; text: string; links?: RLink[]; muted?: boolean; todo?: boolean; }
// brief: hand-written one-to-two-line summary for the WhatsApp export — full
// sentences, never auto-truncated. Author it with every content update; an
// item without one appears in the message as its title only.
// dynamic: body is rendered by a component instead of `paras`
// ('plenumReady' = tier-1 list from src/data/plenumReady.ts + link to the calculator).
export interface RExpandable { summary: string; tag?: Tag; paras: RPara[]; brief?: string; dynamic?: 'plenumReady'; }
export interface RCard { title: string; tag?: Tag; paras: RPara[]; expandables?: RExpandable[]; brief?: string; }
export interface PermItem { text: string; cond?: string; }
export interface PermList { title: string; items: PermItem[]; }

export type SekiraBlock =
  | { type: 'card'; card: RCard }
  | { type: 'permGrid'; green: PermList; amber: PermList }
  | { type: 'expandable'; exp: RExpandable }
  | { type: 'courtTable' };

// heading/intro: shown on the intro-carousel slide for the tab. Omitted → the
// slide falls back to the tab label alone.
export interface SekiraTab {
  id: string;
  label: string;
  heading?: string;
  intro?: string;
  blocks: SekiraBlock[];
}

/* ─────────────── טאב 1 · בחירות ─────────────── */

const ELECTIONS_BLOCKS: SekiraBlock[] = [
  {
    type: 'card',
    card: {
      title: `23-24.9 · ועדת הבחירות המרכזית דנה בבקשות לפסילת רשימות ומועמדים`,
      paras: [],
      expandables: [
        {
          summary: 'הרחבה',
          paras: [
            { text: `ועדת הבחירות המרכזית, בראשות השופט נעם סולברג, תדון בבקשות לפסילת רשימות ומועמדים לכנסת ה-26 לפי סעיף 7א לחוק-יסוד: הכנסת.` },
            { text: `23.9: 09:00-20:30. 24.9: 09:00-17:00. הדיונים יועברו בפול של ערוץ הכנסת ובשידור חי בפלטפורמות הוועדה.` },
            { text: `לפי הדיווחים, בין הרשימות שנגדן הוגשו בקשות: רע"ם (שלוש בקשות נפרדות), עוצמה יהודית, הדמוקרטים, הציונות הדתית וזהות, בל"ד והרשימה המשותפת. בין המועמדים: ח"כ עופר כסיף ויו"ר בל"ד סאמי אבו שחאדה. חלק מהבקשות נמחקו על הסף. הרשימה המלאה של הבקשות שיידונו מתפרסמת באתר ועדת הבחירות.` },
            { text: `על החלטה לפסול רשימה ניתן לערער לבית המשפט העליון. פסילת מועמד טעונה אישור של בית המשפט העליון.` },
            {
              muted: true,
              head: 'סימוכין',
              text: '',
              links: [
                { label: 'אמס, 16.9.26', url: 'https://www.emess.co.il/radio/1929785' },
                { label: 'ישראל היום, 16.9.26', url: 'https://www.israelhayom.co.il/news/law/article/21430915' },
                { label: 'המכון הישראלי לדמוקרטיה', url: 'https://www.idi.org.il/articles/65951' },
              ],
            },
            // TODO קישור — פירוט הבקשות באתר ועדת הבחירות טרם פורסם ככתובת יציבה.
            { muted: true, text: `ועדת הבחירות, פירוט הבקשות`, todo: true },
          ],
        },
      ],
    },
  },
  {
    type: 'card',
    card: {
      title: `27.9 · ועדת הבחירות המרכזית: המועד לאישור הסופי של רשימות המועמדים`,
      brief: 'המועד שקבעה ועדת הבחירות המרכזית לאישור הסופי של רשימות המועמדים, לאחר בדיקת הרשימות ודיוני הפסילות.',
      paras: [
        {
          text: `המועד שקבעה ועדת הבחירות המרכזית לאישור הסופי של רשימות המועמדים, לאחר בדיקת הרשימות ודיוני הפסילות.`,
          links: [
            { label: 'דבר, 8.9.26', url: 'https://www.davar1.co.il/696375/' },
          ],
        },
      ],
    },
  },
  {
    type: 'expandable',
    exp: {
      summary: 'לוח הזמנים המבני של הפגרה — מתי הכנסת סגורה בפועל',
      brief: 'חגי תשרי בספטמבר ובאוקטובר — המשכן סגור ברוב התקופה.',
      paras: [
        {
          text: `**20–21.9** · יום כיפור · **25.9–3.10** · סוכות — משכן הכנסת סגור (בחול המועד: נושאים דחופים בהיתר חריג של יו"ר הכנסת).`,
        },
      ],
    },
  },
];

/* ─────────────── טאב 2 · כלכלה ─────────────── */

const ECONOMY_BLOCKS: SekiraBlock[] = [
  {
    type: 'card',
    card: {
      title: `23.9 · תחזית הביניים הכלכלית של ה-OECD`,
      brief: 'עדכון תחזיות הצמיחה והאינפלציה לכלכלה העולמית, למדינות ה-G20, לגוש האירו ולכלל ה-OECD.',
      paras: [
        {
          text: `עדכון תחזיות הצמיחה והאינפלציה לכלכלה העולמית, למדינות ה-G20, לגוש האירו ולכלל ה-OECD. דוח הביניים מפרסם תחזיות למדינות ה-G20 ולסיכומים האזוריים בלבד, ולכן ישראל אינה מופיעה בו בנפרד.`,
          links: [
            { label: 'OECD', url: 'https://www.oecd.org/en/events/2026/09/launch-oecd-interim-economic-outlook.html' },
          ],
        },
      ],
    },
  },
  {
    type: 'card',
    card: {
      title: `29.9 · מדד החדשנות העולמי 2026 של WIPO`,
      brief: 'WIPO תפרסם את Global Innovation Index 2026, המשווה את ביצועי החדשנות של כ-140 כלכלות, ובהן ישראל.',
      paras: [
        {
          text: `WIPO תפרסם את Global Innovation Index 2026, המשווה את ביצועי החדשנות של כ-140 כלכלות, ובהן ישראל. אירוע ההשקה: 14:30-16:30 שעון ישראל.`,
          links: [
            { label: 'WIPO', url: 'https://www.wipo.int/en/web/global-innovation-index/w/news/2026/save-the-date-gii-2026' },
          ],
        },
      ],
    },
  },
];

/* ─────────────── טאב 3 · חינוך ─────────────── */

const EDUCATION_BLOCKS: SekiraBlock[] = [
  {
    type: 'card',
    card: {
      title: `20.9-3.10 · רצף חופשת יום כיפור וסוכות במערכת החינוך: שבועיים בלי לימודים, מתוכם 8 ימי עבודה מלאים במשק`,
      paras: [],
      expandables: [
        {
          summary: 'הרחבה',
          paras: [
            { text: `מערכת החינוך סגורה ברצף מ-20.9 עד 3.10. בתוך התקופה יש 8 ימי עבודה מלאים במשק שבהם אין לימודים: שלושת ימי הגשר בין יום כיפור לסוכות (22-24.9) וחמשת ימי חול המועד (27.9-1.10).` },
            { text: `20.9, ערב יום כיפור: אין לימודים. זהו יום עבודה, ובמקומות עבודה רבים נהוג בו יום מקוצר מכוח הסכם קיבוצי, צו הרחבה או נוהג.` },
            { text: `21.9, יום כיפור: חג ושבתון, יום חופש משותף להורים ולילדים.` },
            { text: `22-24.9, ימי הגשר: אין לימודים; ימי עבודה רגילים במשק.` },
            { text: `25-26.9, ערב סוכות וסוכות: שישי ושבת.` },
            { text: `27.9-1.10, חול המועד: אין לימודים. לפי חוקי העבודה אלה ימי עבודה רגילים; בחלק ממקומות העבודה חלים הסדרים מיטיבים או חופשה מרוכזת.` },
            { text: `2-3.10, הושענא רבה ושמחת תורה: שישי ושבת.` },
            { text: `4.10: חזרה ללימודים בגנים, ביסודי ובחטיבות הביניים. בחטיבות העליונות אסרו חג הוא יום חופשה, והלימודים מתחדשים ב-5.10.` },
            {
              muted: true,
              head: 'סימוכין',
              text: '',
              links: [
                { label: 'משרד החינוך, מהלך שנת הלימודים תשפ"ז', url: 'https://parents.education.gov.il/gov-education/vacations-camps-leisure/schedule' },
                { label: 'ynet, לוח החופשות', url: 'https://www.ynet.co.il/wellness/article/rkzzvy4dt' },
                { label: 'mako, לוח החופשות תשפ"ז', url: 'https://www.mako.co.il/home-family-kids/Article-df5ebe37893f281026.htm' },
                { label: 'כל זכות, זכותון עובדים בחגים', url: 'https://www.kolzchut.org.il/he/%D7%96%D7%9B%D7%95%D7%AA%D7%95%D7%9F_%D7%A2%D7%95%D7%91%D7%93%D7%99%D7%9D_%D7%91%D7%97%D7%92%D7%99%D7%9D' },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    type: 'card',
    card: {
      title: `29.9 · Education at a Glance 2026 של ה-OECD, בדגש על המחסור במורים`,
      brief: 'הדוח ההשוואתי השנתי של ה-OECD על מערכות החינוך במדינות הארגון, ובהן ישראל.',
      paras: [
        {
          text: `הדוח ההשוואתי השנתי של ה-OECD על מערכות החינוך במדינות הארגון, ובהן ישראל. הפוקוס השנה: המחסור במורים והשפעתו על הכיתות.`,
          links: [
            { label: 'OECD', url: 'https://www.oecd.org/en/events/2026/09/education-at-a-glance-2026.html' },
          ],
        },
      ],
    },
  },
];

/* ─────────────── טאב 4 · גיאופוליטי ─────────────── */

const GEO_BLOCKS: SekiraBlock[] = [
  {
    type: 'card',
    card: {
      title: `22-28.9 · שבוע הנאומים בעצרת הכללית של האו"ם`,
      paras: [],
      expandables: [
        {
          summary: 'הרחבה',
          paras: [
            { text: `הדיון הכללי של המושב ה-81 של העצרת הכללית מתקיים בניו יורק ב-22-26.9 וב-28.9. לשכת ראש הממשלה הודיעה ב-14.9 שנתניהו ימריא לנאום בעצרת, ולפי הדיווח הוא צפוי לשוב לפני סוכות. טרם ידוע מה המועד הספציפי שבו נתניהו צפוי לנאום.` },
            {
              muted: true,
              head: 'סימוכין',
              text: '',
              links: [
                { label: 'האו"ם, נשיאות העצרת הכללית', url: 'https://www.un.org/pga/81/event/general-debate-of-the-eighty-first-session-of-the-general-assembly/' },
                { label: 'i24NEWS, 14.9.26', url: 'https://www.i24news.tv/he/news/news/diplomacy/artc-aed554c6' },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    type: 'card',
    card: {
      title: `29.9 · כינוס רם-דרג באו"ם לציון היום הבינלאומי לחיסול מוחלט של נשק גרעיני`,
      brief: 'כינוס רם-דרג של העצרת הכללית לציון היום הבינלאומי לחיסול מוחלט של נשק גרעיני.',
      paras: [
        {
          text: `כינוס רם-דרג של העצרת הכללית לציון היום הבינלאומי לחיסול מוחלט של נשק גרעיני, לפי לוח הכינוסים הזמני של המושב ה-81.`,
          links: [
            { label: 'האו"ם, כינוסים רמי-דרג במושב ה-81', url: 'https://www.un.org/en/ga/81/meetings/' },
          ],
        },
      ],
    },
  },
];

/* ─────────────── טאב 5 · בג"ץ ─────────────── */

export const COURT_INTRO = `שני הליכים על השולחן:`;

// brief: hand-written WhatsApp summary — full sentences, never auto-truncated.
export interface CourtRow { law: string; status: Tag; legal: string; date: string; links?: RLink[]; brief?: string; }

// TODO: דפי התיקים בבג"ץ (net-המשפט) — כשיהיו מספרי בג"ץ/קישורים, להוסיף לכל שורה.
export const COURT_ROWS: CourtRow[] = [
  {
    law: `עתירת ההעברות התקציביות בפגרה - עמותת חדו"ש וח"כ נעמה לזימי נ' יו"ר ועדת הכספים, יו"ר הכנסת ומשרד האוצר`,
    brief: 'ב-24.8 ניתן צו על תנאי; כ-409 מיליון ש"ח בכספים קואליציוניים נותרו מוקפאים, והתקציבים הדחופים הוחרגו. דיון ב-24.9.',
    status: { label: 'מוקפא חלקית', kind: 'frozen' },
    legal: `ב-24.8 הוציא ההרכב (מינץ, כבוב, רונן) צו על תנאי, ויו"ר הכנסת, יו"ר ועדת הכספים ומשרד האוצר נדרשו לנמק מדוע לא יבוטלו ההעברות שאושרו ב-4.8. כ-409 מיליון ש"ח בכספים קואליציוניים נותרו מוקפאים בצו ביניים עד להכרעה. תקציבים שהוגדרו דחופים, ובהם החזרים לרשויות המקומיות עבור "בית הספר של החופש הגדול" ושיקום יישובי הצפון והדרום, הוחרגו מההקפאה. תצהירי התשובה נדרשו עד 10.9.`,
    date: '24.9: דיון בעתירה',
    links: [
      { label: 'דבר, 24.8.26', url: 'https://www.davar1.co.il/694431/' },
    ],
  },
  {
    law: `העתירות להקמת ועדת חקירה ממלכתית לאירועי 7 באוקטובר - התנועה לאיכות השלטון, מועצת אוקטובר ואחרים`,
    brief: 'ב-19.8 הודיעה היועמ"שית שוועדת חקירה ממלכתית היא הכלי המתאים, אך הציעה להותיר את ההחלטה לממשלה הבאה; העותרים מתנגדים.',
    status: { label: 'עתירות תלויות', kind: 'pending' },
    legal: `ב-19.8 הגישה היועצת המשפטית לממשלה את תגובתה לבג"ץ. היא שבה והדגישה כי ועדת חקירה ממלכתית היא הכלי המשפטי המתאים והייעודי לחקירת אירועי 7 באוקטובר והמלחמה, בשל עצמאותה המקצועית וניתוקה מהדרג הפוליטי. לצד זאת, ולנוכח הלכות האיפוק והריסון החלות על ממשלה יוצאת בתקופת בחירות, הציעה לאפשר לממשלה הבאה להידרש לנושא ולקבל בו החלטה, ולהגיש הודעה מעדכנת סמוך לכינונה. העותרים מתנגדים ועומדים על עתירתם.`,
    date: 'ללא מועד קבוע',
    links: [
      { label: 'ynet, 19.8.26', url: 'https://www.ynet.co.il/news/article/rjb34jqwzx' },
    ],
  },
];

// הרחבות המוצגות מתחת לטבלה, ברכיב ה-expandable הרגיל של הסקירה.
export const COURT_EXPANDABLES: RExpandable[] = [
  {
    summary: 'עתירת ההעברות התקציביות בפגרה - הרחבה',
    paras: [
      {
        text: `עם היציאה לפגרה ב-18.7 נקבע כי ועדות הכנסת מתכנסות רק באישור מראש של ועדת ההסכמות. לוועדת הכספים ניתן חריג אחד: דיון אחד בהעברות תקציביות במהלך השבועיים הראשונים של הפגרה. הדיון התקיים ב-29.7, נמשך כעשר שעות, והסתיים בלי שכל הפניות הובאו להצבעה.`,
      },
      {
        text: `ב-4.8 כונסה הוועדה בשנית, בניגוד לעמדת האופוזיציה. יו"ר הוועדה הודיע כי קיבל את אישור יו"ר הכנסת לכינוס מכוח סעיף 112(ב) לתקנון, המאפשר ליו"ר להתיר ישיבת ועדה בפגרה ב"מקרים מיוחדים". לפי העתירה, חברי האופוזיציה ביקשו לראות את ההחלטה הכתובה ואת הנימוקים לכל אחת מהפניות ולא קיבלו החלטה מפורטת. הזימון נשלח בפחות מ-48 שעות מראש במקום ארבעה ימים, וללא סדר יום מפורט.`,
      },
      {
        text: `באותה ישיבה אושרו חמישה מקבצי פניות - למשרד החינוך, למשרד ההתיישבות ולמשרד לשירותי דת. בתוך אותן פניות נכללו זה לצד זה סעיפים שהוצגו כדחופים - תשלומי שכר, התחייבויות לספקים, הוצאות תפעול וסכומים שנדרשים לקראת פתיחת שנת הלימודים - וסעיפים קואליציוניים: מוסדות תורניים, חינוך חרדי ודתי, החטיבה להתיישבות, גרעינים משימתיים, תרבות יהודית ופעילויות ביהודה ושומרון. למחרת, ב-5.8, הוציא השופט אלכס שטיין צו ארעי שהקפיא את ביצוע ההעברות, למעט פנייה נפרדת להוצאות חירום אזרחיות שאושרה ללא התנגדות.`,
      },
      {
        text: `לפי העתירה ונתוני משרד האוצר, בישיבת 4.8 אושרו העברות בהיקף של כ-2 מיליארד ש"ח, ומתוכם כ-408 מיליון ש"ח מסומנים ככספים קואליציוניים. העותרות מוסיפות 54 מיליון ש"ח לתקצוב גננות בחינוך המוכר שאינו רשמי, שלטענתן מקורם בהסכם קואליציוני אף שלא סומנו ככאלה - ובסך הכול כ-462 מיליון ש"ח.`,
      },
      {
        text: `השאלה שעמדה במרכז הדיון היא הכריכה בין השניים: אם בתוך הפניות יש רכיבים דחופים ורכיבים שאינם עומדים בהגדרת "מקרה מיוחד", מדוע לא לפצל ביניהם. עמדת שר האוצר הייתה שאין לבצע הפרדה וההכרעה תינתן ביחס לכלל הפניות כמקשה אחת. בית המשפט לא קיבל עמדה זו וחייב את האוצר להגיש את הסעיפים הדחופים בנפרד.`,
      },
      {
        text: `עדכון 24.8: בית המשפט קיבל את בקשת העותרות להחריג מההקפאה את התקציבים הדחופים, והכספים הקואליציוניים נותרו מוקפאים. נקבע שאם המדינה תטען לדחיפות של כספים נוספים, תוכל להגיש בקשה מתאימה.`,
      },
    ],
  },
];

/* ─────────────── רשימת הטאבים ─────────────── */

export const SEKIRA_TABS: SekiraTab[] = [
  { id: 'elections', label: 'בחירות', blocks: ELECTIONS_BLOCKS },
  { id: 'economy', label: 'כלכלה', blocks: ECONOMY_BLOCKS },
  { id: 'education', label: 'חינוך', blocks: EDUCATION_BLOCKS },
  { id: 'geo', label: 'גיאופוליטי', blocks: GEO_BLOCKS },
  { id: 'court', label: 'בג"ץ', blocks: [{ type: 'courtTable' }] },
];

// Deep-link map for the לו"ז arena headers ("לסקירה המלאה ←"). The schedule
// still groups by arena (knesset/gov/court/events) while the sekira is grouped
// by topic, so only בג"ץ has a one-to-one target; an arena with no entry here
// simply shows no link.
export const ARENA_TO_SEKIRA_TAB: Record<string, string> = {
  court: 'court',
};

/* ─────────────── מקורות (תחתית העמוד) ─────────────── */

export interface SourceRef { text: string; url?: string; }

export const SOURCES: SourceRef[] = [
  { text: `החלטת ועדת הכנסת בדבר פעילות הכנסת בפגרת הבחירות לכנסת ה-26 (17.7.2026, סימוכין 2026-115247)`, url: '/docs/knesset-committee-recess-decision-17-07-2026.pdf' },
  { text: `מכתב היועצת המשפטית לממשלה למזכיר הממשלה, "קבלת החלטות על ידי הממשלה והשרים בתקופת בחירות" (17.7.2026, מס' 004-99-2026-017760)`, url: '/docs/agc-election-period-letter-17-07-2026.pdf' },
  { text: 'הודעת דוברות הכנסת על הסדרי הפגרה', url: 'https://ch10.co.il/news/1087541/' },
];
