import re, sys
sys.stdout.reconfigure(encoding='utf-8')
from docx import Document
from docx.oxml.ns import qn

DOCX = r'C:\Users\ZivReichert\Downloads\loz_tmp.docx'

doc = Document(DOCX)
rels = doc.part.rels
url_map = {rId: rel._target for rId, rel in rels.items() if 'hyperlink' in rel.reltype.lower()}

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

CATS = {
    'בג"ץ':          ('bgz',       '#0075C4'),
    'ישיבת ממשלה':   ('gov',       '#16a34a'),
    'ועדת שרים':     ('ministers', '#d97706'),
    'וועדות הכנסת':  ('knesset',   '#6b7280'),
}
SUMMARY_LABELS = {'תקציר', 'בקצרה'}
DETAIL_LABELS  = {'הרחבה', 'הרחבה:', 'פירוט', 'פירוט:'}  # removed שורה תחתונה

def is_new_bill(text):
    # Bill titles start "הצעת חוק X" (not "הצעת החוק")
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
    current_event = {'day': current_day, 'time': time or current_time,
                     'title': title.strip(), 'summary': '', 'detail': '',
                     'category': current_cat, 'url': None}

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

    # ── category ──────────────────────────────────────────────────────────
    cm = None
    for key, (val, col) in CATS.items():
        if text == key or text.startswith(key): cm = (val, col); break
    if cm:
        flush(); current_cat = cm[0]; last_label = None; current_time = ''; continue

    # ── day+time  e.g. "יום ראשון בשעה 11:00" ────────────────────────────
    m = re.match(r'^(יום\s+\S+)\s+בשעה\s+(\d{1,2}:\d{2})', text)
    if m:
        flush(); current_day = m.group(1); current_time = m.group(2); last_label = None
        if current_cat == 'gov': new_event('ישיבת ממשלה')
        continue

    # ── plain day ─────────────────────────────────────────────────────────
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

    # ── label ─────────────────────────────────────────────────────────────
    if tl in SUMMARY_LABELS: last_label = 'summary'; continue
    if tl in DETAIL_LABELS:  last_label = 'detail';  continue

    # ── List Paragraph: ministers ─────────────────────────────────────────
    if style == 'List Paragraph' and current_cat == 'ministers':
        if last_label is None or is_new_bill(text):
            new_event(text)
        elif last_label == 'summary':
            add_s(text)
        else:  # detail
            add_d(text)
        save_url(urls); continue

    # ── List Paragraph: gov / knesset → note/summary ──────────────────────
    if style == 'List Paragraph' and current_cat in ('gov', 'knesset'):
        add_s(text); save_url(urls); continue

    # ── time+title event (FIX: no last_label check — always creates event) ─
    m = re.match(r'^(\d{1,2}:\d{2})\s*[–\-—]?\s*(.+)$', text)
    if m:
        new_event(m.group(2).strip(), time=m.group(1)); save_url(urls); continue

    # ── URL / link paragraph ──────────────────────────────────────────────
    if urls and (text.startswith('http') or re.match(r'^קישור', text)):
        save_url(urls); continue

    # ── content accumulation ──────────────────────────────────────────────
    if last_label == 'summary': add_s(raw); save_url(urls)
    elif last_label == 'detail': add_d(raw); save_url(urls)

flush()

print(f'week: {week_title}')
print(f'events: {len(events)}\n')
for ev in events:
    print(f'[{ev["category"]}] {ev["day"]} {ev["time"]}')
    print(f'  T: {ev["title"][:90]}')
    if ev['summary']: print(f'  S: {ev["summary"][:90]}')
    if ev['detail']:  print(f'  D: {ev["detail"][:90]}')
    if ev['url']:     print(f'  U: {ev["url"][:70]}')
    print()
