import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSessionSummary } from '@/lib/services/mailer';

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

  // Verificar si el usuario tiene rol de coach
  const { data: userRole } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();

  if (!userRole || userRole.role !== 'coach') {
    return { isValid: false, error: 'Acceso denegado. Solo los coaches pueden enviar resúmenes de sesión.' };
  }

  return { isValid: true, user: data.user };
}

// Endpoint para enviar resúmenes de sesión
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

    // Extraemos los datos de la solicitud
    const data = await req.json();
    const { 
      to, 
      sessionDetails 
    } = data;

    // Validamos los datos mínimos necesarios
    if (!to || !sessionDetails || !sessionDetails.date || !sessionDetails.summary) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos para el resumen de sesión' },
        { status: 400 }
      );
    }

    // Enviamos el resumen de la sesión
    const result = await sendSessionSummary(to, sessionDetails);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Error al enviar el resumen de sesión', details: result.error },
        { status: 500 }
      );
    }

    // Opcionalmente, guardamos el resumen en la base de datos
    try {
      const supabase = await createClient();
      await supabase
        .from('session_summaries')
        .insert({
          user_email: to,
          session_date: sessionDetails.date,
          summary: sessionDetails.summary,
          next_steps: sessionDetails.next_steps,
          resources: sessionDetails.resources,
          sent_at: new Date().toISOString()
        });
    } catch (dbError) {
      console.error('Error al guardar el resumen en la base de datos:', dbError);
      // No fallamos la respuesta si solo falla el guardado en la base de datos
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en el endpoint de resumen de sesión:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
} 