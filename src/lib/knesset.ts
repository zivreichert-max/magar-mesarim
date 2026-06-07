const KNESSET_API = 'https://knesset.gov.il/OdataV4/ParliamentInfo';

export interface KnessetSession {
  id: string;
  committee: string;
  title: string;
  dayName: string;
  date: string;
  time: string;
  url: string;
}

function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day);
  sunday.setHours(0, 0, 0, 0);
  const friday = new Date(sunday);
  friday.setDate(sunday.getDate() + 6);
  friday.setHours(23, 59, 59, 0);
  return {
    from: sunday.toISOString().slice(0, 10),
    to: friday.toISOString().slice(0, 10),
  };
}

const DAY_NAMES: Record<number, string> = {
  0: 'יום ראשון', 1: 'יום שני', 2: 'יום שלישי',
  3: 'יום רביעי', 4: 'יום חמישי', 5: 'יום שישי',
};

export async function fetchKnessetWeeklySessions(): Promise<KnessetSession[]> {
  const { from, to } = getWeekRange();
  const filter = `StartDate ge ${from}T00:00:00Z and StartDate le ${to}T23:59:59Z`;
  const url = `${KNESSET_API}/KNS_CommitteeSession?$filter=${encodeURIComponent(filter)}&$expand=KNS_Committee&$orderby=StartDate&$top=100&$format=json`;

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Knesset API error: ${res.status}`);
  const data = await res.json();
  const items: Record<string, unknown>[] = data.value ?? [];

  return items.map((item) => {
    const start = new Date(item.StartDate as string);
    const dayNum = start.getDay();
    const dateStr = start.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
    const timeStr = start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const committee = item.KNS_Committee as Record<string, unknown> | undefined;
    const committeeName = (committee?.Name as string) ?? 'ועדה לא ידועה';
    const sessionId = String(item.CommitteeSessionID ?? item.ID ?? item.Id ?? '');

    return {
      id: sessionId,
      committee: committeeName,
      title: (item.Name as string) ?? (item.SessionName as string) ?? 'ישיבה',
      dayName: DAY_NAMES[dayNum] ?? '',
      date: dateStr,
      time: timeStr,
      url: sessionId
        ? `https://main.knesset.gov.il/Activity/committees/Pages/AllCommitteeAgenda.aspx?ItemID=${sessionId}`
        : 'https://main.knesset.gov.il',
    };
  });
}
