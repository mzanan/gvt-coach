import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // First get an access token
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: accountId!,
        client_id: clientId!,
        client_secret: clientSecret!
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }

    const { access_token } = await tokenResponse.json();

    // Then create the meeting
    const { startTime } = await request.json();
    
    const meetingResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic: 'Coaching Session',
        type: 2, // Scheduled meeting
        start_time: new Date(startTime).toISOString(),
        duration: 60,
        timezone: 'UTC'
      })
    });

    if (!meetingResponse.ok) {
      throw new Error('Failed to create Zoom meeting');
    }

    const meetingData = await meetingResponse.json();
    return NextResponse.json({ join_url: meetingData.join_url });

  } catch (error) {
    console.error('Error creating zoom meeting:', error);
    return NextResponse.json(
      { error: 'Failed to create meeting' },
      { status: 500 }
    );
  }
}

// Keep the GET route for token generation
export async function GET() {
  try {
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: accountId!,
        client_id: clientId!,
        client_secret: clientSecret!
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get access token');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting zoom token:', error);
    return NextResponse.json(
      { error: 'Failed to get access token' },
      { status: 500 }
    );
  }
}