import { getUserConfirmationEmail } from './email-templates/confirmation-email-user';
import { getCoachConfirmationEmail } from './email-templates/confirmation-email-coach';
import { PaymentOrderStatus } from '@/types/enums';
import { getTimezoneCookie } from '@/lib/utils/cookies';
import { COACHES_CONFIG, getCoachTimezone, CoachId } from '@/config/coaches';
import { DEFAULT_TIMEZONE } from '@/config/site';
import { EmailData } from '@/types/email';
import { BookingDB } from '@/types/booking';

function apiUrl(path: string): string {
  if (typeof window !== 'undefined') {
    return path;
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${base}${path}`;
}

async function fetchBooking(bookingId: string): Promise<BookingDB | null> {
  try {
    const response = await fetch(apiUrl(`/api/bookings/${encodeURIComponent(bookingId)}`));
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function patchBooking(bookingId: string, fields: Record<string, unknown>): Promise<void> {
  await fetch(apiUrl(`/api/bookings/${encodeURIComponent(bookingId)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  });
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

    if (!selectedCoach || !(selectedCoach in COACHES_CONFIG)) {
      console.error('[MAILER ERROR] Invalid or missing coach in bookingDetails! Cannot determine correct coach.', bookingDetails);
      return { success: false, error: 'Invalid coach specified' };
    }

    const coachConfig = COACHES_CONFIG[selectedCoach];
    const coachEmail = coachConfig?.email;
    getCoachTimezone(selectedCoach);

    let bookingRecord: BookingDB | null = null;

    if (bookingDetails.booking_id) {
      bookingRecord = await fetchBooking(bookingDetails.booking_id);

      if (bookingRecord?.confirmation_email_sent) {
        return { success: true, alreadySent: true };
      }

      await patchBooking(bookingDetails.booking_id, { confirmation_email_sent: true });
    }

    if (!userTimezone && typeof window !== 'undefined') {
      const cookieTimezone = getTimezoneCookie();
      if (cookieTimezone) {
        userTimezone = cookieTimezone;
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
    });

    await sendEmail({
      to,
      subject: `New GVT Coaching Session Confirmed with ${COACHES_CONFIG[selectedCoach].displayName}! 🎉`,
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
          const mappingResponse = await fetch(apiUrl(`/api/payments/mapping/${encodeURIComponent(bookingRecord.checkout_order_id)}`));
          if (mappingResponse.ok) {
            const mappingData = await mappingResponse.json();
            if (mappingData?.provider) {
              bookingInfo.provider = mappingData.provider.charAt(0).toUpperCase() +
                                     mappingData.provider.slice(1);
            }
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
      });

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
        await patchBooking(bookingDetails.booking_id, { confirmation_email_sent: false });
      } catch (dbError) {
        console.error('Could not unmark the flag:', dbError);
      }
    }

    throw error;
  }
}
