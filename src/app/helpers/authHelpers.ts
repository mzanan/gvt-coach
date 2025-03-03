export const getAuthToken = async (): Promise<string> => {
  try {
    console.log('AuthHelper: Obteniendo token de API...');
    
    // Verificar que tenemos las credenciales necesarias
    if (!process.env.NEXT_PUBLIC_CLIENT_ID || !process.env.NEXT_PUBLIC_CLIENT_SECRET) {
      console.error('AuthHelper: Faltan credenciales de cliente en las variables de entorno');
      throw new Error('Credenciales de cliente no configuradas');
    }
    
    const tokenUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/token`;
    console.log(`AuthHelper: Solicitando token a ${tokenUrl}`);
    
    const response = await fetch(tokenUrl, {
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
      console.error('AuthHelper: Token error response:', errorText);
      throw new Error(`Failed to get authentication token: ${response.status}`);
    }

    const data = await response.json();
    if (!data.token) {
      console.error('AuthHelper: No token received:', data);
      throw new Error('No token received from server');
    }

    console.log('AuthHelper: Token obtenido correctamente');
    return data.token;
  } catch (error) {
    console.error('AuthHelper: Token fetch error:', error);
    throw new Error('Authentication failed');
  }
};