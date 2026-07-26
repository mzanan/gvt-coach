import { sendBookingConfirmation } from '@/services/mailer';
import { CoachId, COACHES_CONFIG } from '@/config/coaches';
import { BookingDB } from '@/types/booking';
import { getBookingsByOrderId, updateBooking } from '@/lib/db/bookings';
import { createZoomMeeting, isZoomConfigured } from '@/lib/zoom';
import { getMeetingProvider } from '@/config/appConfig';

async function ensureMeetingLink(booking: BookingDB, logId: string): Promise<void> {
  try {
    if (booking.meet_link) {
      return;
    }

    const meetingProvider = await getMeetingProvider();
    if (meetingProvider !== 'zoom') {
      console.warn(`[${logId}] Fulfillment - Meeting provider '${meetingProvider}' not implemented yet, skipping meeting creation`);
      return;
    }

    if (!isZoomConfigured()) {
      console.warn(`[${logId}] Fulfillment - Zoom not configured, skipping meeting creation`);
      return;
    }

    if (!booking.booking_date || typeof booking.booking_date !== 'string') {
      console.error(`[${logId}] Fulfillment - Booking ${booking.id} has invalid booking date`);
      return;
    }

    const meetingDetails = await createZoomMeeting({
      topic: `GVT Coaching Session with ${booking.user_email}`,
      startTimeIso: new Date(booking.booking_date).toISOString(),
      durationMinutes: booking.duration,
      timezone: booking.user_timezone,
    });

    if (meetingDetails.join_url) {
      const updated = await updateBooking(booking.id, { meet_link: meetingDetails.join_url });

      if (updated) {
        booking.meet_link = meetingDetails.join_url;
      } else {
        console.error(`[${logId}] Fulfillment - Error updating booking with meet link`);
      }
    } else {
      console.error(`[${logId}] Fulfillment - Meeting created but no join_url in response:`, meetingDetails);
    }
  } catch (error) {
    console.error(`[${logId}] Fulfillment - Error creating meeting:`, error);
  }
}

export async function fulfillPaidBookings(checkoutOrderId: string, logId: string): Promise<void> {
  const bookings = await getBookingsByOrderId(checkoutOrderId);

  if (bookings.length === 0) {
    console.log(`[${logId}] Fulfillment - No booking record found with checkout_order_id ${checkoutOrderId}`);
    return;
  }

  for (const booking of bookings) {
    await ensureMeetingLink(booking, logId);

    try {
      const coachKey = booking.coach as string;
      const coachValue: CoachId | undefined =
        coachKey && Object.prototype.hasOwnProperty.call(COACHES_CONFIG, coachKey)
          ? coachKey as CoachId
          : undefined;

      await sendBookingConfirmation(
        booking.user_email,
        {
          start_time: booking.booking_date,
          end_time: new Date(new Date(booking.booking_date).getTime() + (booking.duration || 60) * 60000),
          zoom_link: booking.meet_link,
          user_name: booking.user_name,
          booking_id: booking.id,
          user_timezone: booking.user_timezone,
          coach: coachValue
        }
      );
    } catch (emailError) {
      console.error(`[${logId}] Fulfillment - Error sending confirmation email for booking ${booking.id}:`, emailError);
    }
  }
}
