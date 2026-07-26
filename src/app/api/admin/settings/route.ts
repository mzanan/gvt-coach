import { NextRequest, NextResponse } from 'next/server';
import { auth, isAdminEmail } from '@/auth';
import { getAppConfig, SETTING_KEYS } from '@/config/appConfig';
import { setSetting } from '@/lib/db/settings';

const PAYMENT_PROVIDERS = ['stripe', 'polar', 'lemonsqueezy', 'disabled'];
const MEETING_PROVIDERS = ['zoom', 'google-meet'];

async function requireAdmin() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return null;
  }
  return session;
}

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
    const { coaches, site, paymentProvider, meetingProvider } = body;

    if (paymentProvider !== undefined && !PAYMENT_PROVIDERS.includes(paymentProvider)) {
      return NextResponse.json({ error: `Invalid payment provider: ${paymentProvider}` }, { status: 400 });
    }

    if (meetingProvider !== undefined && !MEETING_PROVIDERS.includes(meetingProvider)) {
      return NextResponse.json({ error: `Invalid meeting provider: ${meetingProvider}` }, { status: 400 });
    }

    if (coaches !== undefined) {
      await setSetting(SETTING_KEYS.coaches, coaches);
    }
    if (site !== undefined) {
      await setSetting(SETTING_KEYS.site, site);
    }
    if (paymentProvider !== undefined) {
      await setSetting(SETTING_KEYS.paymentProvider, paymentProvider);
    }
    if (meetingProvider !== undefined) {
      await setSetting(SETTING_KEYS.meetingProvider, meetingProvider);
    }

    const config = await getAppConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[PUT /api/admin/settings] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
