import os, re, shutil, tempfile, subprocess
from docx import Document
from docx.oxml.ns import qn

DOCX = r'C:\Users\ZivReichert\OneDrive - Bonim Mehadash\Storage - צוותים ותוצרים\בחירות\דף מסרים\חומרים מתעדכנים באתר.docx'
OUT = r'C:\Users\ZivReichert\magar-mesarim\src\data\messages.ts'
VISUALS_DIR = r'C:\Users\ZivReichert\magar-mesarim\public\visuals'

tmp = tempfile.NamedTemporaryFile(suffix='.docx', delete=False)
tmp.close()
shutil.copy2(DOCX, tmp.name)
doc = Document(tmp.name)

rels = doc.part.rels
url_map = {rId: rel._target for rId, rel in rels.items() if 'hyperlink' in rel.reltype.lower()}
img_map = {}
for rId, rel in rels.items():
    if 'image' in rel.reltype.lower():
        t = rel._target
        img_map[rId] = os.path.basename(str(t.partname) if hasattr(t, 'partname') else str(t))

def para_imgs(p):
    r = []
    for b in p._p.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip'):
        e = b.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
        if e and e in img_map:
            r.append(img_map[e])
    return r

def para_urls(p):
    r = []
    for h in p._p.findall('.//' + qn('w:hyperlink')):
        i = h.get(qn('r:id'))
        if i and i in url_map:
            u = url_map[i]
            if u and u.startswith('http') and 'sharepoint' not in u:
                r.append(u)
    return r

def extract_path(text):
    m = re.search(r'"([A-Za-z]:\\[^"]+)"', text)
    if m: return m.group(1)
    m = re.search(r'([A-Za-z]:\\[^\s"،;]+\.[a-zA-Z]{2,5})', text)
    if m: return m.group(1)
    return ''

COLORS = {
    'חינוך': '#4a9eff', 'חוץ': '#a855f7', 'איו"ש': '#f97316',
    'ביטחון פנים': '#ef4444', 'דת ומדינה': '#d4a843',
    'תקציב המדינה': '#22c55e', 'יוקר מחייה': '#06b6d4',
    'בריאות': '#38bdf8', 'מלחמה': '#b91c1c',
}

SUMMARY_P = ['תקציר:', 'בקצרה:']
DETAIL_P  = ['הרחבה:', 'בהרחבה:', 'העמקה:', 'פירוט:', 'בפירוט:']
SOURCE_P  = ['סימוכין ותאריך עידכון:', 'סימוכין:', 'מקור:', 'מקורות:']
VISUAL_P  = ['ויזואליה:', 'ויזאוליה:', 'וויזואליה:', 'ויזיאוליה:', 'תמונה:']
URL_P     = ['כתובת:', 'קישור:']

def match_prefix(t, prefixes):
    for p in prefixes:
        if t.startswith(p):
            return p, t[len(p):].strip()
    return None, None

items = []
topic = ''
cur = None
label = None  # active accumulation field

def flush():
    if cur and cur.get('title') and 'אין מה לשים' not in cur['title']:
        items.append(dict(cur))

def new_item(title):
    global cur, label
    flush()
    label = None
    cur = {
        'topic': topic, 'title': title,
        'summary': '', 'detail': '', 'source': '',
        'urls': [], 'visual_path': '', 'embed_img': '',
    }

def add(field, val):
    val = (val or '').strip()
    if not val:
        return
    if cur[field]:
        cur[field] += '\n' + val
    else:
        cur[field] = val

for para in doc.paragraphs:
    t = para.text.strip()
    s = para.style.name
    ul = para_urls(para)
    ig = para_imgs(para)

    # ── Topic heading ──────────────────────────────────────────────────────────
    if s == 'Title' and 'נושא:' in (t or ''):
        flush()
        cur = None; label = None
        raw = t.replace('נושא:', '').strip()
        topic = '__SKIP__' if any(k in raw for k in ['הישגי', 'תקשורת', 'תשתיות']) \
                else ('חוץ' if 'חוץ' in raw else raw)
        continue

    if topic == '__SKIP__':
        continue

    # ── Subtopic heading ───────────────────────────────────────────────────────
    if s == 'List Paragraph' and ('תת-נושא:' in t or 'תת נושא:' in t):
        title = t.replace('תת-נושא:', '').replace('תת נושא:', '').strip()
        if title and 'אין מה לשים' not in title:
            new_item(title)
        else:
            flush(); cur = None; label = None
        continue

    if cur is None:
        continue

    # Collect hyperlinks from every paragraph
    for u in ul:
        if u not in cur['urls']:
            cur['urls'].append(u)

    # Empty paragraph → stop continuation
    if not t:
        label = None
        continue

    # ── Label detection ────────────────────────────────────────────────────────
    p, val = match_prefix(t, SUMMARY_P)
    if p:
        label = 'summary'; add('summary', val); continue

    p, val = match_prefix(t, DETAIL_P)
    if p:
        label = 'detail'; add('detail', val); continue

    p, val = match_prefix(t, SOURCE_P)
    if p:
        label = 'source'
        if ul:
            extra = '|'.join(u for u in dict.fromkeys(ul) if u not in (val or ''))
            val = (val + ' - ' + extra).strip(' -') if extra else val
        add('source', val)
        continue

    p, val = match_prefix(t, VISUAL_P)
    if p:
        label = None
        path = extract_path(val)
        if path:
            cur['visual_path'] = path          # explicit file path in doc text
        elif ig and not cur['embed_img']:
            cur['embed_img'] = ig[0]           # embedded image on the ויזואליה line only
        continue

    p, val = match_prefix(t, URL_P)
    if p:
        label = None
        if val:
            cur['urls'].append(val)
        continue

    # ── Continuation of active label ───────────────────────────────────────────
    if label:
        if label == 'source' and ul:
            extra = '|'.join(u for u in dict.fromkeys(ul) if u not in t)
            t = (t + ' - ' + extra).strip(' -') if extra else t
        add(label, t)

flush()
print(f'Parsed {len(items)} items')

# ── Resolve visuals ────────────────────────────────────────────────────────────
def resolve_visual(item):
    if item['visual_path']:
        src = item['visual_path']
        if os.path.exists(src):
            fname = os.path.basename(src)
            dest = os.path.join(VISUALS_DIR, fname)
            shutil.copy2(src, dest)
            print(f'  copied visual: {fname}')
            return '/visuals/' + fname
        else:
            print(f'  MISSING file: {src}')
            return ''
    if item['embed_img']:
        return '/visuals/' + item['embed_img']
    return ''

# ── Write messages.ts ──────────────────────────────────────────────────────────
def e(s):
    return s.replace('\\', '\\\\').replace('`', "'").replace('${', '\\${') if s else ''

lines = ['export type Topic =']
for i, t in enumerate(COLORS):
    lines.append(f"  | '{t}'" + (';' if i == len(COLORS) - 1 else ''))
lines += [
    '', 'export interface Message {',
    '  id: number;', '  topic: Topic;', '  title: string;',
    '  summary: string;', '  detail: string;', '  source: string;',
    '  visual?: string;', '}', '',
    'export const TOPICS: Record<Topic, { color: string }> = {',
]
for t, c in COLORS.items():
    lines.append(f"  '{t}': {{ color: '{c}' }},")
lines += ['};', '', 'export const MESSAGES: Message[] = [']

for idx, item in enumerate(items):
    s = item['source']
    if item['urls']:
        u = '|'.join(dict.fromkeys(item['urls']))
        if u not in s:
            s = (s + ' - ' + u).strip(' -')
    v = resolve_visual(item)
    lines += [
        '  {',
        f"    id: {idx + 1},",
        f"    topic: '{item['topic']}',",
        f"    title: `{e(item['title'])}`,",
        f"    summary: `{e(item['summary'])}`,",
        f"    detail: `{e(item['detail'])}`,",
        f"    source: `{e(s)}`,",
    ]
    if v:
        lines.append(f"    visual: '{v}',")
    lines.append('  },')
lines.append('];')

open(OUT, 'w', encoding='utf-8').write('\n'.join(lines))
print(f'Done: {len(items)} items written')

subprocess.run(['npm', 'run', 'build'], cwd=r'C:\Users\ZivReichert\magar-mesarim', check=True)
subprocess.run(['git', 'add', '-A'], cwd=r'C:\Users\ZivReichert\magar-mesarim')
subprocess.run(['git', 'commit', '-m', 'Auto sync from docx'], cwd=r'C:\Users\ZivReichert\magar-mesarim')
subprocess.run(['git', 'push'], cwd=r'C:\Users\ZivReichert\magar-mesarim')
print('Done - pushed!')
