import { NextResponse } from 'next/server';

const GOVIL_API = 'https://openapi-gc.digital.gov.il/pub/cio/govil/rest/collectors/v1/api/DataCollector/GetResults';
const CLIENT_ID = '9KFgciHHGDyNiqz5MdQS0eK2ApeJYMc6YnElUICpN1atirZc';

// Type=06311039... = "סדר יום ועדות שרים", OfficeId = ועדת שרים לענייני חקיקה
const PARAMS = 'Type=06311039-a4dc-4457-af46-a8e7dbfbe5a0&OfficeId=e744bba9-d17e-429f-abc3-50f7a8a55667&culture=he&skip=0&limit=5';

export interface MinistersAgendaItem {
  title: string;
  description: string;
  url: string;
  publishDate: string; // DD.MM.YYYY
}

export async function GET() {
  try {
    const res = await fetch(`${GOVIL_API}?${PARAMS}`, {
      headers: {
        'x-client-id': CLIENT_ID,
        'Origin': 'https://www.gov.il',
        'Referer': 'https://www.gov.il/',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 }, // cache 1h
    });

    if (!res.ok) throw new Error(`gov.il API ${res.status}`);
    const data = await res.json() as { results?: Record<string, unknown>[] };

    const items: MinistersAgendaItem[] = (data.results ?? []).map(r => {
      const tags = r.tags as Record<string, Record<string, { title: string }[]>> | undefined;
      const publishDate = tags?.metaData?.['תאריך פרסום']?.[0]?.title ?? '';
      const relativeUrl = (r.url as string) ?? '';
      return {
        title: (r.title as string) ?? 'סדר יום ועדות שרים',
        description: (r.description as string) ?? '',
        url: relativeUrl ? `https://www.gov.il${relativeUrl}` : 'https://www.gov.il/he/collectors/publications?Type=06311039-a4dc-4457-af46-a8e7dbfbe5a0&OfficeId=e744bba9-d17e-429f-abc3-50f7a8a55667',
        publishDate,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) }, { status: 200 });
  }
}
