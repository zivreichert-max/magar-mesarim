import re, subprocess
from docx import Document
from docx.oxml.ns import qn

DOCX = r'C:\Users\ZivReichert\OneDrive - Bonim Mehadash\Storage - צוותים ותוצרים\בחירות\דף מסרים\לוז שבועי מתעדכן לאתר.docx'
OUT  = r'C:\Users\ZivReichert\magar-mesarim\src\data\schedule.ts'

doc = Document(DOCX)
rels = doc.part.rels
url_map = {rId: rel._target for rId, rel in rels.items()
           if 'hyperlink' in rel.reltype.lower()}

def get_hyperlinks(p):
    out = []
    for h in p._p.findall('.//' + qn('w:hyperlink')):
        i = h.get(qn('r:id'))
        if i and i in url_map:
            u = url_map[i]
            if u and u.startswith('http'): out.append(u)
    return out

def extract_urls(text):
    return re.findall(r'https?://\S+', text)

def esc(s):
    if not s: return ''
    return str(s).replace('\\','\\\\').replace('`',"'").replace('${','\\${')

# ─── categories ───
CATS = {
    'בג"ץ':                   'bgz',
    'ישיבת ממשלה':            'gov',
    'ועדת שרים':              'ministers',
    'וועדות הכנסת':           'knesset',
}
COLOR = {'bgz':'#0075C4','gov':'#16a34a','ministers':'#d97706','knesset':'#6b7280'}

# Labels that mark what follows
SUMMARY_LABELS = {'תקציר','בקצרה'}
DETAIL_LABELS  = {'הרחבה','הרחבה:','פירוט','פירוט:','שורה תחתונה:'}

BARE_DAYS = {'ראשון','שני','שלישי','רביעי','חמישי','שישי'}

events      = []
current_cat = 'knesset'
current_day = ''
current_time = ''
current_event = None
week_title    = ''
found_week   = False
last_label   = None   # 'summary' | 'detail' | None

def flush():
    global current_event
    if current_event and current_event.get('title'):
        events.append(dict(current_event))
    current_event = None

def new_event(title, time=''):
    global current_event, last_label
    flush()
    last_label = None
    current_event = {
        'day':      current_day,
        'time':     time or current_time,
        'title':    title.strip(),
        'summary':  '',
        'detail':   '',
        'category': current_cat,
        'color':    COLOR.get(current_cat,'#6b7280'),
    }

def add_summary(text):
    if not current_event: return
    t = text.strip()
    if not t: return
    current_event['summary'] = (current_event['summary'] + ' ' + t).strip() \
                                if current_event['summary'] else t

def add_detail(text):
    if not current_event: return
    t = text.strip()
    if not t: return
    current_event['detail'] = (current_event['detail'] + '\n' + t).strip() \
                               if current_event['detail'] else t

def save_url(urls):
    if current_event and urls and not current_event.get('url'):
        current_event['url'] = urls[0]


for para in doc.paragraphs:
    raw   = para.text          # preserve internal soft-returns (\n)
    text  = raw.strip()
    style = para.style.name
    tl    = text.rstrip(':')   # text without trailing colon

    if not text:
        continue

    # ── 1. Find week title ──────────────────────────────────────────────────
    if not found_week:
        if re.search(r'לו"ז שבועי', text) or re.search(r'לו"ז \d', text):
            week_title = text
            found_week = True
        continue

    # ── collect URLs from paragraph ─────────────────────────────────────────
    urls = get_hyperlinks(para) + [u for u in extract_urls(text)
                                    if u not in get_hyperlinks(para)]

    # ── 2. Category line ────────────────────────────────────────────────────
    cat_match = None
    for key, val in CATS.items():
        if text == key or text.startswith(key):
            cat_match = val
            break
    if cat_match:
        flush()
        current_cat  = cat_match
        last_label   = None
        current_time = ''
        continue

    # ── 3. Day+time line  e.g. "יום ראשון בשעה 11:00" ──────────────────────
    m = re.match(r'^(יום\s+\S+)\s+בשעה\s+(\d{1,2}:\d{2})', text)
    if m:
        flush()
        current_day  = m.group(1)
        current_time = m.group(2)
        last_label   = None
        # gov: the category name itself is the event
        if current_cat == 'gov':
            new_event('ישיבת ממשלה')
        continue

    # ── 4. Plain day line ───────────────────────────────────────────────────
    is_day = False
    if text in BARE_DAYS:
        is_day      = True
        current_day = 'יום ' + text
        current_time = ''
    else:
        for prefix in ['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי']:
            if text == prefix or text.startswith(prefix + ' '):
                is_day      = True
                current_day = prefix
                t_in_day = re.search(r'(\d{1,2}:\d{2})', text)
                current_time = t_in_day.group(1) if t_in_day else ''
                break
    if is_day:
        flush()
        last_label = None
        continue

    # ── 5. Label line ───────────────────────────────────────────────────────
    if tl in SUMMARY_LABELS:
        last_label = 'summary'
        continue
    if tl in DETAIL_LABELS:
        last_label = 'detail'
        continue

    # ── 6. List Paragraph in ועדת שרים → new bill event ────────────────────
    if style == 'List Paragraph' and current_cat == 'ministers' and tl not in SUMMARY_LABELS and tl not in DETAIL_LABELS:
        new_event(text)
        save_url(urls)
        continue

    # ── 7. List Paragraph in gov/knesset → note/summary ────────────────────
    if style == 'List Paragraph' and current_cat in ('gov', 'knesset'):
        # URL-only note
        if urls and len(text) < 250 and text.startswith('http'):
            save_url(urls)
        else:
            add_summary(text)
            save_url(urls)
        continue

    # ── 8. Time-prefixed event line ─────────────────────────────────────────
    m = re.match(r'^(\d{1,2}:\d{2})\s*[–\-—]?\s*(.+)$', text)
    if m and last_label is None:
        new_event(m.group(2).strip(), time=m.group(1))
        save_url(urls)
        continue

    # ── 9. URL / link paragraph ─────────────────────────────────────────────
    if urls and (text.startswith('http') or re.match(r'^קישור', text)):
        save_url(urls)
        continue

    # ── 10. Content accumulation ────────────────────────────────────────────
    if last_label == 'summary':
        add_summary(raw)
        save_url(urls)
    elif last_label == 'detail':
        add_detail(raw)
        save_url(urls)

flush()

# ─── Emit TypeScript ─────────────────────────────────────────────────────────
lines = [
    'export interface ScheduleEvent {',
    '  day: string;',
    '  time: string;',
    '  title: string;',
    '  summary: string;',
    '  detail: string;',
    '  category: string;',
    '  color: string;',
    '  url?: string;',
    '}',
    '',
    f'export const WEEK_TITLE = `{esc(week_title)}`;',
    '',
    'export const SCHEDULE: ScheduleEvent[] = [',
]
for ev in events:
    lines += [
        '  {',
        f"    day: `{esc(ev['day'])}`,",
        f"    time: `{esc(ev['time'])}`,",
        f"    title: `{esc(ev['title'])}`,",
        f"    summary: `{esc(ev['summary'])}`,",
        f"    detail: `{esc(ev['detail'])}`,",
        f"    category: '{ev['category']}',",
        f"    color: '{ev['color']}',",
    ]
    if ev.get('url'):
        lines.append(f"    url: `{esc(ev['url'])}`,")
    lines.append('  },')
lines.append('];')

open(OUT, 'w', encoding='utf-8').write('\n'.join(lines))
print(f'Done: {len(events)} events -> schedule.ts')

subprocess.run(['powershell','-Command','npm run build'],
    cwd=r'C:\Users\ZivReichert\magar-mesarim', check=True)
subprocess.run(['git','add','-A'], cwd=r'C:\Users\ZivReichert\magar-mesarim')
subprocess.run(['git','commit','-m','Auto sync schedule from docx'],
    cwd=r'C:\Users\ZivReichert\magar-mesarim')
subprocess.run(['git','push'], cwd=r'C:\Users\ZivReichert\magar-mesarim')
print('Pushed!')
