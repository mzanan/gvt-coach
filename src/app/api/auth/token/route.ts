import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    console.log('Token API: Procesando solicitud de token');
    
    const { clientId, clientSecret } = await request.json();

    if (!clientId || !clientSecret) {
      console.log('Token API: Faltan credenciales de cliente');
      return NextResponse.json(
        { error: 'Missing client credentials' },
        { status: 400 }
      );
    }
    
    const paymentUrl = process.env.NEXT_PUBLIC_PAYMENT_URL;
    if (!paymentUrl) {
      console.error('Token API: URL de servicio de pagos no configurada');
      return NextResponse.json(
        { error: 'Payment service URL not configured' },
        { status: 500 }
      );
    }
    
    console.log(`Token API: Solicitando token a ${paymentUrl}/auth/token`);

    const response = await fetch(`${paymentUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token API: Error del servicio de autenticación:', errorText);
      return NextResponse.json(
        { error: `Authentication failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Desarrollo: proporcionar un token de desarrollo si estamos en entorno local
    if (process.env.NODE_ENV === 'development' && !data.access_token) {
      console.log('Token API: Generando token de desarrollo');
      return NextResponse.json({ 
        token: `dev-token-${clientId.substring(0, 8)}-${Date.now()}` 
      });
    }
    
    console.log('Token API: Token generado correctamente');
    
    return NextResponse.json({ token: data.access_token });

  } catch (error) {
    console.error('Token API: Error de generación de token:', error);
    
    // Para desarrollo, proporcionar un token de respaldo en caso de error
    if (process.env.NODE_ENV === 'development') {
      console.log('Token API: Generando token de desarrollo en manejo de errores');
      return NextResponse.json({ 
        token: `dev-fallback-token-${Date.now()}` 
      });
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}