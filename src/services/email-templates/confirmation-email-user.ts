import { DateTime } from 'luxon';

interface UserConfirmationEmailProps {
  start_time: string | Date;
  end_time: string | Date;
  zoom_link?: string;
  user_name?: string;
  user_email: string;
  user_timezone?: string;
}

export function getUserConfirmationEmail(bookingDetails: UserConfirmationEmailProps) {
  const userName = bookingDetails.user_name || bookingDetails.user_email;
  
  const startDateTime = typeof bookingDetails.start_time === 'string' 
    ? DateTime.fromISO(bookingDetails.start_time, { zone: bookingDetails.user_timezone || 'UTC' })
    : DateTime.fromJSDate(bookingDetails.start_time, { zone: bookingDetails.user_timezone || 'UTC' });

  const endDateTime = startDateTime.plus({ hours: 1 });

  return {
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #4CAF50;">New coaching session is confirmed!</h2>
        <p>Hello ${userName},</p>
        <p>Your session has been successfully scheduled:</p>
        <div style="padding: 15px; border-left: 4px solid #4CAF50; background-color: #F9F9F9; margin: 20px 0;">
          <p><strong>Date:</strong> ${startDateTime.toFormat('EEEE, MMMM d, yyyy')}</p>
          <p><strong>Time:</strong> ${startDateTime.toFormat('HH:mm')} - ${endDateTime.toFormat('HH:mm')} ${bookingDetails.user_timezone ? `(${bookingDetails.user_timezone})` : ''}</p>
          ${bookingDetails.zoom_link ? `<p><strong>Zoom Link:</strong> <a href="${bookingDetails.zoom_link}" style="color: #4285F4;">${bookingDetails.zoom_link}</a></p>` : ''}
        </div>
        <p>Please join the session 5 minutes early to ensure everything is working properly.</p>
      </div>
    `
  };
} 