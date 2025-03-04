import nodemailer from 'nodemailer';
import { 
  getBookingConfirmationTemplate,
  getSessionReminderTemplate,
  getCancellationTemplate,
  getSessionSummaryTemplate 
} from './email-templates';

// Nodemailer transporter configuration for Resend SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 465,
  secure: true, // true for 465 (SSL/TLS)
  auth: {
    user: 'resend', // Fixed username for Resend
    pass: process.env.RESEND_API_KEY, // Your Resend API key
  },
});

// Verify transporter configuration (optional but recommended)
if (process.env.NODE_ENV !== 'production') {
  transporter.verify(function(error, success) {
    if (error) {
      console.error('Error in SMTP server configuration:', error);
      console.error('Make sure to properly configure RESEND_API_KEY and FROM_EMAIL in .env.local');
      console.error('Current values:', {
        RESEND_API_KEY: process.env.RESEND_API_KEY ? '******' : 'not configured',
        FROM_EMAIL: process.env.FROM_EMAIL || 'not configured'
      });
    } else {
      console.log('✅ SMTP server is ready to send messages');
    }
  });
}

// Email address configuration
const FROM_NAME = 'GVT Coach';
const defaultFromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
const formattedFromEmail = `${FROM_NAME} <${defaultFromEmail}>`;

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
    const mailOptions = {
      from: formattedFromEmail,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text,
      replyTo: data.replyTo || formattedFromEmail,
      cc: data.cc,
      bcc: data.bcc,
      icalEvent: data.icalEvent
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, data: info };
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
    start_time: string | Date, 
    end_time: string | Date, 
    zoom_link?: string,
    user_name?: string
  }
) {
  const subject = `Confirmation of your coaching session`;
  const emailContent = getBookingConfirmationTemplate({
    ...bookingDetails,
    user_email: to
  });

  return sendEmail({
    to,
    subject,
    html: emailContent.html,
    // icalEvent: emailContent.icalEvent // FUTURE IMPLEMENTATION
  });
}

/**
 * Sends a session reminder 24 hours before
 * @param to Recipient's email
 * @param bookingDetails Booking details
 * @returns A promise with the sending result
 */
export async function sendSessionReminder(
  to: string, 
  bookingDetails: { 
    start_time: string | Date, 
    end_time: string | Date, 
    zoom_link?: string,
    user_name?: string
  }
) {
  const subject = `Reminder: Your coaching session is tomorrow`;
  const emailContent = getSessionReminderTemplate({
    ...bookingDetails,
    user_email: to
  });

  return sendEmail({
    to,
    subject,
    html: emailContent.html,
    // icalEvent: emailContent.icalEvent // FUTURE IMPLEMENTATION
  });
}

/**
 * Sends a session cancellation notification
 * @param to Recipient's email
 * @param bookingDetails Cancelled booking details
 * @returns A promise with the sending result
 */
export async function sendCancellationNotification(
  to: string, 
  bookingDetails: { 
    start_time: string | Date,
    user_name?: string
  }
) {
  const subject = `Session Cancelled`;
  const html = getCancellationTemplate(bookingDetails);

  return sendEmail({
    to,
    subject,
    html,
  });
}

/**
 * Sends a session summary
 * @param to Recipient's email
 * @param sessionDetails Session details and summary
 * @returns A promise with the sending result
 */
export async function sendSessionSummary(
  to: string, 
  sessionDetails: {
    date: string | Date,
    summary: string,
    next_steps?: string[],
    resources?: Array<{title: string, url: string}>,
    user_name?: string
  }
) {
  const subject = `Your coaching session summary`;
  const html = getSessionSummaryTemplate(sessionDetails);

  return sendEmail({
    to,
    subject,
    html,
  });
}

// You can add more specific functions for different types of emails 