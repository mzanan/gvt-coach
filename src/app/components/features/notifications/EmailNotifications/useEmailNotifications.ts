import { useState } from 'react';
import { BookingDB } from '@/app/types/booking';
import { toast } from "@/components/ui/use-toast";
import { getTimezoneCookie } from '@/lib/utils/cookies';

interface EmailNotificationOptions {
  to?: string;
  bookingDetails: {
    start_time: string | Date;
    end_time: string | Date;
    zoom_link?: string;
    user_name?: string;
    booking_id: string;
  };
  type: 'confirmation' | 'reminder' | 'cancellation';
  userTimezone?: string;
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
    try {
      // Get user timezone from cookie or booking data
      const userTimezone = booking.user_timezone || getTimezoneCookie() || 'UTC';
      
      console.log('Sending booking confirmation with timezone:', userTimezone);
      
      const response = await fetch('/api/email/booking-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: userEmail || booking.user_email,
          bookingDetails: {
            start_time: booking.booking_date,
            end_time: new Date(new Date(booking.booking_date).getTime() + (booking.session_minutes || 60) * 60000),
            zoom_link: booking.meet_link,
            user_name: userName || booking.user_name,
            booking_id: booking.id,
            user_timezone: userTimezone
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send booking confirmation email');
      }
      
      toast({
        title: "Email sent",
        description: "Booking confirmation email sent successfully",
      });
    } catch (error) {
      console.error("Error sending booking confirmation:", error);
      toast({
        title: "Error",
        description: "Failed to send booking confirmation email",
        variant: "destructive",
      });
    }
  };
  
  return {
    isSending,
    error,
    success,
    sendBookingNotification,
    sendBookingConfirmation
  };
}; 