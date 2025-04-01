import { DateTime } from 'luxon';
import { COACHES_CONFIG } from '@/config/coaches';
import { ConfirmationEmailProps } from '@/types/email';

export function getUserConfirmationEmail(bookingDetails: ConfirmationEmailProps) {
  const userName = bookingDetails.user_name || bookingDetails.user_email;
  const coachName = COACHES_CONFIG[bookingDetails.coach].displayName;
  const coachTimezone = COACHES_CONFIG[bookingDetails.coach].timezone;
  const userTimezone = bookingDetails.user_timezone || 'UTC';
  
  // Format date and time in the user's timezone
  const startDateTime = typeof bookingDetails.start_time === 'string' 
    ? DateTime.fromISO(bookingDetails.start_time).setZone(userTimezone)
    : DateTime.fromJSDate(bookingDetails.start_time).setZone(userTimezone);

  // Calculate end time based on start time
  const endDateTime = startDateTime.plus({ hours: 1 });
  
  // Get UTC offsets at the time of the booking
  const userOffset = startDateTime.toFormat('Z'); // e.g., +7
  const coachOffset = startDateTime.setZone(coachTimezone).toFormat('Z'); // e.g., -4

  console.log('Formatting user email time with timezone:', {
    timezone: userTimezone,
    originalDate: bookingDetails.start_time,
    formattedDate: startDateTime.toFormat('EEEE, MMMM d, yyyy'),
    formattedTime: startDateTime.toFormat('HH:mm')
  });

  return {
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #4CAF50;">New coaching session is confirmed with Coach ${coachName}!</h2>
        <p>Hello ${userName},</p>
        <div style="padding: 15px; border-left: 4px solid #4CAF50; background-color: #F9F9F9; margin: 20px 0;">
          <p><strong>Coach:</strong> ${coachName}</p>
          <p><strong>Coach Timezone:</strong> ${coachTimezone} (UTC ${coachOffset})</p>
          <p><strong>Date:</strong> ${startDateTime.toFormat('EEEE, MMMM d, yyyy')}</p>
          <p><strong>Time:</strong> ${startDateTime.toFormat('HH:mm')} - ${endDateTime.toFormat('HH:mm')} (${userTimezone} UTC ${userOffset})</p>
          ${bookingDetails.zoom_link ? `<p><strong>Zoom Link:</strong> <a href="${bookingDetails.zoom_link}" style="color: #4285F4;">${bookingDetails.zoom_link}</a></p>` : ''}
        </div>
        <p>Please join the session 5 minutes early to ensure everything is working properly.</p>
        <p style="margin-top: 30px; color: #777777; font-size: 14px; text-align: left; border-top: 1px solid #eeeeee; padding-top: 20px;">GVT Coach<br>From GVT Nomad Team</p>
      </div>
    `
  };
} 