import { NextResponse } from 'next/server';

const SYSTEM = `אתה כותב פריט לו"ז לוועדת כנסת עבור אתר "זמן בחירות".

פורמט:
- תקציר: פסקה אחת, 3–5 משפטים. מסביר מה הדיון, למה הוא חשוב, ומה הזווית המרכזית למעקב. ספציפי, לא כללי.
- הרחבה: 2–4 פסקאות קצרות. פסקה 1 — רקע עובדתי. פסקה 2 — המחלוקת/הבעיה. פסקה 3 — נקודת המעקב.
- סימוכין: 1–3 מקורות. עדיפות: המכון הישראלי לדמוקרטיה, מרכז המחקר והמידע של הכנסת, אתר הכנסת, תקשורת כלכלית-משפטית איכותית.

סגנון: קצר, חד, נגיש. מזהה את המחלוקת הפוליטית-ציבורית אך נשען על עובדות.

כללי זהירות:
- אל תמציא מידע. אם אין מספיק מידע — כתוב "סביר שהדיון יתמקד..." או "בשלב זה לא אותר מקור רשמי."
- תמיד סיים בנקודת מעקב או משמעות ציבורית.

החזר JSON בלבד, ללא טקסט נוסף:
{"summary": "...", "detail": "פסקה 1\\n\\nפסקה 2\\n\\nפסקה 3", "source": "שם המקור — תיאור\\nhttps://..."}`;

// Best-effort per-IP rate limit — this endpoint spends real Anthropic credits
// (web search + tokens), so an unauthenticated caller must not be able to
// loop it. In-memory per serverless instance; a cold start resets it, which
// is acceptable for blunting abuse.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) hits.clear(); // memory guard
  return false;
}

function asBoundedString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length > 0 && s.length <= max ? s : null;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'יותר מדי בקשות — נסה שוב בעוד דקה' }, { status: 429 });
    }

    const body = await req.json();
    const committee = asBoundedString(body.committee, 200);
    const title = asBoundedString(body.title, 300);
    const day = asBoundedString(body.day, 40);
    const time = asBoundedString(body.time, 40);
    if (!committee || !title || !day || !time) {
      return NextResponse.json({ error: 'קלט חסר או ארוך מדי' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY לא מוגדר ב-Vercel' }, { status: 500 });

    const userPrompt = `דיון בוועדת כנסת:
ועדה: ${committee}
נושא: ${title}
יום: ${day}
שעה: ${time}

חפש מידע על הדיון הזה וכתוב תקציר, הרחבה וסימוכין לפי המתודולוגיה.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: `Anthropic API ${response.status}: ${err.slice(0, 200)}` }, { status: 500 });
    }

    const data = await response.json();
    const fullText = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n');

    const clean = fullText.replace(/```json|```/g, '').trim();
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart === -1) return NextResponse.json({ error: 'לא התקבל JSON תקין מ-Claude', raw: fullText.slice(0, 300) }, { status: 500 });

    const parsed = JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
    return NextResponse.json({
      summary: parsed.summary ?? '',
      detail: parsed.detail ?? '',
      source: parsed.source ?? '',
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
