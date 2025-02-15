const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID!
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID!
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET!

export const zoomService = {
  getAccessToken: async () => {
    try {
      const tokenUrl = 'https://zoom.us/oauth/token';
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'account_credentials',
          account_id: ZOOM_ACCOUNT_ID,
          client_id: ZOOM_CLIENT_ID,
          client_secret: ZOOM_CLIENT_SECRET
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to get access token: ${errorData.message}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  },

  createMeeting: async (startTime: Date): Promise<string> => {
    try {
      const access_token = await zoomService.getAccessToken();
      
      const response = await fetch(`https://api.zoom.us/v2/users/${process.env.ZOOM_USER_EMAIL}/meetings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic: 'Crypto Trading Consultation',
          type: 2,
          start_time: startTime.toISOString(),
          duration: 60,
          timezone: 'UTC'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create meeting');
      }

      return data.join_url;
    } catch (error) {
      console.error('Error creating meeting:', error);
      throw new Error('Failed to create meeting');
    }
  }
};