import { NextRequest, NextResponse } from 'next/server';
import { 
  sendBookingConfirmation,
  sendSessionReminder,
  sendCancellationNotification
} from '@/services/mailer';

// Available notification types
type NotificationType = 'confirmation' | 'reminder' | 'cancellation';

// Endpoint for sending booking-related notifications
export async function POST(req: NextRequest) {
  try {
    // Extract data from request
    const data = await req.json();
    const { 
      to, 
      type, 
      bookingDetails 
    } = data;

    // Validate required data
    if (!to || !type || !bookingDetails) {
      return NextResponse.json(
        { error: 'Missing required data for notification' },
        { status: 400 }
      );
    }

    // Validate notification type
    if (!['confirmation', 'reminder', 'cancellation'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      );
    }

    // Validate booking data based on notification type
    if ((type === 'confirmation' || type === 'reminder') && 
        (!bookingDetails.start_time || !bookingDetails.end_time)) {
      return NextResponse.json(
        { error: 'Missing booking times' },
        { status: 400 }
      );
    }

    if (type === 'cancellation' && !bookingDetails.start_time) {
      return NextResponse.json(
        { error: 'Missing cancelled booking time' },
        { status: 400 }
      );
    }

    // Send notification based on type
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
        { error: 'Error sending notification', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Error in booking notification endpoint:', error);
    return NextResponse.json(
      { error: 'Error processing request' },
      { status: 500 }
    );
  }
} 