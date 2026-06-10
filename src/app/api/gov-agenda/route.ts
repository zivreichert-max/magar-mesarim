import { NextResponse } from 'next/server';

const GOVIL_API = 'https://openapi-gc.digital.gov.il/pub/cio/govil/rest/collectors/v1/api/DataCollector/GetResults';
const CLIENT_ID = '9KFgciHHGDyNiqz5MdQS0eK2ApeJYMc6YnElUICpN1atirZc';
const OFFICE_ID = 'e744bba9-d17e-429f-abc3-50f7a8a55667';

const SOURCES = [
  {
    key: 'ministers' as const,
    type: '06311039-a4dc-4457-af46-a8e7dbfbe5a0',
    label: 'ועדת שרים לענייני חקיקה',
    color: '#d97706',
    fallbackUrl: `https://www.gov.il/he/collectors/publications?Type=06311039-a4dc-4457-af46-a8e7dbfbe5a0&OfficeId=${OFFICE_ID}`,
  },
  {
    key: 'government' as const,
    type: '64ef8a16-f75e-4dd0-81cc-f2fc415ca45d',
    label: 'ישיבת הממשלה',
    color: '#16a34a',
    fallbackUrl: `https://www.gov.il/he/collectors/publications?Type=64ef8a16-f75e-4dd0-81cc-f2fc415ca45d&OfficeId=${OFFICE_ID}`,
  },
];

const GOVIL_HEADERS = {
  'x-client-id': CLIENT_ID,
  'Origin': 'https://www.gov.il',
  'Referer': 'https://www.gov.il/',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
};

const DAY_NAMES: Record<number, string> = {
  0: 'יום ראשון', 1: 'יום שני', 2: 'יום שלישי',
  3: 'יום רביעי', 4: 'יום חמישי', 5: 'יום שישי',
};

// Extract meeting date from description like "סדר יום ... 09.06.26" or "09.06.2026"
function parseMeetingDate(description: string): string | null {
  const m = description.match(/(\d{2})\.(\d{2})\.(\d{2,4})\s*$/);
  if (!m) return null;
  const [, d, mo, rawY] = m;
  const y = rawY.length === 2 ? '20' + rawY : rawY;
  return `${y}-${mo}-${d}`;
}

export interface GovAgendaItem {
  key: 'ministers' | 'government';
  label: string;
  color: string;
  description: string;
  publishDate: string;   // DD.MM.YYYY
  meetingDate: string | null;  // YYYY-MM-DD
  meetingDayName: string | null;
  url: string;
}

async function fetchSource(source: typeof SOURCES[number]): Promise<GovAgendaItem[]> {
  try {
    const params = `Type=${source.type}&OfficeId=${OFFICE_ID}&culture=he&skip=0&limit=5`;
    const res = await fetch(`${GOVIL_API}?${params}`, {
      headers: GOVIL_HEADERS,
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Record<string, unknown>[] };

    return (data.results ?? []).slice(0, 3).map(r => {
      const tags = r.tags as Record<string, Record<string, { title: string }[]>> | undefined;
      const publishDate = tags?.metaData?.['תאריך פרסום']?.[0]?.title ?? '';
      const descField = (r.description as string) ?? '';
      const titleField = (r.title as string) ?? '';
      const relativeUrl = (r.url as string) ?? '';

      // For government items, the meeting date is in `title` not `description`
      const meetingDate = parseMeetingDate(descField) ?? parseMeetingDate(titleField);
      // Use whichever field contains the actual meeting info (has a date)
      const displayText = parseMeetingDate(descField) ? descField : (titleField || descField);
      const meetingDayName = meetingDate ? (DAY_NAMES[new Date(meetingDate).getDay()] ?? null) : null;

      return {
        key: source.key,
        label: source.label,
        color: source.color,
        description: displayText,
        publishDate,
        meetingDate,
        meetingDayName,
        url: relativeUrl ? `https://www.gov.il${relativeUrl}` : source.fallbackUrl,
      };
    });
  } catch {
    return [];
  }
}

export async function GET() {
  const [ministersItems, govItems] = await Promise.all(SOURCES.map(fetchSource));
  return NextResponse.json({ items: [...ministersItems, ...govItems] });
}
