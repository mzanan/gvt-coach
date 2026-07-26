import { DEFAULT_TIMEZONE } from '@/config/site';

interface ZoomMeetingParams {
  topic: string;
  startTimeIso: string;
  durationMinutes?: number;
  timezone?: string | null;
}

interface ZoomMeetingDetails {
  id: string;
  join_url: string;
  [key: string]: unknown;
}

export function isZoomConfigured(): boolean {
  return Boolean(
    process.env.GVT_COACH_ZOOM_ACCOUNT_ID &&
    process.env.GVT_COACH_ZOOM_CLIENT_ID &&
    process.env.GVT_COACH_ZOOM_CLIENT_SECRET
  );
}

export async function getZoomAccessToken(): Promise<string> {
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
      grant_type: 'account_credentials',
      account_id: accountId,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Error getting Zoom token: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json();

  if (!tokenData.access_token) {
    throw new Error('No access token in Zoom response');
  }

  return tokenData.access_token;
}

export function buildZoomMeetingPayload({ topic, startTimeIso, durationMinutes, timezone }: ZoomMeetingParams) {
  return {
    topic,
    type: 2,
    start_time: startTimeIso,
    duration: durationMinutes || 60,
    timezone: timezone || DEFAULT_TIMEZONE,
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: true,
      waiting_room: false,
      mute_upon_entry: false,
      auto_recording: 'none',
    },
  };
}

export async function createZoomMeeting(params: ZoomMeetingParams): Promise<ZoomMeetingDetails> {
  const accessToken = await getZoomAccessToken();
  const meetingData = buildZoomMeetingPayload(params);

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
    throw new Error(`Error creating Zoom meeting: ${meetingResponse.status} - ${errorText}`);
  }

  return meetingResponse.json();
}
