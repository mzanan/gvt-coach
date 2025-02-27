export const getAuthToken = async (): Promise<string> => {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
        clientSecret: process.env.NEXT_PUBLIC_CLIENT_SECRET
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token error response:', errorText);
      throw new Error(`Failed to get authentication token: ${response.status}`);
    }

    const data = await response.json();
    if (!data.token) {
      throw new Error('No token received from server');
    }

    return data.token;
  } catch (error) {
    console.error('Token fetch error:', error);
    throw new Error('Authentication failed');
  }
};