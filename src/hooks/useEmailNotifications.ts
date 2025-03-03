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

// Función de ayuda para enviar email directamente en desarrollo
// Solo para fines de prueba cuando la API falla
const sendDevModeEmail = async (options: EmailNotificationOptions): Promise<boolean> => {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  
  console.log('===== MODO DE DESARROLLO - SIMULACIÓN DE ENVÍO DE EMAIL =====');
  console.log(`Destinatario: ${options.to}`);
  console.log(`Tipo de email: ${options.type}`);
  console.log('Detalles de la reserva:', options.bookingDetails);
  console.log('=========================================================');
  
  // En modo desarrollo, simulamos un envío exitoso
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
        throw new Error('No se especificó el email del destinatario');
      }
      
      console.log('EmailHook: Enviando notificación a:', options.to);
      
      const response = await fetch('/api/email/booking-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      });
      
      console.log(`EmailHook: Respuesta del servidor - Status: ${response.status}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('EmailHook: Error del servidor:', errorData);
        
        // En desarrollo, intentamos el modo directo si la API falla
        if (process.env.NODE_ENV === 'development') {
          console.log('EmailHook: API falló, intentando modo directo de desarrollo');
          const devSuccess = await sendDevModeEmail(options);
          if (devSuccess) {
            console.log('EmailHook: Envío simulado en modo desarrollo exitoso');
            setSuccess(true);
            return true;
          }
        }
        
        throw new Error(errorData.error || 'Error al enviar la notificación');
      }
      
      const successData = await response.json();
      console.log('EmailHook: Respuesta exitosa:', successData);
      
      setSuccess(true);
      return true;
    } catch (err) {
      console.error('Error sending email notification:', err);
      
      // Última oportunidad en modo desarrollo
      if (process.env.NODE_ENV === 'development') {
        try {
          console.log('EmailHook: Intento final con modo directo de desarrollo');
          const devSuccess = await sendDevModeEmail(options);
          if (devSuccess) {
            console.log('EmailHook: Envío simulado en modo desarrollo exitoso (última oportunidad)');
            setSuccess(true);
            return true;
          }
        } catch (devErr) {
          console.error('Error incluso en modo desarrollo:', devErr);
        }
      }
      
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
      to: userEmail || booking.user_email, // Usar el email proporcionado o el del booking
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