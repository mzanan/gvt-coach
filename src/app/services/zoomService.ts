import { encode } from 'base-64'

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID!
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID!
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET!

export const zoomService = {
  getAccessToken: async () => {
    const tokenUrl = 'https://zoom.us/oauth/token'
    
    try {
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
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Zoom token error:', errorData)
        throw new Error(`Failed to get access token: ${errorData.message}`)
      }

      const data = await response.json()
      return data.access_token
    } catch (error) {
      console.error('Error getting access token:', error)
      throw error
    }
  },

  createMeeting: async (startTime: Date): Promise<string> => {
    try {
      const response = await fetch('/api/zoom/meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ startTime: startTime.toISOString() })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Failed to create Zoom meeting: ${data.error || 'Unknown error'}`)
      }

      if (!data.join_url) {
        throw new Error('Invalid response: missing join_url')
      }

      return data.join_url
    } catch (error) {
      console.error('Error creating Zoom meeting:', error)
      throw error
    }
  }
} 