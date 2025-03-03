/**
 * Email templates file
 * Centralizes all HTML templates for application emails
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Helper function to generate iCalendar content
 */
function generateICalendarEvent(
  startTime: Date,
  endTime: Date,
  userName: string,
  userEmail: string,
  zoomLink?: string
) {
  const eventUID = uuidv4();
  const organizerEmail = process.env.GMAIL_USER || 'noreply@gvtcoach.com';
  
  return `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${eventUID}
DTSTART:${startTime.toISOString().replace(/[-:]/g, "").split(".")[0]}Z
DTEND:${endTime.toISOString().replace(/[-:]/g, "").split(".")[0]}Z
SUMMARY:GVT Coaching Session
DESCRIPTION:Your coaching session is scheduled.${zoomLink ? `\\n\\nZoom Link: ${zoomLink}` : ''}
LOCATION:${zoomLink || 'Online'}
ORGANIZER;CN=GVT Coach:mailto:${organizerEmail}
ATTENDEE;RSVP=TRUE;CN=${userName}:mailto:${userEmail}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
}

/**
 * Booking confirmation template
 */
export function getBookingConfirmationTemplate(
  bookingDetails: { 
    start_time: string | Date, 
    end_time: string | Date, 
    zoom_link?: string,
    user_name?: string,
    user_email: string
  }
) {
  const userName = bookingDetails.user_name || 'User';
  const startTime = new Date(bookingDetails.start_time);
  const endTime = new Date(startTime.getTime());
  endTime.setHours(endTime.getHours() + 1);

  // Generate iCalendar content
  const calendarEvent = generateICalendarEvent(
    startTime,
    endTime,
    userName,
    bookingDetails.user_email,
    bookingDetails.zoom_link
  );

  return {
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #4CAF50;">Your coaching session is confirmed!</h2>
        <p>Hello ${userName},</p>
        <p>Your session has been successfully scheduled:</p>
        <div style="padding: 15px; border-left: 4px solid #4CAF50; background-color: #F9F9F9; margin: 20px 0;">
          <p><strong>Date:</strong> ${startTime.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p><strong>Time:</strong> ${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          ${bookingDetails.zoom_link ? `<p><strong>Zoom Link:</strong> <a href="${bookingDetails.zoom_link}" style="color: #4285F4;">${bookingDetails.zoom_link}</a></p>` : ''}
        </div>
        <p>Please join the session 5 minutes early to ensure everything is working properly.</p>
        <p>If you need to reschedule or cancel your session, please contact us at least 24 hours in advance.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 14px; color: #666;">Looking forward to seeing you soon!</p>
        <p style="font-size: 14px; color: #666;">The GVT Coach Team</p>
      </div>
    `,
    icalEvent: {
      method: 'REQUEST',
      content: calendarEvent
    }
  };
}

/**
 * Session reminder template (24 hours before)
 */
export function getSessionReminderTemplate(
  bookingDetails: { 
    start_time: string | Date, 
    end_time: string | Date, 
    zoom_link?: string,
    user_name?: string,
    user_email: string
  }
) {
  const userName = bookingDetails.user_name || 'User';
  const startTime = new Date(bookingDetails.start_time);
  const endTime = new Date(startTime.getTime());
  endTime.setHours(endTime.getHours() + 1);

  // Generate iCalendar content
  const calendarEvent = generateICalendarEvent(
    startTime,
    endTime,
    userName,
    bookingDetails.user_email,
    bookingDetails.zoom_link
  );

  return {
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #FF9800;">Reminder: Your coaching session is tomorrow</h2>
        <p>Hello ${userName},</p>
        <p>This is a reminder that your coaching session is scheduled for tomorrow:</p>
        <div style="padding: 15px; border-left: 4px solid #FF9800; background-color: #F9F9F9; margin: 20px 0;">
          <p><strong>Date:</strong> ${startTime.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p><strong>Time:</strong> ${startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
          ${bookingDetails.zoom_link ? `<p><strong>Zoom Link:</strong> <a href="${bookingDetails.zoom_link}" style="color: #4285F4;">${bookingDetails.zoom_link}</a></p>` : ''}
        </div>
        <p>Some tips to make the most of your session:</p>
        <ul style="padding-left: 20px;">
          <li>Connect from a quiet place without interruptions</li>
          <li>Prepare any questions or topics you want to discuss</li>
          <li>Make sure your camera and microphone are working properly</li>
        </ul>
        <p>See you tomorrow!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 14px; color: #666;">The GVT Coach Team</p>
      </div>
    `,
    icalEvent: {
      method: 'REQUEST',
      content: calendarEvent
    }
  };
}

/**
 * Session cancellation template
 */
export function getCancellationTemplate(
  bookingDetails: { 
    start_time: string | Date,
    user_name?: string
  }
) {
  const userName = bookingDetails.user_name || 'User';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #F44336;">Session Cancelled</h2>
      <p>Hello ${userName},</p>
      <p>Your coaching session scheduled for ${new Date(bookingDetails.start_time).toLocaleString()} has been cancelled.</p>
      <p>If you would like to reschedule, you can do so through our platform at any time.</p>
      <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 14px; color: #666;">The GVT Coach Team</p>
    </div>
  `;
}

/**
 * Session summary template
 */
export function getSessionSummaryTemplate(
  sessionDetails: {
    date: string | Date,
    summary: string,
    next_steps?: string[],
    resources?: Array<{title: string, url: string}>,
    user_name?: string
  }
) {
  const userName = sessionDetails.user_name || 'User';
  const nextStepsHtml = sessionDetails.next_steps && sessionDetails.next_steps.length > 0
    ? `
      <h3 style="color: #4CAF50;">Next Steps</h3>
      <ul style="padding-left: 20px;">
        ${sessionDetails.next_steps.map(step => `<li>${step}</li>`).join('')}
      </ul>
    `
    : '';
  
  const resourcesHtml = sessionDetails.resources && sessionDetails.resources.length > 0
    ? `
      <h3 style="color: #4CAF50;">Recommended Resources</h3>
      <ul style="padding-left: 20px;">
        ${sessionDetails.resources.map(resource => 
          `<li><a href="${resource.url}" style="color: #4285F4;">${resource.title}</a></li>`
        ).join('')}
      </ul>
    `
    : '';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #4CAF50;">Your Coaching Session Summary</h2>
      <p>Hello ${userName},</p>
      <p>Thank you for attending our session on ${new Date(sessionDetails.date).toLocaleDateString()}. Here's a summary of what we discussed:</p>
      
      <div style="padding: 15px; border-left: 4px solid #4CAF50; background-color: #F9F9F9; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #4CAF50;">Summary</h3>
        <p>${sessionDetails.summary}</p>
      </div>
      
      ${nextStepsHtml}
      ${resourcesHtml}
      
      <p>If you have any questions about these points or need clarification, please don't hesitate to contact us.</p>
      <p>Looking forward to seeing you again soon!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 14px; color: #666;">The GVT Coach Team</p>
    </div>
  `;
} 