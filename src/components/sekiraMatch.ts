import { PAPERS, Paper } from '@/data/papers';

// Match a sekira topic/event/highlight to an existing position paper by shared
// distinctive words. Common political words are stopped so generic overlaps
// (e.g. "המדינה" in both "מבקר המדינה" and "ביטחון המדינה") don't false-match.
const STOP = new Set(['חוק', 'הצעת', 'ועדת', 'הוועדה', 'דיון', 'הכנה', 'קריאה', 'שנייה', 'שלישית',
  'צפויות', 'הצבעות', 'בקידום', 'בונים', 'מחדש', 'במרחב', 'המשך', 'דיונים',
  'המדינה', 'הכנסת', 'ישראל', 'הממשלה', 'הציבור', 'הציבורי']);

function tokens(s: string): string[] {
  return (s.match(/[֐-׿"']+/g) || [])
    .map(w => w.replace(/["']/g, ''))
    .filter(w => w.length >= 4 && !STOP.has(w));
}

// Explicit aliases for topics whose wording doesn't share tokens with the paper
// that nonetheless covers them (e.g. "חוק יסוד: לימוד תורה" → the giyus paper).
const ALIASES: { when: string[]; paperTitleIncludes: string }[] = [
  { when: ['לימוד תורה'], paperTitleIncludes: 'גיוס' },
];

// Best-matching real paper for an arbitrary text (or null). No synthetic fallback.
export function findPaperForText(text: string): Paper | null {
  for (const a of ALIASES) {
    if (a.when.some(k => text.includes(k))) {
      const p = PAPERS.find(pp => pp.title.includes(a.paperTitleIncludes));
      if (p) return p;
    }
  }
  const toks = new Set(tokens(text));
  for (const p of PAPERS) {
    const pToks = [...tokens(p.title), ...tokens(p.tag)];
    if (pToks.some(t => toks.has(t))) return p;
  }
  return null;
}
