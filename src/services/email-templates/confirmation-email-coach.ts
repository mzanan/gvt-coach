import { DateTime } from 'luxon';
import { COACHES_CONFIG } from '@/config/coaches';
import { DEFAULT_TIMEZONE } from '@/config/site';
import { CoachConfig } from '@/types/coach';
import { ConfirmationEmailProps } from '@/types/email';

export function getCoachConfirmationEmail(bookingDetails: ConfirmationEmailProps, coachConfig?: CoachConfig) {
  const coach = coachConfig || COACHES_CONFIG[bookingDetails.coach];
  const userName = bookingDetails.user_name || bookingDetails.user_email;
  const coachName = coach.displayName;
  const coachTimezone = coach.timezone;
  const userTimezone = bookingDetails.user_timezone || DEFAULT_TIMEZONE;

  const startDateTimeCoach = (typeof bookingDetails.start_time === 'string'
    ? DateTime.fromISO(bookingDetails.start_time)
    : DateTime.fromJSDate(bookingDetails.start_time)
  ).setZone(coachTimezone);

  const endDateTimeCoach = (typeof bookingDetails.end_time === 'string'
    ? DateTime.fromISO(bookingDetails.end_time)
    : DateTime.fromJSDate(bookingDetails.end_time)
  ).setZone(coachTimezone);

  const startDateTimeUser = startDateTimeCoach.setZone(userTimezone);
  const endDateTimeUser = endDateTimeCoach.setZone(userTimezone);

  const coachOffset = startDateTimeCoach.toFormat('Z');
  const userOffset = startDateTimeUser.toFormat('Z');

  return {
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #4CAF50;">New coaching session is confirmed!</h2>
        <p>Hello Coach ${coachName},</p>
        <p>The user ${userName} (${bookingDetails.user_email}) has booked the following session:</p>
        <div style="padding: 15px; border-left: 4px solid #4CAF50; background-color: #F9F9F9; margin: 20px 0;">
          <p><strong>Coach:</strong> ${coachName}</p>
          <p><strong>Date:</strong> ${startDateTimeCoach.toFormat('EEEE, MMMM d, yyyy')}</p>
          <p><strong>Time:</strong> ${startDateTimeCoach.toFormat('HH:mm')} - ${endDateTimeCoach.toFormat('HH:mm')} (${coachTimezone} UTC ${coachOffset})</p>
          ${bookingDetails.zoom_link ? `<p><strong>Zoom Link:</strong> <a href="${bookingDetails.zoom_link}" style="color: #4285F4;">${bookingDetails.zoom_link}</a></p>` : ''}
          <p><strong>Coach Timezone:</strong> ${coachTimezone} (UTC ${coachOffset})</p>
          
          <p style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 15px;"><strong>User Date:</strong> ${startDateTimeUser.toFormat('EEEE, MMMM d, yyyy')}</p>
          <p><strong>User Time:</strong> ${startDateTimeUser.toFormat('HH:mm')} - ${endDateTimeUser.toFormat('HH:mm')} (${userTimezone} UTC ${userOffset})</p>

          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
            <h3 style="color: #4CAF50; margin-top: 0;">Booking Details:</h3>
            <p><strong>Booking ID:</strong> ${bookingDetails.booking_id || 'N/A'}</p>
            <p><strong>Checkout Order ID:</strong> ${bookingDetails.checkout_order_id || 'N/A'}</p>
            <p><strong>Payment Status:</strong> ${bookingDetails.payment_status || 'N/A'}</p>
            <p><strong>Payment Provider:</strong> ${bookingDetails.payment_provider ? bookingDetails.payment_provider.charAt(0).toUpperCase() + bookingDetails.payment_provider.slice(1) : 'N/A'}</p>
          </div>
        </div>
        <p>Please join the session 5 minutes early to ensure everything is working properly.</p>
        <p style="margin-top: 30px; color: #777777; font-size: 14px; text-align: left; border-top: 1px solid #eeeeee; padding-top: 20px;">GVT Coach<br>From GVT Nomad Team</p>
      </div>
    `
  };
} 