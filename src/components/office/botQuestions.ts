// Ready-made questions for בוט-נים (the organization's Knesset chatbot).
//
// The bot answers only from its own sources, so each question here is phrased
// to land on one of them: Knesset protocols, agenda motions / fast debates,
// cabinet decisions, the law book (incl. תקנון הכנסת and the basic laws), the
// plenary schedule, and the state-budget datasets (budget book, budgetary
// change requests, revenues). It has NO court rulings, State Comptroller
// reports or Attorney General documents — so nothing here asks for those.
//
// Questions are self-contained (the bot does not rely on earlier turns) and
// carry explicit dates/years. They only ASK — no legal claim is asserted.

/** Address of the bot. Opening it sends a logged-out user through the bot's
 *  own sign-in and back. (Never use a sign-in redirect URL here — those carry
 *  a one-time state and stop working.) */
export const BOT_URL = 'https://botnim.co.il/';

export interface BotQuestion {
  label: string; // short chip text
  text: string;  // the full question that is copied
}

const MAX = 4;

// A session title as a search topic: drop the formal tails that only add noise
// ("(מתאריך 12 בנובמבר 26)", "בהתאם להוראת סעיף … לתקנון הכנסת")
const quote = (t: string) => `"${t
  .replace(/\s*\(מתאריך[^)]*\)/g, '')
  .replace(/\s*בהתאם להוראת סעיף.*$/, '')
  .replace(/\s+/g, ' ')
  .trim()}"`;

function topicQuestions(topic: string): BotQuestion[] {
  const t = quote(topic);
  return [
    { label: 'מה נאמר בכנסת', text: `מה נאמר בדיוני הכנסת האחרונים בנושא ${t}? הבא ציטוטים מרכזיים עם שם הדובר, המפלגה וקישור לפרוטוקול.` },
    { label: 'הצעות לסדר ודיונים מהירים', text: `אילו הצעות לסדר היום ודיונים מהירים הוגשו לאחרונה בנושא ${t}?` },
    { label: 'החלטות ממשלה', text: `אילו החלטות ממשלה התקבלו בנושא ${t}? ציין מספר החלטה ותאריך.` },
  ];
}

// ── Weekly schedule ─────────────────────────────────────────────────────────
export function weekQuestions(
  row: { kind: string; body: string; topic: string },
  isoDate: string,
): BotQuestion[] {
  const [y, m, d] = isoDate.split('-');
  const date = `${d}/${m}/${y}`;
  const topic = row.topic.trim();
  const out: BotQuestion[] = [];

  if (row.kind === 'court') return out; // the bot has no court sources

  if (row.kind === 'pl' || /מליאה/.test(row.body)) {
    out.push({ label: 'סדר היום של המליאה', text: `מה על סדר היום של מליאת הכנסת בתאריך ${date}?` });
  }
  // Government, cabinet, ministerial committees: the bot's angle is cabinet decisions
  if (row.kind === 'gov' || /ממשלה|קבינט|שרים/.test(row.body)) {
    out.push({ label: 'החלטות ממשלה אחרונות', text: 'אילו החלטות ממשלה התקבלו לאחרונה? הצג את החדשות ביותר עם מספר ההחלטה, התאריך והנושא.' });
    return out;
  }
  if (!topic) return out;

  // Procedural sittings (electing a chair / deputies): only the rules are
  // worth asking about — a topical search on the title would find nothing
  if (/בחירת סגנ/.test(topic)) {
    out.push({ label: 'מה קובע התקנון', text: 'מה קובעים חוק הכנסת ותקנון הכנסת לגבי בחירת סגנים ליושב-ראש הכנסת?' });
    return out;
  }
  if (/בחירת (יו"ר|יושב)/.test(topic)) {
    out.push(/ועד/.test(topic)
      ? { label: 'מה קובע התקנון', text: 'מה קובע תקנון הכנסת לגבי בחירת יושב-ראש ועדה והחלפתו?' }
      : { label: 'מה קובע התקנון', text: 'מה קובעים חוק הכנסת ותקנון הכנסת לגבי בחירת יושב-ראש הכנסת והעברתו מכהונתו?' });
    return out;
  }
  if (/מצב חירום/.test(topic)) {
    out.push({ label: 'מה קובע החוק', text: 'מה קובע חוק-יסוד: הממשלה לגבי הכרזה על מצב חירום והארכתה, ומה תפקיד הכנסת בכך?' });
  }
  if (/מצב מיוחד בעורף/.test(topic)) {
    out.push({ label: 'מה קובע החוק', text: 'מה קובע החוק לגבי הכרזה על מצב מיוחד בעורף והארכתה, ומי מאשר אותה?' });
  }
  if (/תקציב|העברות/.test(topic)) {
    out.push({ label: 'שינויים תקציביים השנה', text: `אילו בקשות לשינויים תקציביים הוגשו בשנת ${y}? הצג את הגדולות ביותר לפי סכום, עם המשרד והנימוק.` });
  }

  return [...out, ...topicQuestions(topic)].slice(0, MAX);
}

// ── Budget requests ─────────────────────────────────────────────────────────
export function budgetQuestions(
  r: { number: string; codes: string; ministry: string },
  year: number,
): BotQuestion[] {
  const codes = r.codes ? ` (מספרי בקשות: ${r.codes.replace(/ · /g, ', ')})` : '';
  return [
    {
      label: 'פירוט הפנייה',
      text: `מה ידוע על הפנייה התקציבית מספר ${r.number} לשנת ${year}${codes}? פרט מאילו סעיפים ולאילו סעיפים עובר הכסף, את הסכומים ואת הנימוקים.`,
    },
    {
      label: 'שינויים תקציביים במשרד',
      text: `אילו שינויים תקציביים אושרו בשנת ${year} עבור ${r.ministry}? הצג סכום לכל בקשה.`,
    },
    {
      label: 'תקציב מול ביצוע',
      text: `מה התקציב המקורי, התקציב המאושר והביצוע בפועל של ${r.ministry} בשנת ${year}?`,
    },
  ];
}

// ── Legislation tracker ─────────────────────────────────────────────────────
export function lawQuestions(it: { name: string; kind: string }): BotQuestion[] {
  const out = topicQuestions(it.name);
  if (/הצ"ח/.test(it.kind)) {
    out.push({ label: 'הליך הצעת חוק פרטית', text: 'מה קובע תקנון הכנסת לגבי הגשת הצעת חוק פרטית, הנחתה והדיון המוקדם בה? ציין את הסעיפים הרלוונטיים.' });
  }
  // Cabinet decisions first for a draft government decision
  if (/ה"מ/.test(it.kind)) out.sort((a, b) => Number(b.label === 'החלטות ממשלה') - Number(a.label === 'החלטות ממשלה'));
  return out.slice(0, MAX);
}

// ── Plenum ──────────────────────────────────────────────────────────────────
// A bill on a plenum sitting's agenda. The bot holds the protocols and the law
// book, so it can tell what was said and what the rules of the stage are.
export function plenumQuestions(name: string, isoDate: string, took: boolean): BotQuestion[] {
  const [y, m, d] = isoDate.split('-');
  const date = `${d}/${m}/${y}`;
  const bill = name.trim();
  const out: BotQuestion[] = [];
  if (took) {
    out.push({ label: 'מה נאמר בדיון', text: `מה נאמר במליאת הכנסת בדיון על ${bill} בתאריך ${date}? סכם את עמדות הדוברים המרכזיים לפי הפרוטוקול.` });
  }
  out.push({ label: 'דיונים קודמים בנושא', text: `אילו דיונים התקיימו בכנסת, במליאה ובוועדות, על ${bill}? הצג אותם לפי תאריך עם עיקרי הדברים.` });
  out.push({ label: 'שלבי החקיקה בתקנון', text: 'מה קובע תקנון הכנסת לגבי שלבי החקיקה של הצעת חוק: דיון מוקדם, קריאה ראשונה, קריאה שנייה וקריאה שלישית? ציין את הסעיפים הרלוונטיים.' });
  return out.slice(0, MAX);
}

// ── Key dates ───────────────────────────────────────────────────────────────
export function dateQuestions(
  d: { category: string; title: string; date: string },
  thisYear = new Date().getFullYear(), // budget data exists only up to the current year
): BotQuestion[] {
  const year = d.date.slice(0, 4);
  if (d.category === 'הרכבת ממשלה') {
    return [{ label: 'מה קובע החוק', text: 'מה קובע חוק-יסוד: הממשלה לגבי התקופה להרכבת ממשלה, הארכתה, ומה קורה אם המשימה נכשלת?' }];
  }
  if (d.category === 'תקציב') {
    return [
      { label: 'מה קובע החוק', text: 'מה קובעים חוק-יסוד: הכנסת וחוק-יסוד: משק המדינה לגבי מצב שבו חוק התקציב לא אושר בזמן (תקציב המשכי והתפזרות הכנסת)?' },
      { label: 'דיוני התקציב במליאה', text: `מתי התקיימו במליאת הכנסת הדיונים האחרונים על תקציב המדינה לשנת ${year}?` },
    ];
  }
  if (d.category === 'כנסת' && /יו"ר הכנסת/.test(d.title)) {
    return [{ label: 'מה קובע התקנון', text: 'מה קובעים חוק הכנסת ותקנון הכנסת לגבי בחירת יושב-ראש הכנסת והעברתו מכהונתו?' }];
  }
  if (/בלו/.test(d.title)) {
    return [{ label: 'הכנסות ממס הבלו', text: `מה היו הכנסות המדינה ממס הבלו על דלק בשנים ${thisYear - 2}–${thisYear}?` }];
  }
  if (/תחבורה הציבורית/.test(d.title)) {
    return [{ label: 'תקציב הסובסידיה', text: `מה תקציב הסובסידיה לתחבורה הציבורית בשנת ${thisYear}, ומה היה בשנתיים שקדמו לה?` }];
  }
  return [];
}
