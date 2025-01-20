import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { startTime } = await request.json()
    
    if (!process.env.ZOOM_ACCOUNT_ID || !process.env.ZOOM_CLIENT_ID || 
        !process.env.ZOOM_CLIENT_SECRET || !process.env.ZOOM_USER_EMAIL) {
      console.error('Missing required Zoom environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Get token using Server-Side OAuth
    const tokenResponse = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'account_credentials',
        account_id: process.env.ZOOM_ACCOUNT_ID!,
        client_id: process.env.ZOOM_CLIENT_ID!,
        client_secret: process.env.ZOOM_CLIENT_SECRET!
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Failed to get Zoom token:', errorText)
      return NextResponse.json(
        { error: 'Failed to get access token' },
        { status: 500 }
      )
    }

    const { access_token } = await tokenResponse.json()
    
    // Create Zoom meeting using the user's email
    const response = await fetch(`https://api.zoom.us/v2/users/${process.env.ZOOM_USER_EMAIL}/meetings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic: 'Crypto Trading Consultation',
        type: 2,
        start_time: startTime,
        duration: 60,
        timezone: 'UTC',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          auto_recording: 'none'
        }
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
      console.error('Zoom API error:', data)
      return NextResponse.json(
        { error: data.message || 'Failed to create meeting' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      id: data.id,
      join_url: data.join_url,
      start_url: data.start_url,
      password: data.password
    })

  } catch (error) {
    console.error('Error creating zoom meeting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 