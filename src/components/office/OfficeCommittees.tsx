'use client';

import { useEffect, useMemo, useState } from 'react';
import { getOfficeData, OfficeMk } from '@/lib/office';
import s from './Office.module.css';

// ועדות — who sits on each Knesset committee, and on which committees each MK
// sits. Fetched LIVE from the Knesset website's own API, straight from the
// browser (the API allows any origin): no sync and no table, so committees
// that are formed later simply appear.
//
// The Knesset gives the names, the roles and the official faction of each MK.
// Party and bloc come from the admin's MK directory (office_mks): by name, and
// where the spelling differs — through the MK's faction, as long as all the
// directory MKs of that faction carry the same party and bloc. An MK that
// cannot be placed either way is shown as "לא משויך", never guessed.

const API = 'https://www.knesset.gov.il/WebSiteApi/knessetapi/';
const KNESSET_ID = 26; // the current Knesset
const KNESSET_PAGE = 'https://main.knesset.gov.il/apps/committees';

// Bloc order = display order. The last entry holds whoever could not be placed.
const BLOCS = [
  { name: 'גוש השינוי', color: '#1f72c4' },
  { name: 'המפלגות הערביות', color: '#0f766e' },
  { name: 'גוש נתניהו', color: '#6b7280' },
  { name: 'לא משויך', color: '#d1d5db' },
];
const NO_BLOC = 3;
const blocIndex = (bloc?: string) => {
  const i = BLOCS.findIndex(b => b.name === (bloc ?? '').trim());
  return i >= 0 && i < NO_BLOC ? i : NO_BLOC;
};

interface RawMember { MkId?: number; FirstName?: string; LastName?: string; PositionName?: string }
interface RawCommittee { CommitteeId?: number; CommitteeName?: string; members?: RawMember[] }
interface RawMk { MkID?: number; FirstName?: string; LastName?: string; faction_name?: string }
interface RawListed { id?: number; name?: string; ParentName?: string }

type Role = 'chair' | 'member' | 'sub';
const RANK: Record<Role, number> = { chair: 0, member: 1, sub: 2 };
// "יושב-ראש" / "יושבת-ראש" → chair; "ממלא מקום" (and observers) do not count as members
const roleOf = (position: string): Role => (/^יוש/.test(position) ? 'chair' : /ממל|משקי/.test(position) ? 'sub' : 'member');

interface Aff { party: string; bloc: number }
interface Member extends Aff { key: string; name: string; role: Role; label: string }
interface Committee {
  key: string;
  name: string;
  parent: string;       // set for a sub-committee
  url: string | null;   // the committee's page on the Knesset site
  chair: string;
  members: Member[];
  regular: number;      // chair + members, without substitutes
  subs: number;
  counts: number[];     // regular members per bloc, indexed like BLOCS
}
interface Seat { key: string; committee: string; label: string }
interface Person extends Aff { key: string; name: string; sort: string; seats: Seat[] }
interface Loaded {
  committees: Committee[];
  people: Person[];
  hasBlocs: boolean;    // the admin's MK directory was available
  allMks: boolean;      // people = the whole Knesset, not only committee members
  unplaced: boolean;    // some committee member has no bloc
}

/** Names as the Knesset sends them carry stray spaces and, here and there, a vowel mark. */
const clean = (t?: string | null) => (t ?? '').replace(/[֑-ׇ]/g, '').replace(/\s+/g, ' ').trim();
/** Comparison form of a name: hyphens as spaces, no quote marks. */
const norm = (t: string) => clean(clean(t).replace(/[־\-–]/g, ' ').replace(/["'׳״`.]/g, ''));

async function getJson<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(API + path, { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function build(all: RawCommittee[], mkList: RawMk[], listed: RawListed[], dir: OfficeMk[]): Loaded {
  const dirByName = new Map(dir.map(m => [norm(m.name), m] as const));
  const byName = (name: string): Aff | null => {
    const d = dirByName.get(norm(name));
    return d ? { party: d.party, bloc: blocIndex(d.bloc) } : null;
  };

  // Faction → party + bloc, learned from the MKs whose name IS in the directory.
  // A faction whose MKs disagree (a split, say) teaches nothing.
  const factionOf = new Map<number, string>();
  const byFaction = new Map<string, Aff | null>();
  for (const m of mkList) {
    const faction = clean(m.faction_name);
    if (m.MkID) factionOf.set(m.MkID, faction);
    const a = byName(`${m.FirstName ?? ''} ${m.LastName ?? ''}`);
    if (!a || !faction) continue;
    const prev = byFaction.get(faction);
    if (prev === undefined) byFaction.set(faction, a);
    else if (prev && (prev.party !== a.party || prev.bloc !== a.bloc)) byFaction.set(faction, null);
  }
  const affiliate = (id: number, name: string): Aff => {
    const faction = factionOf.get(id) ?? '';
    return byName(name) ?? byFaction.get(faction) ?? { party: faction || BLOCS[NO_BLOC].name, bloc: NO_BLOC };
  };

  const people = new Map<string, Person>();
  const person = (id: number, first: string, last: string): Person | null => {
    const name = clean(`${first} ${last}`);
    if (!name) return null;
    const key = String(id || name);
    let p = people.get(key);
    if (!p) {
      p = { key, name, sort: clean(`${last} ${first}`), seats: [], ...affiliate(id, name) };
      people.set(key, p);
    }
    return p;
  };
  for (const m of mkList) person(m.MkID ?? 0, m.FirstName ?? '', m.LastName ?? '');

  const listedByName = new Map(listed.map(c => [clean(c.name), c] as const));
  const committees = all.map((c, i): Committee => {
    const name = clean(c.CommitteeName) || 'ועדה';
    const key = String(c.CommitteeId ?? `i${i}`);
    // One line per MK: the Knesset may list a chair both as chair and as member
    const byKey = new Map<string, Member>();
    for (const m of c.members ?? []) {
      const p = person(m.MkId ?? 0, m.FirstName ?? '', m.LastName ?? '');
      if (!p) continue;
      const position = clean(m.PositionName);
      const role = roleOf(position);
      const prev = byKey.get(p.key);
      if (prev && RANK[prev.role] <= RANK[role]) continue;
      const label = role === 'chair' ? 'יו"ר' : role === 'sub' ? (/ממל/.test(position) ? 'מ"מ' : position) : '';
      byKey.set(p.key, { key: p.key, name: p.name, party: p.party, bloc: p.bloc, role, label });
    }
    const members = [...byKey.values()];
    const counts = BLOCS.map(() => 0);
    for (const m of members) {
      people.get(m.key)?.seats.push({ key, committee: name, label: m.label });
      if (m.role !== 'sub') counts[m.bloc]++;
    }
    const regular = members.filter(m => m.role !== 'sub').length;
    const l = listedByName.get(name);
    return {
      key, name, members, counts, regular,
      subs: members.length - regular,
      chair: members.find(m => m.role === 'chair')?.name ?? '',
      parent: clean(l?.ParentName),
      url: Number.isInteger(l?.id) ? `${KNESSET_PAGE}/${l?.id}` : null,
    };
  });

  return {
    committees,
    people: [...people.values()].sort((a, b) => a.sort.localeCompare(b.sort, 'he')),
    hasBlocs: dir.length > 0,
    allMks: mkList.length > 0,
    unplaced: committees.some(c => c.members.some(m => m.bloc === NO_BLOC)),
  };
}

async function load(): Promise<Loaded> {
  // Only the composition itself is essential; the rest degrades quietly
  const [all, mks, listed, office] = await Promise.all([
    getJson<RawCommittee[]>(`CommitteeDetails/GetAllCommitteesMembersInKnesset?Lang=he&knessetId=${KNESSET_ID}`),
    getJson<{ Mks?: RawMk[] }>('MKs/GetMks?languageKey=he').catch(() => null),
    getJson<RawListed[]>('Committees/GetAllCommittees/HE').catch(() => null),
    getOfficeData(),
  ]);
  if (!Array.isArray(all)) throw new Error('תשובה לא צפויה מאתר הכנסת');
  return build(
    all,
    Array.isArray(mks?.Mks) ? mks.Mks : [],
    Array.isArray(listed) ? listed : [],
    office.status === 'ok' ? office.data.mks ?? [] : [],
  );
}

/** A committee's members as bloc → party → MKs: blocs in display order, parties by size. */
function grouped(c: Committee) {
  const out: { bloc: number; regular: number; subs: number; parties: { party: string; members: Member[] }[] }[] = [];
  BLOCS.forEach((_, bloc) => {
    const list = c.members.filter(m => m.bloc === bloc);
    if (list.length === 0) return;
    const parties: { party: string; members: Member[] }[] = [];
    for (const m of list) {
      let g = parties.find(x => x.party === m.party);
      if (!g) { g = { party: m.party, members: [] }; parties.push(g); }
      g.members.push(m);
    }
    for (const g of parties) g.members.sort((a, b) => RANK[a.role] - RANK[b.role]);
    parties.sort((a, b) => b.members.length - a.members.length);
    const regular = list.filter(m => m.role !== 'sub').length;
    out.push({ bloc, regular, subs: list.length - regular, parties });
  });
  return out;
}

/** A committee as a short WhatsApp message: its name, then the members party by party. */
function whatsappText(c: Committee): string {
  const size = c.regular === 1 ? 'חבר אחד' : `${c.regular} חברים`;
  const lines = [
    `*${c.name}*${c.parent ? ` (ועדת משנה של ${c.parent})` : ''} · ${size}${c.subs > 0 ? ` + ${c.subs} מ"מ` : ''}`,
    '',
  ];
  for (const g of grouped(c)) {
    for (const p of g.parties) {
      const regular = p.members.filter(m => m.role !== 'sub').length;
      const subs = p.members.length - regular;
      const count = subs === 0 ? `${regular}` : regular === 0 ? `${subs} מ"מ` : `${regular} + ${subs} מ"מ`;
      const names = p.members.map(m => (m.label ? `${m.name} (${m.label})` : m.name)).join(', ');
      lines.push(`*${p.party}* (${count}): ${names}`);
    }
  }
  return lines.join('\n');
}

const cVar = (color: string) => ({ ['--c' as string]: color });

type View = 'committees' | 'mks';

export default function OfficeCommittees() {
  const [view, setView] = useState<View>('committees');
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [openCommittee, setOpenCommittee] = useState<string | null>(null);
  const [openMk, setOpenMk] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [manual, setManual] = useState<{ key: string; text: string } | null>(null);

  async function copyCommittee(c: Committee) {
    const text = whatsappText(c);
    try {
      await navigator.clipboard.writeText(text);
      setManual(null);
      setCopied(c.key);
      setTimeout(() => setCopied(k => (k === c.key ? null : k)), 2000);
    } catch {
      // Clipboard blocked — show the message so it can be copied by hand
      setManual({ key: c.key, text });
    }
  }

  useEffect(() => {
    let cancelled = false;
    load()
      .then(d => { if (!cancelled) { setData(d); setFailed(false); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [attempt]);

  const loading = !failed && !data;
  const committees = data?.committees ?? [];
  const hasBlocs = !!data?.hasBlocs;
  const seated = useMemo(() => (data?.people ?? []).filter(p => p.seats.length > 0).length, [data]);

  const people = useMemo(() => {
    const q = query.trim();
    const list = data?.people ?? [];
    return q ? list.filter(p => `${p.name} ${p.party}`.includes(q)) : list;
  }, [data, query]);

  // The two views point at each other: an MK inside a committee opens that
  // MK's row, a committee inside an MK's row opens that committee
  function showMk(m: Member) {
    setView('mks');
    setQuery(m.name);
    setOpenMk(m.key);
    window.scrollTo(0, 0);
  }
  function showCommittee(key: string) {
    setView('committees');
    setOpenCommittee(key);
    requestAnimationFrame(() => document.getElementById(`committee-${key}`)?.scrollIntoView({ block: 'start' }));
  }

  const onKey = (toggle: () => void) => (e: React.KeyboardEvent) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(); }
  };

  const failure = (
    <div className={s.none}>
      לא ניתן לטעון כרגע מאתר הכנסת.{' '}
      <button type="button" className={s.btn} onClick={() => { setFailed(false); setAttempt(a => a + 1); }}>נסה שוב</button>{' '}
      <a href={KNESSET_PAGE} target="_blank" rel="noopener noreferrer" style={{ color: '#0075C4', fontWeight: 700 }}>לעמוד באתר הכנסת ↗</a>
    </div>
  );

  return (
    <>
      <div className={s.mast}>
        <h1>ועדות</h1>
        <span className={s.mastDate}>
          {data
            ? `${committees.length} ועדות · ${seated}${data.allMks ? ` מתוך ${data.people.length}` : ''} ח"כים משובצים`
            : 'הרכב הוועדות'}
        </span>
        <div className={s.mastTools}>
          <div className={s.seg}>
            <button type="button" className={view === 'committees' ? s.on : ''} onClick={() => setView('committees')}>לפי ועדה</button>
            <button type="button" className={view === 'mks' ? s.on : ''} onClick={() => setView('mks')}>לפי ח&quot;כ</button>
          </div>
        </div>
      </div>

      {hasBlocs && (
        <div className={s.legend}>
          {BLOCS.map((b, i) => (i < NO_BLOC || data?.unplaced) && (
            <span key={b.name}><i aria-hidden="true" style={cVar(b.color)} />{b.name}</span>
          ))}
        </div>
      )}

      {view === 'committees' && (
        <div className={s.tbl}>
          <div className={`${s.bHead} ${s.cHead}`}>
            <div>ועדה</div><div>יו&quot;ר</div><div>חברים</div><div>יחסי כוחות</div>
          </div>
          {loading && <div className={s.none}>טוען מאתר הכנסת…</div>}
          {failed && failure}
          {data && committees.length === 0 && <div className={s.none}>עדיין לא הוקמו ועדות בכנסת הנוכחית</div>}
          {committees.map(c => {
            const expanded = openCommittee === c.key;
            const toggle = () => setOpenCommittee(expanded ? null : c.key);
            return (
              <div key={c.key} id={`committee-${c.key}`}>
                <div
                  className={`${s.bRow} ${s.cRow}`} role="button" tabIndex={0} aria-expanded={expanded}
                  onClick={toggle} onKeyDown={onKey(toggle)}
                >
                  <span className={s.cName}>
                    {c.name}
                    {c.parent && <small>ועדת משנה של {c.parent}</small>}
                  </span>
                  <span className={s.cChair}>{c.chair || <span className={s.topicNone}>אין יו&quot;ר</span>}</span>
                  <span className={s.cNum}>
                    {c.regular}
                    {c.subs > 0 && <small> +{c.subs} מ&quot;מ</small>}
                  </span>
                  <span className={s.bal}>
                    {hasBlocs
                      ? BLOCS.map((b, i) => (i < NO_BLOC || c.counts[i] > 0) && (
                          <span key={b.name} title={`${b.name}: ${c.counts[i]}`}>
                            <i aria-hidden="true" style={cVar(b.color)} />{c.counts[i]}
                          </span>
                        ))
                      : <span className={s.topicNone}>—</span>}
                  </span>
                </div>
                {expanded && (
                  <div className={s.detail}>
                    {hasBlocs && c.regular > 0 && (
                      <div className={s.balBar} aria-hidden="true">
                        {BLOCS.map((b, i) => c.counts[i] > 0 && <i key={b.name} style={{ ...cVar(b.color), flex: c.counts[i] }} />)}
                      </div>
                    )}
                    {c.members.length === 0 && <div>עדיין לא פורסמו חברים לוועדה.</div>}
                    {grouped(c).map(g => (
                      <div key={g.bloc} className={s.cBloc}>
                        <div className={s.lbl}>
                          {hasBlocs && <i aria-hidden="true" className={s.dot} style={cVar(BLOCS[g.bloc].color)} />}
                          {hasBlocs ? BLOCS[g.bloc].name : 'חברי הוועדה'} · {g.regular}
                          {g.subs > 0 && ` + ${g.subs} מ"מ`}
                        </div>
                        {g.parties.map(p => (
                          <div key={p.party} className={s.pRow}>
                            <b className={s.pName}>{p.party}</b>
                            <div className={s.assignRow}>
                              {p.members.map(m => (
                                <button
                                  key={m.key} type="button" className={`${s.mk} ${s.cMk}`}
                                  style={cVar(BLOCS[m.bloc].color)} title={'לוועדות של הח"כ'} onClick={() => showMk(m)}
                                >
                                  {m.name}{m.label && <small>{m.label}</small>}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    <div className={s.inline} style={{ marginTop: 10 }}>
                      {c.members.length > 0 && (
                        <button type="button" className={s.btn} onClick={() => copyCommittee(c)}>
                          {copied === c.key ? 'הועתק ✓' : 'העתק לוואטסאפ'}
                        </button>
                      )}
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noopener noreferrer">עמוד הוועדה באתר הכנסת ↗</a>
                      )}
                    </div>
                    {manual?.key === c.key && (
                      <div className={s.botNote} style={{ whiteSpace: 'pre-wrap' }}>
                        ההעתקה נחסמה בדפדפן. אפשר לסמן ולהעתיק מכאן:{'\n'}<span>{manual.text}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'mks' && (
        <>
          <div className={s.filters}>
            <input
              type="search" value={query} placeholder='חיפוש לפי שם או סיעה' aria-label='חיפוש ח"כ'
              onChange={e => { setQuery(e.target.value); setOpenMk(null); }}
            />
          </div>
          <div className={s.tbl}>
            <div className={`${s.bHead} ${s.mHead}`}>
              <div>ח&quot;כ</div><div>סיעה</div><div>ועדות</div>
            </div>
            {loading && <div className={s.none}>טוען מאתר הכנסת…</div>}
            {failed && failure}
            {data && people.length === 0 && <div className={s.none}>לא נמצאו ח&quot;כים</div>}
            {people.map(p => {
              const expanded = openMk === p.key;
              const toggle = () => setOpenMk(expanded ? null : p.key);
              const cells = (
                <>
                  <span className={s.cName}>{p.name}</span>
                  <span className={s.cChair}>{p.party}</span>
                  <span className={`${s.bSum} ${s.clamp2}`}>
                    {p.seats.length === 0
                      ? <span className={s.topicNone}>ללא ועדה</span>
                      : p.seats.map(x => (x.label ? `${x.committee} (${x.label})` : x.committee)).join(' · ')}
                  </span>
                </>
              );
              return (
                <div key={p.key}>
                  {p.seats.length === 0 ? (
                    <div className={`${s.bRow} ${s.mRow} ${s.mPlain}`} style={cVar(BLOCS[p.bloc].color)}>{cells}</div>
                  ) : (
                    <div
                      className={`${s.bRow} ${s.mRow}`} style={cVar(BLOCS[p.bloc].color)}
                      role="button" tabIndex={0} aria-expanded={expanded} onClick={toggle} onKeyDown={onKey(toggle)}
                    >
                      {cells}
                    </div>
                  )}
                  {expanded && p.seats.length > 0 && (
                    <div className={s.detail}>
                      <div className={s.lbl}>{p.seats.length === 1 ? 'ועדה אחת' : `${p.seats.length} ועדות`}</div>
                      {p.seats.map(x => (
                        <div key={x.key} className={s.seat}>
                          <button type="button" className={s.cLink} onClick={() => showCommittee(x.key)}>{x.committee}</button>
                          {x.label && <span className={s.tag}>{x.label}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className={s.meta}>
        <span>מקור: אתר הכנסת, בזמן אמת</span>
        {data && hasBlocs && <span>יחסי הכוחות לפי חברים קבועים, בלי ממלאי מקום</span>}
        {data && !hasBlocs && <span>השיוך לגושים אינו זמין כרגע, מוצגות הסיעות כפי שהן באתר הכנסת</span>}
        <a href={KNESSET_PAGE} target="_blank" rel="noopener noreferrer" style={{ color: '#0075C4' }}>לעמוד באתר הכנסת ↗</a>
      </div>
    </>
  );
}
