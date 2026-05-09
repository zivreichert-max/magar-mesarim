import pandas as pd
import subprocess

XLSX = r'C:\Users\ZivReichert\OneDrive - Bonim Mehadash\Storage - צוותים ותוצרים\בחירות\לוז עד בחירות\לוז פוליטי ציבורי (1).xlsx'
OUT  = r'C:\Users\ZivReichert\magar-mesarim\src\data\timeline.ts'

df = pd.read_excel(XLSX, header=1)
df.columns = ['title', 'dateStart', 'dateEnd', 'category', 'importance', 'detail', 'url']
df = df[df['title'].notna() & (df['title'].astype(str).str.strip() != '')]

def fmt_date(v):
    if pd.isna(v): return ''
    if hasattr(v, 'strftime'): return v.strftime('%Y-%m-%d')
    return str(v)[:10]

def esc(s):
    if not s or (isinstance(s, float)): return ''
    return str(s).replace('\\','\\\\').replace('`',"'").replace('${','\\${')

lines = []
lines.append('export interface TimelineEvent {')
lines.append('  title: string;')
lines.append('  dateStart: string;')
lines.append('  dateEnd?: string;')
lines.append('  category: string;')
lines.append('  importance: string;')
lines.append('  detail?: string;')
lines.append('  url?: string;')
lines.append('}')
lines.append('')
lines.append('export const TIMELINE: TimelineEvent[] = [')

for _, row in df.iterrows():
    d_start = fmt_date(row['dateStart'])
    d_end   = fmt_date(row['dateEnd'])
    detail  = esc(row['detail'])
    url     = esc(row['url'])
    lines.append('  {')
    lines.append(f'    title: `{esc(row["title"])}`,')
    lines.append(f'    dateStart: `{d_start}`,')
    if d_end: lines.append(f'    dateEnd: `{d_end}`,')
    lines.append(f'    category: `{esc(row["category"])}`,')
    lines.append(f'    importance: `{esc(row["importance"])}`,')
    if detail: lines.append(f'    detail: `{detail}`,')
    if url: lines.append(f'    url: `{url}`,')
    lines.append('  },')

lines.append('];')

with open(OUT, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print(f'Done: {len(df)} events -> timeline.ts')

subprocess.run(['powershell','-Command','npm run build'],
    cwd=r'C:\Users\ZivReichert\magar-mesarim', check=True)
subprocess.run(['git','add','-A'], cwd=r'C:\Users\ZivReichert\magar-mesarim')
subprocess.run(['git','commit','-m','Auto sync timeline from xlsx'],
    cwd=r'C:\Users\ZivReichert\magar-mesarim')
subprocess.run(['git','push'], cwd=r'C:\Users\ZivReichert\magar-mesarim')
print('Pushed!')
