import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { listCoaches, upsertCoach } from '@/lib/db/coaches';
import { validateCoachPayload } from './validation';

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(await listCoaches());
  } catch (error) {
    console.error('[GET /api/admin/coaches] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
  } catch (error) {
    console.error('[POST /api/admin/coaches] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
