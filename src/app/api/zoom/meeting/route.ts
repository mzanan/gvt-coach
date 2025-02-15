import { NextResponse } from 'next/server'
import { zoomService } from '@/app/services/zoomService'

export async function POST(request: Request) {
  try {
    const { startTime } = await request.json();
    const meetingUrl = await zoomService.createMeeting(new Date(startTime));
    return NextResponse.json({ join_url: meetingUrl });
  } catch (error) {
    console.error('Error creating zoom meeting:', error);
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const token = await zoomService.getAccessToken();
    return NextResponse.json({ access_token: token });
  } catch (error) {
    console.error('Error getting zoom token:', error);
    return NextResponse.json(
      { error: 'Failed to get access token' },
      { status: 500 }
    );
  }
}