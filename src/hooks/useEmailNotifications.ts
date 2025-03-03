import { useState } from 'react';
import { BookingDB } from '@/lib/supabase/types';

interface EmailNotificationOptions {
  to?: string;
  bookingDetails: {
    start_time: string | Date;
    end_time: string | Date;
    zoom_link?: string;
    user_name?: string;
  };
  type: 'confirmation' | 'reminder' | 'cancellation';
}

// Helper function to send email directly in development
// Only for testing purposes when API fails
const sendDevModeEmail = async (options: EmailNotificationOptions): Promise<boolean> => {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  
  console.log('===== DEVELOPMENT MODE - EMAIL SENDING SIMULATION =====');
  console.log(`Recipient: ${options.to}`);
  console.log(`Email type: ${options.type}`);
  console.log('Booking details:', options.bookingDetails);
  console.log('=========================================================');
  
  // In development mode, simulate successful sending
  return true;
};

export const useEmailNotifications = () => {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sendBookingNotification = async (options: EmailNotificationOptions) => {
    setIsSending(true);
    setError(null);
    setSuccess(false);
    
    try {
      if (!options.to) {
        throw new Error('Recipient email not specified');
      }
      
      console.log('EmailHook: Sending notification to:', options.to);
      
      const response = await fetch('/api/email/booking-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      });
      
      console.log(`EmailHook: Server response - Status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('EmailHook: Server error:', errorData);
        
        // In development, try direct mode if API fails
        if (process.env.NODE_ENV === 'development') {
          console.log('EmailHook: API failed, trying development direct mode');
          const devSuccess = await sendDevModeEmail(options);
          if (devSuccess) {
            console.log('EmailHook: Development mode simulation successful');
            setSuccess(true);
            return true;
          }
        }
        
        throw new Error(errorData.error || 'Error sending notification');
      }
      
      const successData = await response.json();
      console.log('EmailHook: Successful response:', successData);
      
      setSuccess(true);
      return true;
    } catch (err) {
      console.error('Error sending email notification:', err);
      
      // Last chance in development mode
      if (process.env.NODE_ENV === 'development') {
        try {
          console.log('EmailHook: Final attempt with development direct mode');
          const devSuccess = await sendDevModeEmail(options);
          if (devSuccess) {
            console.log('EmailHook: Development mode simulation successful (last chance)');
            setSuccess(true);
            return true;
          }
        } catch (devErr) {
          console.error('Error even in development mode:', devErr);
        }
      }
      
      setError(err instanceof Error ? err.message : 'Unknown error sending notification');
      return false;
    } finally {
      setIsSending(false);
    }
  };
  
  const sendBookingConfirmation = async (booking: BookingDB, userEmail?: string, userName?: string) => {
    const startDate = new Date(booking.booking_date);
    const endDate = new Date(startDate.getTime() + (booking.duration || 60) * 60000);
    
    return sendBookingNotification({
      to: userEmail || booking.user_email, // Use provided email or booking email
      type: 'confirmation',
      bookingDetails: {
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        zoom_link: booking.meet_link,
        user_name: userName
      }
    });
  };
  
  return {
    isSending,
    error,
    success,
    sendBookingNotification,
    sendBookingConfirmation
  };
}; 