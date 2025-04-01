import { NextRequest, NextResponse } from 'next/server';
import { sendBookingConfirmation } from '@/services/mailer';
import { cookies } from 'next/headers';
import { USER_DATA_COOKIE } from '@/lib/utils/cookies';

// Helper to get timezone from cookies in server components
async function getTimezoneFromServerCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const userDataCookie = cookieStore.get(USER_DATA_COOKIE);
  
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

    // Validate notification type - only 'confirmation' is valid
    if (type !== 'confirmation') {
      return NextResponse.json(
        { error: 'Invalid notification type specified' }, 
        { status: 400 }
      );
    }

    // Validate booking data for confirmation
    if (!bookingDetails.start_time || !bookingDetails.end_time) {
      return NextResponse.json(
        { error: 'Missing booking times for confirmation' },
        { status: 400 }
      );
    }

    // Get timezone from cookie if available, otherwise use provided timezone
    let timezone = userTimezone;
    
    if (!timezone) {
      // Try to get from server-side cookie
      timezone = await getTimezoneFromServerCookies();
      
      if (timezone) {
        console.log('Using timezone from server cookie:', timezone);
      } else if (bookingDetails.user_timezone) {
        timezone = bookingDetails.user_timezone;
        console.log('Using timezone from booking details:', timezone);
      } else {
        console.log('No timezone found in cookie or booking details, using default');
      }
    }

    // Send notification - only confirmation case remains
    let result;
    
    if (type === 'confirmation') {
      result = await sendBookingConfirmation(to, {
        ...bookingDetails,
        user_timezone: timezone || bookingDetails.user_timezone
      });
    } else {
      // This case should not be reachable due to validation above
      return NextResponse.json({ error: 'Internal error: Invalid type reached processing stage' }, { status: 500 });
    }

    if (!result || !result.success) {
      return NextResponse.json(
        { error: 'Error sending notification', details: result?.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'confirmation notification sent successfully'
    });
  } catch (error) {
    console.error('Error processing notification request:', error);
    return NextResponse.json(
      { error: 'Error processing request' },
      { status: 500 }
    );
  }
} 