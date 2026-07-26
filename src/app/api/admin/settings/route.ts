import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getAppConfig, SETTING_KEYS } from '@/config/appConfig';
import { setSetting } from '@/lib/db/settings';

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getAppConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[GET /api/admin/settings] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { site } = body;

    if (site !== undefined) {
      await setSetting(SETTING_KEYS.site, site);
    }

    const config = await getAppConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[PUT /api/admin/settings] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
