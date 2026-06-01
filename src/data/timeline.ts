export interface TimelineEvent {
  title: string;
  dateStart: string;
  dateEnd?: string;
  category: string;
  importance: string;
  detail?: string;
  url?: string;
}

export const TIMELINE: TimelineEvent[] = [
  {
    title: `ביטול הטבות בתחבורה ציבורית וארנונה למשתמטים`,
    dateStart: `2026-05-31`,
    category: `בג"ץ`,
    importance: `ודאי`,
    detail: `לאחר שהממשלה נמנעה מביצוע צעדים לאכיפת חובת הגיוס על משתמטים, ב26 באפריל הורה בית המשפט העליון על שורת צעדים מעשיים בעניין, שכוללים ביטול הטבות שעשויות להגיע לאלפי שקלים בחודש למשפחה. בין הצעדים - הנחה לנוסעי תחבורה ציבורית (תחבורה ואוצר) וארנונה (פנים)`,
    url: `https://z.calcalist.co.il/assets/pickerul/e59b8df8-cb7f-4f83-a6cf-58c58b6558aa.pdf`,
  },
  {
    title: `סיום כהונה ראש המוסד - דדי ברנע`,
    dateStart: `2026-06-01`,
    category: `פוליטי`,
    importance: `ודאי`,
  },
  {
    title: `הצבעה על מבקר המדינה`,
    dateStart: `2026-06-03`,
    category: `פוליטי`,
    importance: `ודאי`,
    detail: `הודעה על מועד כשלושה שבועות מראש, 1 ביוני המועד המאוחר ביותר`,
  },
  {
    title: `פיזור הכנסת עבור בחירות ב1 בספטמבר`,
    dateStart: `2026-06-03`,
    category: `פוליטי`,
    importance: `הערכה`,
    detail: `הודעה על פיזור הכנסת 90 יום לפני מועד הבחירות`,
  },
  {
    title: `פיזור הכנסת עבור בחירות ב15 בספטמבר`,
    dateStart: `2026-06-03`,
    category: `פוליטי`,
    importance: `הערכה`,
    detail: `הודעה על פיזור הכנסת 90 יום לפני מועד הבחירות`,
  },
  {
    title: `פסגת G7`,
    dateStart: `2026-06-15`,
    category: `גיאופוליטי`,
    importance: `ודאי`,
  },
  {
    title: `פד - ריבית`,
    dateStart: `2026-06-17`,
    category: `כלכלי`,
    importance: `ודאי`,
  },
  {
    title: `שנתיים לפסיקת בג"ץ - גיוס חרדים`,
    dateStart: `2026-06-25`,
    category: `פוליטי`,
    importance: `ודאי`,
  },
  {
    title: `סיום קדנציה מבקר המדינה`,
    dateStart: `2026-07-01`,
    category: `פוליטי`,
    importance: `ודאי`,
  },
  {
    title: `חקיקת בחירות`,
    dateStart: `2026-07-01`,
    dateEnd: `2026-08-01`,
    category: `פוליטי`,
    importance: `הערכה`,
  },
  {
    title: `בנק ישראל — ריבית + תחזית Q3`,
    dateStart: `2026-07-06`,
    category: `כלכלי`,
    importance: `ודאי`,
    detail: `תאריך מאושר; תחזית רבעונית Q3`,
  },
  {
    title: `פגררת בית המשפט`,
    dateStart: `2026-07-20`,
    category: `בג"ץ`,
    importance: `הערכה`,
  },
  {
    title: `בחירות לכנסת ה-26`,
    dateStart: `2026-09-08`,
    dateEnd: `2026-10-20`,
    category: `בחירות`,
    importance: `הערכה`,
    detail: `פרקי הזמן אליהם דובר במהלך חקיקת פיזור הכנסת בקריאה ראשונה - המועד החוקי האחרון הוא ה27.10.2027`,
  },
  {
    title: `עצרת האו"ם — שבוע הנאומים`,
    dateStart: `2026-09-21`,
    dateEnd: `2026-09-25`,
    category: `גיאופוליטי`,
    importance: `ודאי`,
    detail: `ישראל בדרך כלל מציגה עמדות; שנה קריטית עם תיק ICC`,
  },
  {
    title: `סוכות`,
    dateStart: `2026-09-25`,
    dateEnd: `2026-10-02`,
    category: `חגים`,
    importance: `ודאי`,
  },
  {
    title: `מועד הגשת רשימות מועמדים לכנסת`,
    dateStart: `2026-09-27`,
    category: `בחירות`,
    importance: ``,
  },
  {
    title: `מינוי ועדות אזוריות (סעיף 19)`,
    dateStart: `2026-09-27`,
    category: `בחירות`,
    importance: `הערכה`,
    detail: `לכול המאוחר 52 יום לפני הבחירות`,
  },
  {
    title: `בנק ישראל — ריבית + תחזית Q4`,
    dateStart: `2026-10-01`,
    dateEnd: `2026-10-31`,
    category: `כלכלי`,
    importance: `הערכה`,
    detail: `הערכה; תאריך מדויק טרם פורסם`,
  },
  {
    title: `השביעי באוקטובר`,
    dateStart: `2026-10-07`,
    category: `פוליטי`,
    importance: `ודאי`,
  },
];
