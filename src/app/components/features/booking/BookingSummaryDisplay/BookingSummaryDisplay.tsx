'use client'

import { BookingFrequency } from '@/app/types/enums/booking'
import { getBookingSummary } from '@/lib/utils'
import { Badge } from '@/app/components/ui-kit/badge'
import { DateTime } from 'luxon'

interface BookingSummaryDisplayProps {
  booking: {
    id?: string
    booking_date?: string | Date
    frequency?: BookingFrequency | string
    duration?: number
    status?: string
    user_email?: string
    user_timezone?: string
  } | null
  timezone: string
}

export interface BookingSummaryResult {
  formattedDate: string;
  formattedTime: string;
}

export function BookingSummaryDisplay({ booking, timezone }: BookingSummaryDisplayProps) {
  if (!booking) {
    return (
      <div className="text-center py-4">
        <p>No booking information available.</p>
      </div>
    );
  }

  // If booking has a date, show full details
  if (booking.booking_date) {
    // Extract formatted date and time
    let formattedDate = '';
    let formattedTime = '';
    
    try {
      if (booking.booking_date) {
        const bookingDate = typeof booking.booking_date === 'string' 
          ? booking.booking_date 
          : booking.booking_date.toISOString();

        // Get the appropriate timezone - use booking timezone if available, otherwise use provided timezone
        const userTimezone = booking.user_timezone || timezone;
        
        // Log de diagnóstico detallado
        console.log('🔍 BookingSummaryDisplay - datos recibidos:', {
          fecha_original: bookingDate,
          timezone_usuario: userTimezone,
          esUTC: bookingDate.endsWith('Z'),
          tieneOffset: bookingDate.includes('+') || bookingDate.includes('-')
        });
        
        // CORREGIDO: Primero verificar si la fecha ya tiene información de zona horaria
        let localDateTime;
        
        // Si la fecha ya está en formato UTC (termina en Z)
        if (bookingDate.endsWith('Z')) {
          const utcDateTime = DateTime.fromISO(bookingDate);
          localDateTime = utcDateTime.setZone(userTimezone);
          console.log('🔄 Convirtiendo desde UTC:', {
            fecha_utc: utcDateTime.toString(),
            fecha_local: localDateTime.toString()
          });
        } 
        // Si la fecha tiene un offset explícito (como +07:00)
        else if (bookingDate.includes('+') || (bookingDate.includes('-') && bookingDate.indexOf('T') < bookingDate.lastIndexOf('-'))) {
          const dateTime = DateTime.fromISO(bookingDate);
          // Primero convertir a UTC, luego a la zona del usuario para manejar DST correctamente
          localDateTime = dateTime.toUTC().setZone(userTimezone);
          console.log('🔄 Convirtiendo desde fecha con offset:', {
            fecha_original: dateTime.toString(),
            fecha_utc: dateTime.toUTC().toString(),
            fecha_local: localDateTime.toString()
          });
        } 
        // Si la fecha no tiene información de zona horaria, asumimos que está en UTC
        else {
          const dateTime = DateTime.fromISO(bookingDate);
          localDateTime = dateTime.toUTC().setZone(userTimezone);
          console.log('🔄 Convirtiendo desde fecha sin zona horaria (asumiendo UTC):', {
            fecha_original: dateTime.toString(),
            fecha_local: localDateTime.toString()
          });
        }
        
        if (!localDateTime || !localDateTime.isValid) {
          throw new Error(`Fecha inválida: ${bookingDate}`);
        }
        
        // Formatear la fecha y hora usando la zona horaria del usuario
        formattedDate = localDateTime.toFormat('EEEE, MMMM d, yyyy');
        // Check if it's midnight and use "00:00hs" instead of "12:00 AM"
        formattedTime = localDateTime.hour === 0 && localDateTime.minute === 0 
          ? "00:00hs" 
          : localDateTime.toFormat('h:mm a');
        
        console.log('✅ BookingSummaryDisplay - fecha procesada:', {
          fecha_original: bookingDate,
          timezone: userTimezone,
          fecha_formateada: formattedDate,
          hora_formateada: formattedTime,
          unix_timestamp: localDateTime.toMillis()
        });
      }
    } catch (error) {
      console.error('Error formatting booking date:', error);
      
      // Fallback a la implementación anterior
      try {
        const bookingDate = typeof booking.booking_date === 'string' 
          ? booking.booking_date 
          : booking.booking_date.toISOString();
          
        const bookingSummary = getBookingSummary(
          bookingDate,
          (booking.frequency || BookingFrequency.Once) as BookingFrequency,
          booking.duration,
          true,
          timezone
        );
        
        // Basic formatting for date and time
        const dateParts = bookingSummary?.split(' at ');
        if (dateParts && dateParts.length > 1) {
          formattedDate = dateParts[0].replace('One-time meeting on ', '');
          formattedTime = dateParts[1];
        }
      } catch (error) {
        console.error('Error in fallback formatting:', error);
      }
    }
    
    return (
      <div className="space-y-3">
        <div className="flex flex-col space-y-2">
          <div className="flex">
            <div className="min-w-32 font-medium">Date:</div>
            <div>{formattedDate || 'Date not available'}</div>
          </div>
          
          <div className="flex">
            <div className="min-w-32 font-medium">Time:</div>
            <div>{formattedTime || 'Time not available'}</div>
          </div>

          {booking.frequency && (
            <div className="flex">
              <div className="min-w-32 font-medium">Frequency:</div>
              <div>
                {booking.frequency === BookingFrequency.Once ? (
                  <>One-time session</>
                ) : booking.frequency === BookingFrequency.Weekly ? (
                  <>Weekly sessions</>
                ) : (
                  <>Twice weekly sessions</>
                )}
              </div>
            </div>
          )}

          {booking.status && booking.status !== 'CONFIRMED' && (
            <div className="flex">
              <div className="min-w-32 font-medium">Status:</div>
              <div>
                {booking.status === 'PENDING' ? (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-600 hover:bg-yellow-50">
                    Payment pending
                  </Badge>
                ) : booking.status === 'CANCELLED' ? (
                  <Badge variant="outline" className="bg-red-50 text-red-600 hover:bg-red-50">
                    Cancelled
                  </Badge>
                ) : (
                  <>{booking.status}</>
                )}
              </div>
            </div>
          )}
          
          {!booking.user_timezone && (
            <div className="flex">
              <div className="min-w-32 font-medium">Timezone:</div>
              <div>
                {timezone || 'Couldn&apos;t determine timezone'}
              </div>
            </div>
          )}
          
          {booking.user_timezone && (
            <div className="flex">
              <div className="min-w-32 font-medium">Timezone:</div>
              <div>
                {booking.user_timezone || 'Couldn&apos;t determine timezone'}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // If no date, show minimal info
  return (
    <div className="space-y-2">
      <p>Your booking has been confirmed.</p>
      <div className="flex">
        <div className="min-w-32 font-medium">Frequency:</div>
        <div>
          {booking.frequency === BookingFrequency.Once ? (
            <>One-time session</>
          ) : booking.frequency === BookingFrequency.Weekly ? (
            <>Weekly sessions</>
          ) : (
            <>Twice weekly sessions</>
          )}
        </div>
      </div>
      <p>You&apos;ll receive details about your scheduled time via email.</p>
    </div>
  );
}