import { NextRequest, NextResponse } from 'next/server';

async function getZoomToken() {
  try {
    const accountId = process.env.GVT_COACH_ZOOM_ACCOUNT_ID;
    const clientId = process.env.GVT_COACH_ZOOM_CLIENT_ID;
    const clientSecret = process.env.GVT_COACH_ZOOM_CLIENT_SECRET;

    if (!accountId || !clientId || !clientSecret) {
      throw new Error('Missing Zoom credentials');
    }

    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        'grant_type': 'account_credentials',
        'account_id': accountId,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Error in Zoom response:', errorText);
      throw new Error(`Error getting Zoom token: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting Zoom token:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { meetingTopic, meetingTime, duration, timezone } = await request.json();

    if (!meetingTopic || !meetingTime) {
      return NextResponse.json({
        error: 'Missing required fields: meetingTopic and meetingTime are required',
      }, { status: 400 });
    }

    // Get Zoom token
    const accessToken = await getZoomToken();

    // Create Zoom meeting
    const meetingData = {
      topic: meetingTopic,
      type: 2, // Scheduled meeting
      start_time: meetingTime,
      duration: 60, 
      timezone: timezone || 'UTC',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
        mute_upon_entry: false,
      },
    };

    const meetingResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(meetingData),
    });

    if (!meetingResponse.ok) {
      const errorText = await meetingResponse.text();
      console.error('Error creating Zoom meeting:', errorText);
      throw new Error(`Error creating Zoom meeting: ${meetingResponse.status} - ${errorText}`);
    }

    const meetingDetails = await meetingResponse.json();

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
    const accountId = process.env.GVT_COACH_ZOOM_ACCOUNT_ID;
    const clientId = process.env.GVT_COACH_ZOOM_CLIENT_ID;
    const clientSecret = process.env.GVT_COACH_ZOOM_CLIENT_SECRET;

    if (!accountId || !clientId || !clientSecret) {
      throw new Error('Missing Zoom credentials');
    }

    // Just check if we can get a token without actually using it
    await getZoomToken();

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