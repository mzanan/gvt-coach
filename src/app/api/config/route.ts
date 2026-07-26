import { NextResponse } from 'next/server';
import { getAppConfig } from '@/config/appConfig';

export async function GET() {
  try {
    const config = await getAppConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[GET /api/config] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
