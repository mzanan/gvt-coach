import { NextResponse } from 'next/server';
import { bookingService } from '@/app/services/bookingService';
import { DateTime } from 'luxon';
import { zoomService } from '@/app/services/zoomService';
import { supabase } from '@/lib/supabase/client';

export async function POST(request: Request) {
  try {
    const event = await request.json();
    
    if (event.meta.event_name === 'order_created') {
      const { customData } = event.data.attributes;
      
      if (customData.frequency === 'twice-weekly' && customData.firstSlot && customData.secondSlot) {
        // Create first booking without Zoom URL
        await bookingService.createBooking(
          customData.userEmail,
          new Date(customData.firstSlot.date),
          customData.frequency,
          DateTime.fromJSDate(new Date(customData.firstSlot.date))
            .plus({ months: customData.duration })
            .toJSDate(),
          undefined
        );

        // Create second booking without Zoom URL
        await bookingService.createBooking(
          customData.userEmail,
          new Date(customData.secondSlot.date),
          customData.frequency,
          DateTime.fromJSDate(new Date(customData.secondSlot.date))
            .plus({ months: customData.duration })
            .toJSDate(),
          undefined
        );
      } else {
        // Create single booking without Zoom URL
        await bookingService.createBooking(
          customData.userEmail,
          new Date(customData.firstSlot.date),
          customData.frequency,
          customData.frequency !== 'once' 
            ? DateTime.fromJSDate(new Date(customData.firstSlot.date))
                .plus({ months: customData.duration })
                .toJSDate()
            : null,
          undefined
        );
      }
    }

    if (event.meta.event_name === 'payment_success') {
      const { customData } = event.data.attributes;
      const { bookingId } = customData;

      // Crear URL de Zoom después del pago exitoso
      const meetingUrl = await zoomService.createMeeting(new Date(customData.selectedSlot.date));

      // Actualizar booking con URL de Zoom y estado confirmado
      await supabase
        .from('meetings_bookings')
        .update({ 
          meet_link: meetingUrl,
          status: 'confirmed'
        })
        .eq('id', bookingId);
    }

    if (event.meta.event_name === 'payment_failed') {
      const { customData } = event.data.attributes;
      const { bookingId } = customData;

      // Delete the pending booking to free up the slot
      await supabase
        .from('meetings_bookings')
        .delete()
        .eq('id', bookingId);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}