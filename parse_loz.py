import os, re, sys
from docx import Document
from docx.oxml.ns import qn

DOCX = r'C:\Users\ZivReichert\OneDrive - Bonim Mehadash\Storage - צוותים ותוצרים\בחירות\דף מסרים\לוז שבועי מתעדכן לאתר.docx'
OUT  = r'C:\Users\ZivReichert\magar-mesarim\src\data\schedule.ts'

doc = Document(DOCX)

rels = doc.part.rels
url_map = {rId: rel._target for rId, rel in rels.items() if 'hyperlink' in rel.reltype.lower()}

def get_urls(p):
    r = []
    for h in p._p.findall('.//' + qn('w:hyperlink')):
        i = h.get(qn('r:id'))
        if i and i in url_map:
            u = url_map[i]
            if u and u.startswith('http'): r.append(u)
    return r

def esc(s):
    return s.replace('\\','\\\\').replace('`',"'").replace('${','\\${') if s else ''

CATEGORIES = {
    'בג"ץ': 'bgz',
    'ישיבת ממשלה': 'gov',
    'ועדת שרים': 'ministers',
    'ועדות הכנסת': 'knesset',
    'ועדת': 'knesset',
}

COLOR_MAP = {
    'bgz': '#0075C4',
    'gov': '#16a34a',
    'ministers': '#d97706',
    'knesset': '#6b7280',
}

events = []
current_cat = 'knesset'
current_day = ''
current_event = None
week_title = ''

def flush(ev, events):
    if ev and ev.get('title'):
        events.append(dict(ev))

for para in doc.paragraphs:
    text = para.text.strip()
    style = para.style.name
    urls = get_urls(para)

    if not text:
        continue

    if style in ['Title', 'Heading 1'] and not week_title:
        week_title = text
        continue

    cat_found = None
    for key, val in CATEGORIES.items():
        if text.startswith(key) or text == key:
            cat_found = val
            break

    if cat_found:
        flush(current_event, events)
        current_event = None
        current_cat = cat_found
        continue

    days = ['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי']
    if any(text.startswith(d) for d in days):
        flush(current_event, events)
        current_event = None
        current_day = text
        continue

    time_match = re.match(r'^(\d{1,2}:\d{2})\s*[–\-—]\s*(.+)$', text)
    if time_match:
        flush(current_event, events)
        current_event = {
            'day': current_day,
            'time': time_match.group(1),
            'title': time_match.group(2).strip(),
            'summary': '',
            'detail': '',
            'category': current_cat,
            'color': COLOR_MAP.get(current_cat, '#6b7280'),
        }
        if urls: current_event['url'] = urls[0]
        continue

    if current_event is None:
        if style in ['List Paragraph', 'List Number'] or re.match(r'^\d+\.', text):
            flush(current_event, events)
            title = re.sub(r'^\d+\.\s*', '', text)
            current_event = {
                'day': current_day,
                'time': '',
                'title': title,
                'summary': '',
                'detail': '',
                'category': current_cat,
                'color': COLOR_MAP.get(current_cat, '#6b7280'),
            }
            if urls: current_event['url'] = urls[0]
        continue

    for prefix in ['תקציר:', 'בקצרה:']:
        if text.startswith(prefix):
            current_event['summary'] = text[len(prefix):].strip()
            break
    else:
        for prefix in ['הרחבה:', 'בהרחבה:', 'פירוט:', 'הסבר:']:
            if text.startswith(prefix):
                val = text[len(prefix):].strip()
                if val:
                    current_event['detail'] = (current_event['detail'] + ' ' + val).strip()
                break
        else:
            if current_event.get('summary') and not text.startswith('הרחבה'):
                if not any(text.startswith(p) for p in ['תקציר','בקצרה','הרחבה','פירוט','יום ']):
                    current_event['detail'] = (current_event['detail'] + ' ' + text).strip()

flush(current_event, events)

lines = []
lines.append("export interface ScheduleEvent {")
lines.append("  day: string;")
lines.append("  time: string;")
lines.append("  title: string;")
lines.append("  summary: string;")
lines.append("  detail: string;")
lines.append("  category: string;")
lines.append("  color: string;")
lines.append("  url?: string;")
lines.append("}")
lines.append("")
lines.append(f"export const WEEK_TITLE = `{esc(week_title)}`;")
lines.append("")
lines.append("export const SCHEDULE: ScheduleEvent[] = [")

for ev in events:
    lines.append("  {")
    lines.append(f"    day: `{esc(ev['day'])}`,")
    lines.append(f"    time: `{esc(ev['time'])}`,")
    lines.append(f"    title: `{esc(ev['title'])}`,")
    lines.append(f"    summary: `{esc(ev['summary'])}`,")
    lines.append(f"    detail: `{esc(ev['detail'])}`,")
    lines.append(f"    category: '{ev['category']}',")
    lines.append(f"    color: '{ev['color']}',")
    if ev.get('url'):
        lines.append(f"    url: `{esc(ev['url'])}`,")
    lines.append("  },")

lines.append("];")

open(OUT, 'w', encoding='utf-8').write('\n'.join(lines))
print(f"Done: {len(events)} events -> schedule.ts")

import subprocess
subprocess.run(['powershell','-Command','npm run build'],
    cwd=r'C:\Users\ZivReichert\magar-mesarim', check=True)
subprocess.run(['git','add','-A'],cwd=r'C:\Users\ZivReichert\magar-mesarim')
subprocess.run(['git','commit','-m','Auto sync schedule from docx'],cwd=r'C:\Users\ZivReichert\magar-mesarim')
subprocess.run(['git','push'],cwd=r'C:\Users\ZivReichert\magar-mesarim')
print('Pushed!')
