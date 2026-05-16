import re, shutil, subprocess, tempfile
from docx import Document
from docx.oxml.ns import qn

DOCX_SRC = r'C:\Users\ZivReichert\OneDrive - Bonim Mehadash\Storage - צוותים ותוצרים\בחירות\דף מסרים\לוז שבועי מתעדכן לאתר.docx'
OUT      = r'C:\Users\ZivReichert\magar-mesarim\src\data\schedule.ts'

# Copy to temp to avoid OneDrive lock/encoding issues
tmp = tempfile.NamedTemporaryFile(suffix='.docx', delete=False)
tmp.close()
shutil.copy2(DOCX_SRC, tmp.name)
doc = Document(tmp.name)

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
    return str(s).replace('\\', '\\\\').replace('`', "'").replace('${', '\\${')

CATS = {
    'בג"ץ':         ('bgz',       '#0075C4'),
    'ישיבת ממשלה':  ('gov',       '#16a34a'),
    'ועדת שרים':    ('ministers', '#d97706'),
    'וועדות הכנסת': ('knesset',   '#6b7280'),
}
SUMMARY_LABELS = {'תקציר', 'בקצרה'}
DETAIL_LABELS  = {'הרחבה', 'הרחבה:', 'פירוט', 'פירוט:'}

def is_new_bill(text):
    return text.startswith('הצעת חוק') and not text.startswith('הצעת החוק')

events = []
current_cat = 'knesset'; current_day = ''; current_time = ''
current_event = None; week_title = ''; found_week = False; last_label = None

def flush():
    global current_event
    if current_event and current_event.get('title'): events.append(dict(current_event))
    current_event = None

def new_event(title, time=''):
    global current_event, last_label
    flush(); last_label = None
    color_map = {'bgz':'#0075C4','gov':'#16a34a','ministers':'#d97706','knesset':'#6b7280'}
    current_event = {'day': current_day, 'time': time or current_time,
                     'title': title.strip(), 'summary': '', 'detail': '',
                     'category': current_cat, 'color': color_map.get(current_cat,'#6b7280'),
                     'url': None}

def add_s(t):
    if current_event and t.strip():
        s = t.strip()
        current_event['summary'] = (current_event['summary'] + ' ' + s).strip() \
                                    if current_event['summary'] else s

def add_d(t):
    if current_event and t.strip():
        s = t.strip()
        current_event['detail'] = (current_event['detail'] + '\n' + s).strip() \
                                   if current_event['detail'] else s

def save_url(u):
    if current_event and u and not current_event.get('url'): current_event['url'] = u[0]

for para in doc.paragraphs:
    raw = para.text; text = raw.strip(); style = para.style.name; tl = text.rstrip(':')
    if not text: continue
    if not found_week:
        if re.search(r'לו"ז שבועי', text) or re.search(r'לו"ז \d', text):
            week_title = text; found_week = True
        continue

    urls = get_hyperlinks(para) + [u for u in extract_urls(text) if u not in get_hyperlinks(para)]

    # category
    cm = None
    for key, (val, col) in CATS.items():
        if text == key or text.startswith(key): cm = (val, col); break
    if cm:
        flush(); current_cat = cm[0]; last_label = None; current_time = ''; continue

    # day+time  "יום ראשון בשעה 11:00"
    m = re.match(r'^(יום\s+\S+)\s+בשעה\s+(\d{1,2}:\d{2})', text)
    if m:
        flush(); current_day = m.group(1); current_time = m.group(2); last_label = None
        continue

    # plain day
    is_day = False
    for prefix in ['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי']:
        if text == prefix or text.startswith(prefix + ' '):
            is_day = True; current_day = prefix
            t2 = re.search(r'(\d{1,2}:\d{2})', text)
            current_time = t2.group(1) if t2 else ''
            break
    if not is_day and text in {'ראשון','שני','שלישי','רביעי','חמישי'}:
        is_day = True; current_day = 'יום ' + text; current_time = ''
    if is_day: flush(); last_label = None; continue

    # label (standalone line or inline "תקציר: content")
    il = re.match(r'^(תקציר|בקצרה|הרחבה|פירוט|העמקה)\s*:\s*(.+)$', text)
    if il:
        if il.group(1) in SUMMARY_LABELS: add_s(il.group(2)); last_label = 'summary'
        else: add_d(il.group(2)); last_label = 'detail'
        save_url(urls); continue
    if tl in SUMMARY_LABELS: last_label = 'summary'; continue
    if tl in DETAIL_LABELS:  last_label = 'detail';  continue

    # List Paragraph: ministers
    if style == 'List Paragraph' and current_cat == 'ministers':
        if last_label is None or is_new_bill(text):
            new_event(text)
        elif last_label == 'summary':
            add_s(text)
        else:
            add_d(text)
        save_url(urls); continue

    # List Paragraph: gov → each agenda item is its own event
    if style == 'List Paragraph' and current_cat == 'gov':
        new_event(text); save_url(urls); continue

    # List Paragraph: knesset → new event if none active (e.g. Wednesday has no time prefix),
    # otherwise add as sub-item to current event
    if style == 'List Paragraph' and current_cat == 'knesset':
        if current_event is None:
            new_event(text); save_url(urls)
        else:
            add_s(text); save_url(urls)
        continue

    # time+title (no last_label check — always creates new event)
    m = re.match(r'^(\d{1,2}:\d{2})\s*[–\-—]?\s*(.+)$', text)
    if m:
        new_event(m.group(2).strip(), time=m.group(1)); save_url(urls); continue

    # URL paragraph
    if urls and (text.startswith('http') or re.match(r'^קישור', text)):
        save_url(urls); continue

    # content accumulation
    if last_label == 'summary': add_s(raw); save_url(urls)
    elif last_label == 'detail': add_d(raw); save_url(urls)

flush()

# ── Write TypeScript ──────────────────────────────────────────────────────────
lines = [
    'export interface ScheduleEvent {',
    '  day: string;', '  time: string;', '  title: string;',
    '  summary: string;', '  detail: string;',
    '  category: string;', '  color: string;', '  url?: string;',
    '}', '',
    f'export const WEEK_TITLE = `{esc(week_title)}`;', '',
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
