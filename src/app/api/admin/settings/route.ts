import { NextRequest, NextResponse } from 'next/server';
import { withAdmin } from '@/lib/adminAuth';
import { getAppConfig, SETTING_KEYS } from '@/config/appConfig';
import { setSetting } from '@/lib/db/settings';

export const GET = withAdmin(async () => {
  const config = await getAppConfig();
  return NextResponse.json(config);
});

export const PUT = withAdmin(async (request: NextRequest) => {
  const body = await request.json();
  const { site } = body;

  if (site !== undefined) {
    await setSetting(SETTING_KEYS.site, site);
  }

  const config = await getAppConfig();
  return NextResponse.json(config);
});
