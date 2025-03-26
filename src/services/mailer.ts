import { supabase } from '@/lib/supabase/client';
import { getUserConfirmationEmail } from './email-templates/confirmation-email-user';
import { getCoachConfirmationEmail } from './email-templates/confirmation-email-coach';

// Interface for email data
export interface EmailData {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  icalEvent?: {
    method: string;
    content: string;
  };
}

// Generic email sending function
export async function sendEmail(data: EmailData) {
  console.log('Sending email:', data);

  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error sending email');
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

/**
 * Sends a booking confirmation email
 * @param to Recipient's email
 * @param bookingDetails Booking details
 * @returns A promise with the sending result
 */
export async function sendBookingConfirmation(
  to: string,
  bookingDetails: {
    start_time: string | Date;
    end_time: string | Date;
    zoom_link: string;
    user_name?: string;
    booking_id?: string;
    user_timezone?: string;
  }
) {
  try {
    // 1. Check/Mark flag in DB to prevent duplicates
    if (bookingDetails.booking_id) {
      // Check if email was already sent
      const { data: booking } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('confirmation_email_sent')
        .eq('id', bookingDetails.booking_id)
        .single();

      if (booking?.confirmation_email_sent) {
        console.log('Email already sent according to database:', bookingDetails.booking_id);
        return { success: true, alreadySent: true };
      }
      
      // Mark as sent IMMEDIATELY before sending any email
      await supabase
        .from('gvt_coach_meetings_bookings')
        .update({ confirmation_email_sent: true })
        .eq('id', bookingDetails.booking_id);
        
      console.log('Flag marked in DB before actual sending');
    }

    // 2. Prepare and send email to user
    const userName = bookingDetails.user_name || to;
    const userEmailContent = getUserConfirmationEmail({
      start_time: bookingDetails.start_time,
      end_time: bookingDetails.end_time,
      zoom_link: bookingDetails.zoom_link,
      user_name: userName,
      user_email: to,
      user_timezone: bookingDetails.user_timezone
    });

    await sendEmail({
      to,
      subject: 'New GVT Coaching Session Confirmed! 🎉',
      html: userEmailContent.html
    });

    // 3. Send email to coach if configured
    const coachEmail = process.env.NEXT_PUBLIC_GVT_COACH_COACH_EMAIL;
    const coachTimezone = process.env.NEXT_PUBLIC_GVT_COACH_COACH_TIMEZONE;

    if (coachEmail && coachTimezone) {
      // Initial basic booking data
      const bookingInfo = {
        provider: 'Unknown',
        checkout_order_id: 'Unknown'
      };
      
      // Get payment provider and checkout_order_id if booking ID exists
      if (bookingDetails.booking_id) {
        const { data } = await supabase
          .from('gvt_coach_meetings_bookings')
          .select('checkout_order_id, payment_status, payment_confirmed')
          .eq('id', bookingDetails.booking_id)
          .single();

        if (data?.checkout_order_id) {
          // Store the checkout_order_id
          bookingInfo.checkout_order_id = data.checkout_order_id;
          
          // Get provider from the mapping table
          const { data: mappingData } = await supabase
            .from('gvt_coach_checkout_mapping')
            .select('provider')
            .eq('checkout_order_id', data.checkout_order_id)
            .single();
          
          if (mappingData?.provider) {
            bookingInfo.provider = mappingData.provider.charAt(0).toUpperCase() + 
                                  mappingData.provider.slice(1);
          }
        }
      }

      // Generate and send email to coach
      const coachEmailContent = getCoachConfirmationEmail({
        start_time: bookingDetails.start_time,
        end_time: bookingDetails.end_time,
        zoom_link: bookingDetails.zoom_link,
        user_name: userName,
        user_email: to,
        user_timezone: coachTimezone,
        booking_id: bookingDetails.booking_id || 'Unknown',
        checkout_order_id: bookingInfo.checkout_order_id, // Use the retrieved checkout_order_id
        payment_status: 'Confirmed', // Simplified
        payment_confirmed: true, // Simplified
        payment_provider: bookingInfo.provider
      });

      await sendEmail({
        to: coachEmail,
        subject: `New Coaching Session Booked with ${to}`,
        html: coachEmailContent.html
      });

      console.log('Coach confirmation email sent successfully');
    }

    console.log('All confirmation emails sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    
    // In case of error, try to unmark the flag to allow retries
    if (bookingDetails.booking_id) {
      try {
        await supabase
          .from('gvt_coach_meetings_bookings')
          .update({ confirmation_email_sent: false })
          .eq('id', bookingDetails.booking_id);
        console.log('Flag unmarked in DB due to error in sending');
      } catch (dbError) {
        console.error('Could not unmark the flag:', dbError);
      }
    }
    
    throw error;
  }
}
