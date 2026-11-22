import type { OfficeMk } from '@/lib/office';

// Party → chip color. Accepts both the Hebrew party names of the MK directory
// and the legacy party ids. Order matters: "ישראל ביתנו" must match before "ישר".
const PARTY_COLORS: [RegExp, string][] = [
  [/דמוקרט|democrats/, '#dc2626'],
  [/ביחד|beyahad/, '#16a34a'],
  [/ביתנו|yisrael-b/, '#1d4ed8'],
  [/^ישר|yashar/, '#6b7280'],
  [/רע.?ם/, '#0f766e'],
  [/משותפת/, '#b45309'],
];
export const partyColor = (party: string) => PARTY_COLORS.find(([re]) => re.test(party))?.[1] ?? '#9ca3af';

// Products are exposed — and office accounts are opened — only for MKs of the
// change bloc and the Arab parties: ישר, ביחד, הדמוקרטים, ישראל ביתנו, רע"ם,
// המשותפת — in that order. (The server route enforces the same list.)
export const EXPOSE_BLOCS = ['גוש השינוי', 'המפלגות הערביות'];
const partyRank = (p: string) =>
  /ביתנו/.test(p) ? 3 : /^ישר/.test(p) ? 0 : /ביחד/.test(p) ? 1 : /דמוקרט/.test(p) ? 2 : /רע.?ם/.test(p) ? 4 : /משותפת/.test(p) ? 5 : 9;

export function exposureParties(mks: OfficeMk[]): { party: string; mks: OfficeMk[] }[] {
  const hasBlocs = mks.some(m => m.bloc);
  const groups: { party: string; mks: OfficeMk[] }[] = [];
  for (const m of mks) {
    if (hasBlocs && !EXPOSE_BLOCS.includes(m.bloc ?? '')) continue;
    let g = groups.find(x => x.party === m.party);
    if (!g) { g = { party: m.party, mks: [] }; groups.push(g); }
    g.mks.push(m);
  }
  return groups.sort((a, b) => partyRank(a.party) - partyRank(b.party));
}
