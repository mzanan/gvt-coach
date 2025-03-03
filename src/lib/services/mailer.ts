import nodemailer from 'nodemailer';
import { 
  getBookingConfirmationTemplate,
  getSessionReminderTemplate,
  getCancellationTemplate,
  getSessionSummaryTemplate 
} from './email-templates';

// Nodemailer transporter configuration for Gmail
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.GMAIL_USER, // Your Gmail email
    pass: process.env.GMAIL_PASSWORD, // Password or App Password
  },
  tls: {
    // Do not fail on self-signed certificates
    rejectUnauthorized: false
  }
});

// Verify transporter configuration (optional but recommended)
if (process.env.NODE_ENV !== 'production') {
  transporter.verify(function(error, success) {
    if (error) {
      console.error('Error in SMTP server configuration:', error);
      console.error('Make sure to properly configure GMAIL_USER and GMAIL_PASSWORD in .env.local');
      console.error('Current values:', {
        GMAIL_USER: process.env.GMAIL_USER || 'not configured',
        GMAIL_PASSWORD: process.env.GMAIL_PASSWORD ? '******' : 'not configured'
      });
    } else {
      console.log('✅ SMTP server is ready to send messages');
    }
  });
}

// Email address from which emails will be sent
const defaultFromEmail = process.env.GMAIL_USER || process.env.COACH_EMAIL || 'matiaszanan@gmail.com';

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
}

/**
 * Sends an email using nodemailer with Gmail SMTP
 * @param emailData Email data to send
 * @returns A promise with the sending result
 */
export async function sendEmail(emailData: EmailData) {
  try {
    // Pre-checks
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
      throw new Error('Missing Gmail credentials. Check GMAIL_USER and GMAIL_PASSWORD variables.');
    }

    // Ensure there is content in either html or text
    if (!emailData.html && !emailData.text) {
      throw new Error('You must provide HTML or plain text content for the email');
    }

    // Debug logs (not in production)
    if (process.env.NODE_ENV !== 'production') {
      console.log('📧 Attempting to send email to:', emailData.to);
      console.log('📧 Subject:', emailData.subject);
    }

    // Configure message
    const mailOptions = {
      from: emailData.from || `"GVT Coach" <${defaultFromEmail}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
      replyTo: emailData.replyTo,
      cc: emailData.cc,
      bcc: emailData.bcc,
    };

    // Send email and wait for response
    const info = await transporter.sendMail(mailOptions);
    
    // Log result
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Message sent: %s', info.messageId);
    }
    
    return { success: true, data: info };
  } catch (error) {
    // Detailed error logging
    console.error('❌ Error sending email:', error);
    
    if (error instanceof Error) {
      // Add more diagnostic information
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    
    // If it's an authentication error, give specific instructions
    if (error instanceof Error && error.message.includes('Authentication')) {
      console.error('Authentication error. Please verify:');
      console.error('1. That Gmail credentials are correct');
      console.error('2. If using two-factor authentication, you must use an "App Password"');
      console.error('3. If not using 2FA, enable "Less secure app access" in your Google account');
      console.error('4. Visit https://accounts.google.com/DisplayUnlockCaptcha and authorize access');
    }
    
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
  const html = getBookingConfirmationTemplate(bookingDetails);

  return sendEmail({
    to,
    subject,
    html,
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
  const html = getSessionReminderTemplate(bookingDetails);

  return sendEmail({
    to,
    subject,
    html,
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