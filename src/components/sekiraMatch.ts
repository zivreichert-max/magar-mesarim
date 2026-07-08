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

// Best-matching real paper for an arbitrary text (or null). No synthetic fallback.
// Scored by number of shared tokens so a paper sharing one incidental word
// doesn't beat a paper sharing several.
export function findPaperForText(text: string): Paper | null {
  const toks = new Set(tokens(text));
  let best: Paper | null = null;
  let bestScore = 0;
  for (const p of PAPERS) {
    const pToks = new Set([...tokens(p.title), ...tokens(p.tag)]);
    let score = 0;
    for (const t of pToks) if (toks.has(t)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}
