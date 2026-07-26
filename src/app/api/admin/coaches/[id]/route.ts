import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { deleteCoach, getCoach, listCoaches, upsertCoach } from '@/lib/db/coaches';
import { validateCoachPayload } from '../validation';

type RouteParams = {
  params: Promise<{ id: string }>
};

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { coach, error } = validateCoachPayload({ ...body, id });

    if (error || !coach) {
      return NextResponse.json({ error: error || 'Invalid payload' }, { status: 400 });
    }

    const existing = await getCoach(id.toUpperCase());
    if (!existing) {
      return NextResponse.json({ error: `Coach '${id}' not found` }, { status: 404 });
    }

    const updated = await upsertCoach(id.toUpperCase(), coach);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PUT /api/admin/coaches/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const coaches = await listCoaches();
    if (!coaches.find(coach => coach.id === id)) {
      return NextResponse.json({ error: `Coach '${id}' not found` }, { status: 404 });
    }

    if (coaches.length <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last coach' }, { status: 400 });
    }

    await deleteCoach(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/admin/coaches/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
