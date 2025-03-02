import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/services/mailer';

// Verificamos que la solicitud viene de una fuente autorizada
async function validateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'Falta token de autorización' };
  }

  const token = authHeader.substring(7); // Quitar 'Bearer ' del token
  
  // Validar sesión con Supabase
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data.user) {
    return { isValid: false, error: 'Token inválido o usuario no autenticado' };
  }

  return { isValid: true, user: data.user };
}

// Endpoint para enviar un correo electrónico genérico
export async function POST(req: NextRequest) {
  try {
    // Validamos la solicitud
    const validation = await validateRequest(req);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 401 }
      );
    }

    // Extraemos los datos del correo del cuerpo de la solicitud
    const data = await req.json();
    const { to, subject, html, text, cc, bcc } = data;

    // Validamos los datos mínimos necesarios
    if (!to || (!subject && !html && !text)) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos para el envío del correo' },
        { status: 400 }
      );
    }

    // Enviamos el correo
    const result = await sendEmail({
      to,
      subject,
      html,
      text,
      cc,
      bcc,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Error al enviar el correo', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en el endpoint de envío de correos:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
} 