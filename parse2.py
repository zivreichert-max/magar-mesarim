import os, re, sys
from docx import Document
from docx.oxml.ns import qn

DOCX = r'C:\Users\ZivReichert\OneDrive - Bonim Mehadash\Storage - צוותים ותוצרים\בחירות\דף מסרים\חומרים מתעדכנים באתר.docx'
OUT = r'C:\Users\ZivReichert\magar-mesarim\src\data\messages.ts'

doc = Document(DOCX)
rels = doc.part.rels
url_map = {rId: rel._target for rId, rel in rels.items() if 'hyperlink' in rel.reltype.lower()}
img_map = {}
for rId, rel in rels.items():
    if 'image' in rel.reltype.lower():
        t = rel._target
        img_map[rId] = os.path.basename(str(t.partname) if hasattr(t,'partname') else str(t))

def imgs(p):
    r=[]
    for b in p._p.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip'):
        e=b.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
        if e and e in img_map: r.append(img_map[e])
    return r

def urls(p):
    r=[]
    for h in p._p.findall('.//' + qn('w:hyperlink')):
        i=h.get(qn('r:id'))
        if i and i in url_map:
            u=url_map[i]
            if u and u.startswith('http') and 'sharepoint' not in u: r.append(u)
    return r

COLORS={'חינוך':'#4a9eff','חוץ':'#a855f7','איו"ש':'#f97316','ביטחון פנים':'#ef4444','דת ומדינה':'#d4a843','תקציב המדינה':'#22c55e','יוקר מחייה':'#06b6d4','בריאות':'#38bdf8','מלחמה':'#b91c1c'}
items=[]
topic=''
cur=None

for para in doc.paragraphs:
    t=para.text.strip()
    s=para.style.name
    ig=imgs(para)
    ul=urls(para)
    if s=='Title' and 'נושא:' in t:
        if cur and cur['title'] and 'אין מה לשים' not in cur['title']: items.append(cur)
        raw=t.replace('נושא:','').strip()
        topic='__SKIP__' if any(k in raw for k in ['הישגי','תקשורת','תשתיות']) else ('חוץ' if 'חוץ' in raw else raw)
        cur=None; continue
    if topic=='__SKIP__': continue
    if s=='List Paragraph' and ('תת-נושא:' in t or 'תת נושא:' in t):
        if cur and cur['title'] and 'אין מה לשים' not in cur['title']: items.append(cur)
        title=t.replace('תת-נושא:','').replace('תת נושא:','').strip()
        cur=None if 'אין מה לשים' in title else {'topic':topic,'title':title,'summary':'','detail':'','source':'','urls':[],'imgs':[]}
        continue
    if cur is None: continue
    if ig: cur['imgs'].extend(ig)
    if ul: cur['urls'].extend([u for u in ul if u not in cur['urls']])
    if not t: continue
    for p in ['תקציר:','בקצרה:']:
        if t.startswith(p): cur['summary']=t[len(p):].strip(); break
    else:
        for p in ['הרחבה:','בהרחבה:','העמקה:']:
            if t.startswith(p):
                v=t[len(p):].strip()
                if v and not cur['detail']: cur['detail']=v; break
        else:
            for p in ['סימוכין ותאריך עידכון:','סימוכין:','מקור:']:
                if t.startswith(p):
                    s2=t[len(p):].strip()
                    if ul: s2=(s2+' - '+'|'.join(dict.fromkeys(ul))).strip(' -')
                    cur['source']=s2; break

if cur and cur['title'] and 'אין מה לשים' not in cur['title']: items.append(cur)
items=[i for i in items if i['summary'] or i['detail']]

def e(s): return s.replace('\\','\\\\').replace('`',"'").replace('${','\\${') if s else ''

lines=['export type Topic =']
for i,t in enumerate(COLORS): lines.append(f"  | '{t}'" + (';' if i==len(COLORS)-1 else ''))
lines+=['','export interface Message {','  id: number;','  topic: Topic;','  title: string;','  summary: string;','  detail: string;','  source: string;','  visual?: string;','}','','export const TOPICS: Record<Topic, { color: string }> = {']
for t,c in COLORS.items(): lines.append(f"  '{t}': {{ color: '{c}' }},")
lines+=['};','','export const MESSAGES: Message[] = [']
for idx,item in enumerate(items):
    v='/visuals/'+item['imgs'][0] if item['imgs'] else ''
    s=item['source']
    if item['urls']:
        u='|'.join(dict.fromkeys(item['urls']))
        if u not in s: s=(s+' - '+u).strip(' -')
    lines+=['  {',f"    id: {idx+1},",f"    topic: '{item['topic']}',",f'    title: `{e(item["title"])}`,',f'    summary: `{e(item["summary"])}`,',f'    detail: `{e(item["detail"])}`,',f'    source: `{e(s)}`,']
    if v: lines.append(f"    visual: '{v}',")
    lines.append('  },')
lines.append('];')
open(OUT,'w',encoding='utf-8').write('\n'.join(lines))
print(f'Done: {len(items)} items')

import subprocess
subprocess.run(['npm','run','build'],cwd=r'C:\Users\ZivReichert\magar-mesarim',check=True)
subprocess.run(['git','add','-A'],cwd=r'C:\Users\ZivReichert\magar-mesarim')
subprocess.run(['git','commit','-m','Auto sync from docx'],cwd=r'C:\Users\ZivReichert\magar-mesarim')
subprocess.run(['git','push'],cwd=r'C:\Users\ZivReichert\magar-mesarim')
print('Done - pushed!')
