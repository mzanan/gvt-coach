import { NextRequest, NextResponse } from 'next/server';
import { createZoomMeeting, getZoomAccessToken } from '@/lib/zoom';

export async function POST(request: NextRequest) {
  try {
    const { meetingTopic, meetingTime, duration, timezone } = await request.json();

    if (!meetingTopic || !meetingTime) {
      return NextResponse.json({
        error: 'Missing required fields: meetingTopic and meetingTime are required',
      }, { status: 400 });
    }

    const meetingDetails = await createZoomMeeting({
      topic: meetingTopic,
      startTimeIso: meetingTime,
      durationMinutes: duration,
      timezone,
    });

    return NextResponse.json(meetingDetails);
  } catch (error) {
    console.error('Error creating Zoom meeting:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    await getZoomAccessToken();

    return NextResponse.json({
      success: true,
      message: 'Zoom API access configured correctly',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    }, { status: 500 });
  }
}
