import { supabase } from '@/lib/supabase/client';
import { getUserConfirmationEmail } from './email-templates/confirmation-email-user';
import { getCoachConfirmationEmail } from './email-templates/confirmation-email-coach';
import { PaymentOrderStatus } from '@/types/enums';
import { getTimezoneCookie } from '@/lib/utils/cookies';
import { COACHES_CONFIG, getCoachTimezone, CoachId } from '@/config/coaches';
import { EmailData } from "@/types/email";

export async function sendEmail(emailData: EmailData) {
  try {
    const response = await fetch('/api/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData), // Pass the whole emailData object
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error calling /api/email/send:', response.status, errorData);
      throw new Error(`Failed to send email: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    return { success: true, data: result.data }; // Return success and potential info from API

  } catch (error) {
    console.error('Error in sendEmail function:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
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
    coach?: CoachId;
  }
) {
  let userTimezone: string | null | undefined = bookingDetails.user_timezone;

  try {
    const selectedCoach: CoachId = bookingDetails.coach as CoachId;
    
    if (!selectedCoach || !(selectedCoach in COACHES_CONFIG)) {
      console.error('[MAILER ERROR] Invalid or missing coach in bookingDetails! Cannot determine correct coach.', bookingDetails);
      return { success: false, error: 'Invalid coach specified' };
    }
    
    const coachConfig = COACHES_CONFIG[selectedCoach];
    const coachEmail = coachConfig?.email;
    getCoachTimezone(selectedCoach);

    // 1. Check/Mark flag in DB to prevent duplicates
    if (bookingDetails.booking_id) {
      // Check if email was already sent
      const { data: booking } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('confirmation_email_sent')
        .eq('id', bookingDetails.booking_id)
        .single();

      if (booking?.confirmation_email_sent) {
        return { success: true, alreadySent: true };
      }
      
      // Mark as sent IMMEDIATELY before sending any email
      await supabase
        .from('gvt_coach_meetings_bookings')
        .update({ confirmation_email_sent: true })
        .eq('id', bookingDetails.booking_id);
    }

    // 2. Get user timezone from booking data, cookie, or fall back to UTC
    if (!userTimezone && typeof window !== 'undefined') {
      const cookieTimezone = getTimezoneCookie();
      if (cookieTimezone) {
        userTimezone = cookieTimezone;
      }
    }
    
    // If still no timezone, check the database if we have a booking ID
    if (!userTimezone && bookingDetails.booking_id) {
      const { data: bookingData } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('user_timezone')
        .eq('id', bookingDetails.booking_id)
        .single();
        
      if (bookingData?.user_timezone) {
        userTimezone = bookingData.user_timezone;
      }
    }
    
    // Fallback to UTC if no timezone found
    if (!userTimezone) {
      userTimezone = 'UTC';
      console.log('No timezone found, defaulting to UTC for user email');
    }

    // 3. Prepare and send email to user
    const userName = bookingDetails.user_name || to;
    const userEmailContent = getUserConfirmationEmail({
      start_time: bookingDetails.start_time,
      end_time: bookingDetails.end_time,
      zoom_link: bookingDetails.zoom_link,
      user_name: userName,
      user_email: to,
      user_timezone: userTimezone,
      coach: selectedCoach
    });

    await sendEmail({
      to,
      subject: `New GVT Coaching Session Confirmed with ${COACHES_CONFIG[selectedCoach].displayName}! 🎉`,
      html: userEmailContent.html
    });
    console.log(`[MAILER] User confirmation email sent to ${to} for coach ${selectedCoach}`);

    // 4. Send email to coach if configured
    if (coachEmail) {
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

      console.log(`[MAILER] Attempting to send confirmation to coach ${selectedCoach} at ${coachEmail}`);
      const coachEmailContent = getCoachConfirmationEmail({
        start_time: bookingDetails.start_time,
        end_time: bookingDetails.end_time,
        zoom_link: bookingDetails.zoom_link,
        user_name: userName,
        user_email: to,
        user_timezone: userTimezone,
        booking_id: bookingDetails.booking_id || 'Unknown',
        checkout_order_id: bookingInfo.checkout_order_id,
        payment_status: PaymentOrderStatus.Paid,
        payment_confirmed: true,
        payment_provider: bookingInfo.provider,
        coach: selectedCoach
      });

      await sendEmail({
        to: coachEmail,
        subject: `New Coaching Session Booked with ${to}`,
        html: coachEmailContent.html
      });

      console.log(`[MAILER] Coach confirmation email sent successfully to ${coachEmail}`);
    } else {
      console.warn(`[MAILER] No email configured for coach ${selectedCoach}. Skipping coach email.`);
    }

    console.log('[MAILER] All confirmation emails processed successfully');
    return { success: true };
  } catch (error) {
    console.error('[MAILER] Error sending confirmation email:', error);
    
    // In case of error, try to unmark the flag to allow retries
    if (bookingDetails.booking_id) {
      try {
        await supabase
          .from('gvt_coach_meetings_bookings')
          .update({ confirmation_email_sent: false })
          .eq('id', bookingDetails.booking_id);
      } catch (dbError) {
        console.error('Could not unmark the flag:', dbError);
      }
    }
    
    throw error;
  }
}
