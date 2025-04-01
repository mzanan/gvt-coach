import { supabase } from '@/lib/supabase/client';
import { getUserConfirmationEmail } from './email-templates/confirmation-email-user';
import { getCoachConfirmationEmail } from './email-templates/confirmation-email-coach';
import { PaymentOrderStatus } from '@/types/enums/booking';
import { getTimezoneCookie } from '@/lib/utils/cookies';
import { COACHES_CONFIG } from '@/app/config/coaches';
import { Coach } from '@/app/config/coaches';

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
    coach?: Coach;
  }
) {
  try {
    // Verificar si el coach viene en los detalles
    if (!bookingDetails.coach) {
      console.error('[MAILER ERROR] Coach missing in bookingDetails! Cannot determine correct coach.', bookingDetails);
      // Considerar lanzar un error o retornar para evitar enviar al coach equivocado
      // Por ahora, usaremos un fallback pero lo loguearemos fuertemente
      console.warn('[MAILER WARNING] Defaulting to Coach.Gabriel due to missing coach in bookingDetails.');
      bookingDetails.coach = Coach.Gabriel; // Mantener fallback temporalmente con warning
    }
    
    const selectedCoach = bookingDetails.coach;
    console.log(`[MAILER] Determined selectedCoach: ${selectedCoach}`);

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

    // 2. Get user timezone from booking data, cookie, or fall back to UTC
    let userTimezone = bookingDetails.user_timezone;
    
    // Try to get timezone from the cookie if not provided in booking details
    if (!userTimezone && typeof window !== 'undefined') {
      const cookieTimezone = getTimezoneCookie();
      if (cookieTimezone) {
        userTimezone = cookieTimezone;
        console.log('Using timezone from cookie for user email:', userTimezone);
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
        console.log('Using timezone from database for user email:', userTimezone);
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
    const coachConfig = COACHES_CONFIG[selectedCoach];
    const coachEmail = coachConfig.email;
    const coachTimezone = coachConfig.timezone;
    let reliableUserTimezoneForCoachEmail = bookingDetails.user_timezone;
    if (!reliableUserTimezoneForCoachEmail && typeof window !== 'undefined') {
      const cookieTimezone = getTimezoneCookie();
      if (cookieTimezone) reliableUserTimezoneForCoachEmail = cookieTimezone;
    }
    if (!reliableUserTimezoneForCoachEmail && bookingDetails.booking_id) {
      const { data: bookingData } = await supabase.from('gvt_coach_meetings_bookings').select('user_timezone').eq('id', bookingDetails.booking_id).single();
      if (bookingData?.user_timezone) reliableUserTimezoneForCoachEmail = bookingData.user_timezone;
    }
    reliableUserTimezoneForCoachEmail = reliableUserTimezoneForCoachEmail || 'UTC';
    console.log("[MAILER] Using user timezone for coach email info:", reliableUserTimezoneForCoachEmail);

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

      // Log coach timezone for debugging
      console.log('Sending email to coach with timezone:', coachTimezone);

      console.log(`[MAILER] Attempting to send confirmation to coach ${selectedCoach} at ${coachEmail}`);
      const coachEmailContent = getCoachConfirmationEmail({
        start_time: bookingDetails.start_time,
        end_time: bookingDetails.end_time,
        zoom_link: bookingDetails.zoom_link,
        user_name: userName,
        user_email: to,
        user_timezone: reliableUserTimezoneForCoachEmail,
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
        console.log('Flag unmarked in DB due to error in sending');
      } catch (dbError) {
        console.error('Could not unmark the flag:', dbError);
      }
    }
    
    throw error;
  }
}
