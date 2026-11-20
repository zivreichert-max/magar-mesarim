import { NextResponse } from 'next/server';

// TEMPORARY diagnostic — is the Knesset website (the budget-requests API and
// the request PDFs) reachable from Vercel's servers? Fixed targets, no input,
// no secrets. Removed once the answer is known.
export const dynamic = 'force-dynamic';

const LIST = 'https://www.knesset.gov.il/WebSiteApi/knessetapi/CommitteeReports/GetCommitteePortalsBudget';

async function attempt(run: (signal: AbortSignal) => Promise<Record<string, unknown>>) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  const started = Date.now();
  try {
    return { ...(await run(ctrl.signal)), ms: Date.now() - started };
  } catch (e) {
    return { error: String(e).slice(0, 200), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  let pdfUrl: string | null = null;
  const list = await attempt(async signal => {
    const res = await fetch(LIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ FromDate: null, ToDate: null, requestStatus: 1, RowsPerPage: 1, pageNumber: 1 }),
      signal,
      cache: 'no-store',
    });
    const text = await res.text();
    try {
      const rows = JSON.parse(text) as { ReportUrl?: string }[];
      pdfUrl = rows[0]?.ReportUrl ?? null;
    } catch { /* not JSON — the status and length below tell the story */ }
    return { status: res.status, length: text.length, json: pdfUrl !== null };
  });
  const pdf = pdfUrl
    ? await attempt(async signal => {
        const res = await fetch(pdfUrl as string, { headers: { Range: 'bytes=0-2047' }, signal, cache: 'no-store' });
        const buf = await res.arrayBuffer();
        return {
          status: res.status,
          bytes: buf.byteLength,
          isPdf: new TextDecoder().decode(buf.slice(0, 5)) === '%PDF-',
          type: res.headers.get('content-type'),
        };
      })
    : { skipped: true };
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, list, pdf });
}
