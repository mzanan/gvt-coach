import { NextResponse } from 'next/server';
import { bookingService } from '@/app/services/bookingService';
import { DateTime } from 'luxon';

export async function POST(request: Request) {
  try {
    const event = await request.json();
    
    if (event.meta.event_name === 'order_created') {
      const { customData } = event.data.attributes;
      
      if (customData.frequency === 'twice-weekly' && customData.firstSlot && customData.secondSlot) {
        // Crear primera reserva
        await bookingService.createBooking(
          customData.userEmail,
          new Date(customData.firstSlot.date),
          customData.frequency,
          DateTime.fromJSDate(new Date(customData.firstSlot.date))
            .plus({ months: customData.duration })
            .toJSDate()
        );

        // Crear segunda reserva
        await bookingService.createBooking(
          customData.userEmail,
          new Date(customData.secondSlot.date),
          customData.frequency,
          DateTime.fromJSDate(new Date(customData.secondSlot.date))
            .plus({ months: customData.duration })
            .toJSDate()
        );
      } else {
        await bookingService.createBooking(
          customData.userEmail,
          new Date(customData.firstSlot.date),
          customData.frequency,
          customData.frequency !== 'once' 
            ? DateTime.fromJSDate(new Date(customData.firstSlot.date))
                .plus({ months: customData.duration })
                .toJSDate()
            : null
        );
      }
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