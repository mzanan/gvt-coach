import { NextRequest, NextResponse } from 'next/server';
import { insertSessionSummary } from '@/lib/db/payments';

function validateRequest(req: NextRequest) {
  const secret = process.env.GVT_COACH_API_SECRET;

  if (!secret) {
    return { isValid: false, error: 'Endpoint not configured' };
  }

  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'Falta token de autorización' };
  }

  const token = authHeader.substring(7);

  if (token !== secret) {
    return { isValid: false, error: 'Token inválido' };
  }

  return { isValid: true };
}

export async function POST(req: NextRequest) {
  try {
    const validation = validateRequest(req);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 401 }
      );
    }

    const data = await req.json();
    const { to, sessionDetails } = data;

    if (!to || !sessionDetails || !sessionDetails.date || !sessionDetails.summary) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos para el resumen de sesión' },
        { status: 400 }
      );
    }

    try {
      await insertSessionSummary({
        user_email: to,
        session_date: sessionDetails.date,
        summary: sessionDetails.summary,
        next_steps: sessionDetails.next_steps,
        resources: sessionDetails.resources,
        sent_at: new Date().toISOString()
      });
    } catch (dbError) {
      console.error('Error al guardar el resumen en la base de datos:', dbError);
    }

    return NextResponse.json({ success: true, message: 'Summary processed, email sending skipped.' });
  } catch (error) {
    console.error('Error en el endpoint de resumen de sesión:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
