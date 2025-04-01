import { DateTime } from 'luxon';
import { COACHES_CONFIG } from '@/config/coaches';
import { ConfirmationEmailProps } from '@/types/email';

export function getCoachConfirmationEmail(bookingDetails: ConfirmationEmailProps) {
  const userName = bookingDetails.user_name || bookingDetails.user_email;
  const coachName = COACHES_CONFIG[bookingDetails.coach].displayName;
  const coachTimezone = COACHES_CONFIG[bookingDetails.coach].timezone;
  
  // Format booking date in the coach's timezone
  const startDateTime = typeof bookingDetails.start_time === 'string' 
    ? DateTime.fromISO(bookingDetails.start_time) // Parse ISO string first (assume UTC or with offset)
    : DateTime.fromJSDate(bookingDetails.start_time); // Parse JS Date
  
  // Convert to Coach's Timezone for display
  const startInCoachTZ = startDateTime.setZone(coachTimezone);
  const endInCoachTZ = startInCoachTZ.plus({ hours: 1 });
  
  // Keep user timezone for display at the bottom
  const userTimezoneDisplay = bookingDetails.user_timezone || 'N/A';
  
  // Get UTC offsets at the time of the booking
  const coachOffset = startInCoachTZ.toFormat('Z'); // e.g., +7
  const userOffset = startDateTime.setZone(userTimezoneDisplay !== 'N/A' ? userTimezoneDisplay : 'UTC').toFormat('Z'); // e.g., -4

  console.log('Formatting coach email time with timezone:', {
    coachTimezone: coachTimezone,
    originalDate: bookingDetails.start_time,
    formattedDate: startInCoachTZ.toFormat('EEEE, MMMM d, yyyy'),
    formattedTime: startInCoachTZ.toFormat('HH:mm')
  });

  return {
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #4CAF50;">New coaching session is confirmed!</h2>
        <p>Hello Coach ${coachName},</p>
        <p>The user ${userName} has booked the following session:</p>
        <div style="padding: 15px; border-left: 4px solid #4CAF50; background-color: #F9F9F9; margin: 20px 0;">
          <p><strong>Date:</strong> ${startInCoachTZ.toFormat('EEEE, MMMM d, yyyy')}</p>
          <p><strong>Time:</strong> ${startInCoachTZ.toFormat('HH:mm')} - ${endInCoachTZ.toFormat('HH:mm')} (${coachTimezone} UTC ${coachOffset})</p>
          <p><strong>Coach:</strong> ${coachName}</p>
          <p><strong>Coach Timezone:</strong> ${coachTimezone} (UTC ${coachOffset})</p>
          ${bookingDetails.zoom_link ? `<p><strong>Zoom Link:</strong> <a href="${bookingDetails.zoom_link}" style="color: #4285F4;">${bookingDetails.zoom_link}</a></p>` : ''}
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
            <h3 style="color: #4CAF50; margin-top: 0;">Booking Details:</h3>
            <p><strong>Booking ID:</strong> ${bookingDetails.booking_id || 'N/A'}</p>
            <p><strong>Checkout Order ID:</strong> ${bookingDetails.checkout_order_id || 'N/A'}</p>
            <p><strong>Payment Status:</strong> ${bookingDetails.payment_status || 'N/A'}</p>
            <p><strong>Payment Provider:</strong> ${bookingDetails.payment_provider ? bookingDetails.payment_provider.charAt(0).toUpperCase() + bookingDetails.payment_provider.slice(1) : 'N/A'}</p>
            <p><strong>User Timezone:</strong> ${userTimezoneDisplay} ${userTimezoneDisplay !== 'N/A' ? `(UTC ${userOffset})` : ''}</p>
          </div>
        </div>
        <p>Please join the session 5 minutes early to ensure everything is working properly.</p>
        <p style="margin-top: 30px; color: #777777; font-size: 14px; text-align: left; border-top: 1px solid #eeeeee; padding-top: 20px;">GVT Coach<br>From GVT Nomad Team</p>
      </div>
    `
  };
} 