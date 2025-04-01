import { NextRequest, NextResponse } from 'next/server';
import { 
  sendBookingConfirmation,
  sendSessionReminder,
  sendCancellationNotification
} from '@/services/mailer';
import { cookies } from 'next/headers';
import { USER_DATA_COOKIE_NAME } from '@/lib/utils/cookies';

// Available notification types
type NotificationType = 'confirmation' | 'reminder' | 'cancellation';

// Helper to get timezone from cookies in server components
function getTimezoneFromServerCookies(): string | null {
  const cookieStore = cookies();
  const userDataCookie = cookieStore.get(USER_DATA_COOKIE_NAME);
  
  if (userDataCookie?.value) {
    try {
      const userData = JSON.parse(decodeURIComponent(userDataCookie.value));
      return userData.timezone || null;
    } catch (error) {
      console.error('Error parsing user_data cookie:', error);
      return null;
    }
  }
  
  return null;
}

// Endpoint for sending booking-related notifications
export async function POST(req: NextRequest) {
  try {
    // Extract data from request
    const data = await req.json();
    const { 
      to, 
      type, 
      bookingDetails,
      userTimezone 
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

    // Get timezone from cookie if available, otherwise use provided timezone
    let timezone = userTimezone;
    
    if (!timezone) {
      // Try to get from server-side cookie
      timezone = getTimezoneFromServerCookies();
      
      if (timezone) {
        console.log('Using timezone from server cookie:', timezone);
      } else if (bookingDetails.user_timezone) {
        timezone = bookingDetails.user_timezone;
        console.log('Using timezone from booking details:', timezone);
      } else {
        console.log('No timezone found in cookie or booking details, using default');
      }
    }

    // Send notification based on type
    let result;
    
    switch (type as NotificationType) {
      case 'confirmation':
        result = await sendBookingConfirmation(to, {
          ...bookingDetails,
          user_timezone: timezone || bookingDetails.user_timezone
        });
        break;
      case 'reminder':
        result = await sendSessionReminder(to, {
          ...bookingDetails,
          user_timezone: timezone || bookingDetails.user_timezone
        });
        break;
      case 'cancellation':
        result = await sendCancellationNotification(to, {
          ...bookingDetails,
          user_timezone: timezone || bookingDetails.user_timezone
        });
        break;
    }

    if (!result.success) {
      return NextResponse.json(
        { error: 'Error sending notification', details: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${type} notification sent successfully`
    });
  } catch (error) {
    console.error('Error processing notification request:', error);
    return NextResponse.json(
      { error: 'Error processing request' },
      { status: 500 }
    );
  }
} 