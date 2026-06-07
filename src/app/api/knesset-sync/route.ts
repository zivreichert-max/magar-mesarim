import { NextResponse } from 'next/server';
import { syncKnessetSessions } from '@/lib/knessetSync';

export async function GET(req: Request) {
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const updates = await syncKnessetSessions();
    return NextResponse.json({ ok: true, updates: updates.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
