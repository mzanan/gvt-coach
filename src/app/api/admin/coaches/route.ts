import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/adminAuth';
import { listCoaches, upsertCoach } from '@/lib/db/coaches';
import { validateCoachPayload } from './validation';

export const GET = withAdmin(async () => {
  return NextResponse.json(await listCoaches());
});

export const POST = withAdmin(async (request: NextRequest) => {
  const body = await request.json();
  const { id, coach, error } = validateCoachPayload(body);

  if (error || !id || !coach) {
    return NextResponse.json({ error: error || 'Invalid payload' }, { status: 400 });
  }

  const existing = (await listCoaches()).find(c => c.id === id);
  if (existing) {
    return NextResponse.json({ error: `Coach '${id}' already exists` }, { status: 409 });
  }

  const created = await upsertCoach(id, coach);
  return NextResponse.json(created, { status: 201 });
});
