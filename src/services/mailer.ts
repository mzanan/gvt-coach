import { getUserConfirmationEmail } from './email-templates/confirmation-email-user';
import { getCoachConfirmationEmail } from './email-templates/confirmation-email-coach';
import { PaymentOrderStatus } from '@/types/enums';
import { COACHES_CONFIG, CoachId } from '@/config/coaches';
import { DEFAULT_TIMEZONE } from '@/config/site';
import { CoachConfig } from '@/types/coach';
import { EmailData } from '@/types/email';
import { BookingDB } from '@/types/booking';
import { claimConfirmationEmail, getBookingById, updateBooking } from '@/lib/db/bookings';
import { getCoach } from '@/lib/db/coaches';
import { getMappingByOrderId } from '@/lib/db/payments';

function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${base}${path}`;
}

async function fetchEffectiveCoachConfig(coachId: CoachId): Promise<CoachConfig | null> {
  const coach = await getCoach(coachId);
  return coach || COACHES_CONFIG[coachId] || null;
}

export async function sendEmail(emailData: EmailData) {
  try {
    const response = await fetch(apiUrl('/api/email/send'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error calling /api/email/send:', response.status, errorData);
      throw new Error(`Failed to send email: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error in sendEmail function:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

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
    const coachConfig = selectedCoach ? await fetchEffectiveCoachConfig(selectedCoach) : null;

    if (!coachConfig) {
      console.error('[MAILER ERROR] Invalid or missing coach in bookingDetails! Cannot determine correct coach.', bookingDetails);
      return { success: false, error: 'Invalid coach specified' };
    }

    const coachEmail = coachConfig.email;

    let bookingRecord: BookingDB | null = null;

    if (bookingDetails.booking_id) {
      bookingRecord = await getBookingById(bookingDetails.booking_id);

      const claimed = await claimConfirmationEmail(bookingDetails.booking_id);
      if (!claimed) {
        return { success: true, alreadySent: true };
      }
    }

    if (!userTimezone && bookingRecord?.user_timezone) {
      userTimezone = bookingRecord.user_timezone;
    }

    if (!userTimezone) {
      userTimezone = DEFAULT_TIMEZONE;
    }

    const userName = bookingDetails.user_name || to;
    const userEmailContent = getUserConfirmationEmail({
      start_time: bookingDetails.start_time,
      end_time: bookingDetails.end_time,
      zoom_link: bookingDetails.zoom_link,
      user_name: userName,
      user_email: to,
      user_timezone: userTimezone,
      coach: selectedCoach
    }, coachConfig);

    await sendEmail({
      to,
      subject: `New GVT Coaching Session Confirmed with ${coachConfig.displayName}! 🎉`,
      html: userEmailContent.html
    });

    if (coachEmail) {
      const bookingInfo = {
        provider: 'Unknown',
        checkout_order_id: 'Unknown'
      };

      if (bookingRecord?.checkout_order_id) {
        bookingInfo.checkout_order_id = bookingRecord.checkout_order_id;

        try {
          const mapping = await getMappingByOrderId(bookingRecord.checkout_order_id);
          if (mapping?.provider) {
            bookingInfo.provider = mapping.provider.charAt(0).toUpperCase() + mapping.provider.slice(1);
          }
        } catch {
          console.warn('[MAILER] Could not resolve payment provider for coach email');
        }
      }

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
      }, coachConfig);

      await sendEmail({
        to: coachEmail,
        subject: `New Coaching Session Booked with ${to}`,
        html: coachEmailContent.html
      });
    } else {
      console.warn(`[MAILER] No email configured for coach ${selectedCoach}. Skipping coach email.`);
    }

    return { success: true };
  } catch (error) {
    console.error('[MAILER] Error sending confirmation email:', error);

    if (bookingDetails.booking_id) {
      try {
        await updateBooking(bookingDetails.booking_id, { confirmation_email_sent: false });
      } catch (dbError) {
        console.error('Could not unmark the flag:', dbError);
      }
    }

    throw error;
  }
}
