import { useState } from 'react';
import { BookingDB } from '@/app/types/booking';

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
      
      const response = await fetch('/api/email/booking-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error sending notification');
      }
      
      await response.json();
      
      setSuccess(true);
      return true;
    } catch (err) {
      console.error('Error sending email notification:', err);
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