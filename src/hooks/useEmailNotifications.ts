import { useState } from 'react';
import { getAuthToken } from '@/app/helpers/authHelpers';
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

export const useEmailNotifications = () => {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sendBookingNotification = async (options: EmailNotificationOptions) => {
    setIsSending(true);
    setError(null);
    setSuccess(false);
    
    try {
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('No se pudo obtener el token de autenticación');
      }
      
      const response = await fetch('/api/email/booking-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: options.to,
          type: options.type,
          bookingDetails: options.bookingDetails
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al enviar la notificación');
      }
      
      setSuccess(true);
      return true;
    } catch (err) {
      console.error('Error sending email notification:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al enviar la notificación');
      return false;
    } finally {
      setIsSending(false);
    }
  };
  
  const sendBookingConfirmation = async (booking: BookingDB, userEmail?: string, userName?: string) => {
    const startDate = new Date(booking.booking_date);
    const endDate = new Date(startDate.getTime() + (booking.duration || 60) * 60000);
    
    return sendBookingNotification({
      to: userEmail,
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