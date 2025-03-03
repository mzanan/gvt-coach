import { NextRequest, NextResponse } from 'next/server';
import { 
  sendBookingConfirmation,
  sendSessionReminder,
  sendCancellationNotification
} from '@/lib/services/mailer';

// Tipos de notificaciones disponibles
type NotificationType = 'confirmation' | 'reminder' | 'cancellation';

// Endpoint para enviar notificaciones relacionadas con reservas
export async function POST(req: NextRequest) {
  try {
    // Extraemos los datos de la solicitud
    const data = await req.json();
    const { 
      to, 
      type, 
      bookingDetails 
    } = data;

    // Validamos los datos mínimos necesarios
    if (!to || !type || !bookingDetails) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos para la notificación' },
        { status: 400 }
      );
    }

    // Validamos el tipo de notificación
    if (!['confirmation', 'reminder', 'cancellation'].includes(type)) {
      return NextResponse.json(
        { error: 'Tipo de notificación inválido' },
        { status: 400 }
      );
    }

    // Validamos los datos de la reserva según el tipo de notificación
    if ((type === 'confirmation' || type === 'reminder') && 
        (!bookingDetails.start_time || !bookingDetails.end_time)) {
      return NextResponse.json(
        { error: 'Faltan horarios de la reserva' },
        { status: 400 }
      );
    }

    if (type === 'cancellation' && !bookingDetails.start_time) {
      return NextResponse.json(
        { error: 'Falta horario de la reserva cancelada' },
        { status: 400 }
      );
    }

    // Enviamos la notificación según el tipo
    let result;
    
    switch (type as NotificationType) {
      case 'confirmation':
        result = await sendBookingConfirmation(to, bookingDetails);
        break;
      case 'reminder':
        result = await sendSessionReminder(to, bookingDetails);
        break;
      case 'cancellation':
        result = await sendCancellationNotification(to, bookingDetails);
        break;
    }

    if (!result.success) {
      return NextResponse.json(
        { error: 'Error al enviar la notificación', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error en el endpoint de notificaciones de reserva:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
} 