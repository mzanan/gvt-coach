import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/app/components/ui-kit/use-toast'
import { BookingDB } from '@/app/types/booking'
import { getUserDataFromLocalStorage } from '@/lib/utils/payment'
import { fetchBookingByOrderId, fetchPaymentMapping, fetchPaymentStatus } from '@/lib/utils/payment/queries'
import { bookingService } from '@/services/bookingService'
import { supabase } from '@/lib/supabase/client'
import { PaymentOrderStatus, BookingStatus } from '@/app/types/enums/booking'
import { sendBookingConfirmation } from '@/services/mailer'

export const usePaymentSuccess = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [booking, setBooking] = useState<BookingDB | null>(null)
  const [userTimezone, setUserTimezone] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentOrderStatus>(PaymentOrderStatus.Pending)
  const [orderId, setOrderId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  // Referencias para controlar proceso
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 10
  const checkoutOrderIdRef = useRef<string | null>(null)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isCompletedRef = useRef(false)
  const emailSentRef = useRef(false) // Ref para controlar si el email ya fue enviado
  const effectExecutionFlag = useRef(false) // Mover fuera del callback para evitar error de linter
  
  // Función centralizada para envío de correo
  const sendConfirmationEmailOnce = async (bookingData: BookingDB) => {
    // Comprobar si el email ya fue enviado usando el ref (persistente entre renderizados)
    if (emailSentRef.current) {
      console.log("Email ya enviado según ref (omitiendo envío)");
      return;
    }
    
    // Marcar como enviado inmediatamente para evitar duplicados
    emailSentRef.current = true;
    
    console.log("Enviando email de confirmación...");
    try {
      await sendBookingConfirmation(
        bookingData.user_email,
        {
          start_time: bookingData.booking_date,
          end_time: new Date(new Date(bookingData.booking_date).getTime() + (bookingData.duration || 60) * 60000),
          zoom_link: bookingData.meet_link,
          user_name: bookingData.user_name,
          booking_id: bookingData.id,
          user_timezone: bookingData.user_timezone
        }
      );
      
      console.log("Correo enviado y marcado en base de datos");
    } catch (emailError) {
      // En caso de error, permitir reintentos
      emailSentRef.current = false;
      console.error("Error enviando correo de confirmación:", emailError);
    }
  };
  
  // Función para manejar la confirmación del booking - envuelta en useCallback
  const handleBookingConfirmation = useCallback(async (bookingData: BookingDB) => {
    try {
      // Si el booking ya está confirmado completamente, no hacer nada más
      if (bookingData.meet_link && bookingData.confirmation_email_sent) {
        console.log("Booking ya completamente confirmado con meet_link y correo enviado");
        emailSentRef.current = true; // Marcar como enviado en el ref
        return bookingData;
      }

      // 1. Actualizar estado del booking
      const { data, error } = await supabase
        .from('gvt_coach_meetings_bookings')
        .update({
          payment_status: PaymentOrderStatus.Paid,
          checkout_completed: true,
          payment_confirmed: true
        })
        .eq('id', bookingData.id)
        .select()
        .single();

      if (error) {
        console.error("Error actualizando estado del booking:", error);
        return null;
      }

      const updatedBooking = data || bookingData;

      // 2. Generar enlace de Zoom si es necesario
      if (!updatedBooking.meet_link) {
        console.log("Generando reunión en Zoom...");
        const meetingTime = new Date(updatedBooking.booking_date);
        const meetingTopic = `GVT Coaching Session with ${updatedBooking.user_email}`;
        const duration = updatedBooking.duration || 60;
        
        const response = await fetch('/api/zoom/meeting', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            meetingTopic,
            meetingTime: meetingTime.toISOString(),
            duration,
            timezone: updatedBooking.user_timezone || 'UTC'
          })
        });

        if (response.ok) {
          const zoomData = await response.json();
          if (zoomData.join_url) {
            const { error: updateError } = await supabase
              .from('gvt_coach_meetings_bookings')
              .update({ meet_link: zoomData.join_url })
              .eq('id', updatedBooking.id);

            if (!updateError) {
              updatedBooking.meet_link = zoomData.join_url;
            }
          }
        }
      }

      // Actualizar estado UI
      setBooking(updatedBooking);
      setPaymentStatus(PaymentOrderStatus.Paid);
      isCompletedRef.current = true;
      setIsLoading(false);

      // 3. Enviar correo de confirmación (centralizado) - solo si no está marcado como enviado
      if (!bookingData.confirmation_email_sent && !emailSentRef.current) {
        await sendConfirmationEmailOnce(updatedBooking);
      }

      // 4. Limpiar caché de slots de tiempo
      bookingService.clearTimeSlotsCache();

      return updatedBooking;
    } catch (error) {
      console.error("Error en handleBookingConfirmation:", error);
      return null;
    }
  }, []);

  // Función para cargar datos de pago (reutilizada en polling) - envuelta en useCallback
  const loadPaymentData = useCallback(async (checkoutOrderId: string) => {
    try {
      // Omitir si ya está completado
      if (isCompletedRef.current) {
        console.log("Pago ya completado, omitiendo verificación");
        return true;
      }
      
      // Obtener booking directamente
      const bookingData = await fetchBookingByOrderId(checkoutOrderId);
      
      if (bookingData) {
        console.log("Booking encontrado:", bookingData);
        
        // Si el booking ya tiene el flag de correo enviado, actualizar estado ref
        if (bookingData.confirmation_email_sent) {
          emailSentRef.current = true;
        }
        
        // Si el booking ya está confirmado, hemos terminado
        if (bookingData.payment_status === PaymentOrderStatus.Paid || 
            bookingData.payment_confirmed === true ||
            bookingData.checkout_completed === true) {
          console.log("Booking confirmado, estableciendo estado de pago como PAID y deteniendo polling");
          
          // Actualizar UI primero
          setBooking(bookingData);
          setPaymentStatus(PaymentOrderStatus.Paid);
          isCompletedRef.current = true;
          setIsLoading(false);

          // Luego manejar confirmación (correos, etc.)
          await handleBookingConfirmation(bookingData);
          return true;
        }

        // Si no está confirmado, actualizar estado del booking en UI
        setBooking(bookingData);
      }
      
      // Si el booking no está confirmado, verificar estado de pago
      const mappingData = await fetchPaymentMapping(checkoutOrderId);
      
      if (!mappingData) {
        console.warn("No se encontró mapping de pago");
        return false;
      }
      
      // Obtener estado de pago desde mapping
      if (mappingData.payment_status_id) {
        const paymentStatusData = await fetchPaymentStatus(mappingData.payment_status_id);
        
        if (paymentStatusData) {
          console.log("Estado de pago encontrado:", paymentStatusData);
          
          const statusFromRecord = paymentStatusData.status;
          console.log("Usando campo de estado principal para determinar:", statusFromRecord);
          
          setPaymentStatus(statusFromRecord);
          
          // Si el estado es PAID/ACTIVE, confirmar el booking
          if (statusFromRecord === PaymentOrderStatus.Paid || statusFromRecord === PaymentOrderStatus.Active) {
            console.log("Estado de pago es PAID/ACTIVE, confirmando booking");
            
            if (bookingData) {
              // Actualizar UI primero
              setBooking(bookingData);
              setPaymentStatus(PaymentOrderStatus.Paid);
              isCompletedRef.current = true;
              setIsLoading(false);

              // Luego manejar confirmación (correos, etc.)
              await handleBookingConfirmation(bookingData);
              return true;
            }
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error("Error verificando estado de pago:", error);
      return false;
    }
  }, [handleBookingConfirmation]);

  // Función para buscar booking por email para LemonSqueezy donde no tenemos checkout_order_id en URL
  const fetchLatestBookingByEmail = async (email: string): Promise<BookingDB | null> => {
    try {
      if (!email) return null
      
      console.log(`Buscando booking más reciente con email: ${email}`)
      const { data, error } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error) {
        console.error("Error buscando booking por email:", error)
        return null
      }
      
      if (data && data.length > 0) {
        console.log(`Booking encontrado para email ${email}:`, data[0])
        return data[0] as BookingDB
      }
      
      return null
    } catch (error) {
      console.error("Error en fetchLatestBookingByEmail:", error)
      return null
    }
  }

  // Obtener ID de orden desde URL y cargar datos
  useEffect(() => {
    let isMounted = true
    
    async function loadData() {
      if (effectExecutionFlag.current) return 
      effectExecutionFlag.current = true
      
      try {
        // Intentar obtener checkout order ID desde URL (para Polar)
        const checkoutOrderIdFromUrl = searchParams.get('checkout_order_id')
        
        // Cargar datos de usuario desde localStorage primero
        const userData = getUserDataFromLocalStorage()
        if (userData && isMounted) {
          if (userData.timezone) setUserTimezone(userData.timezone)
          if (userData.userEmail) setUserEmail(userData.userEmail)
        }

        if (!checkoutOrderIdFromUrl) {
          // Para LemonSqueezy, no tenemos checkout_order_id en URL
          if (userData && userData.userEmail) {
            // Intentar encontrar booking por email
            const bookingByEmail = await fetchLatestBookingByEmail(userData.userEmail)
            
            if (bookingByEmail) {
              setBooking(bookingByEmail)
              // Asignar el checkout_order_id solo si existe
              checkoutOrderIdRef.current = bookingByEmail.checkout_order_id || null
              
              // Si el booking ya está confirmado, hemos terminado
              if (bookingByEmail.payment_status === PaymentOrderStatus.Paid || 
                  bookingByEmail.payment_confirmed === true ||
                  bookingByEmail.status === BookingStatus.BookingConfirmed) {
                console.log("Booking confirmado encontrado para pago de LemonSqueezy")
                
                // Actualizar UI primero
                setBooking(bookingByEmail)
                setPaymentStatus(PaymentOrderStatus.Paid)
                isCompletedRef.current = true
                setIsLoading(false)
                
                // Luego manejar confirmación (correos, etc.)
                await handleBookingConfirmation(bookingByEmail);
              } else if (bookingByEmail.checkout_order_id) {
                // Si encontramos un booking con checkout_order_id, iniciar polling de su estado
                console.log("Booking pendiente encontrado, iniciando polling con checkout_order_id:", bookingByEmail.checkout_order_id)
                const isComplete = await loadPaymentData(bookingByEmail.checkout_order_id)
                
                // Iniciar polling si no está completo
                if (!isComplete && !isCompletedRef.current && isMounted) {
                  const pollInterval = setInterval(async () => {
                    if (!isMounted) {
                      clearInterval(pollInterval)
                      return
                    }
                    
                    retryCountRef.current += 1
                    
                    if (retryCountRef.current > MAX_RETRIES) {
                      console.log(`Máximo de reintentos alcanzado (${MAX_RETRIES}), deteniendo polling`)
                      clearInterval(pollInterval)
                      pollingTimeoutRef.current = null
                      if (isMounted) setIsLoading(false)
                      return
                    }
                    
                    // Comprobación explícita de que checkout_order_id existe y no es undefined
                    if (!bookingByEmail.checkout_order_id) {
                      console.error("No hay checkout_order_id para polling");
                      clearInterval(pollInterval);
                      pollingTimeoutRef.current = null;
                      if (isMounted) setIsLoading(false);
                      return;
                    }
                    
                    const isComplete = await loadPaymentData(bookingByEmail.checkout_order_id)
                    
                    if (isComplete || isCompletedRef.current || paymentStatus !== PaymentOrderStatus.Pending) {
                      console.log("Estado de pago cambiado, deteniendo polling")
                      clearInterval(pollInterval)
                      pollingTimeoutRef.current = null
                      if (isMounted) setIsLoading(false)
                      return
                    }
                  }, 3000)
                  
                  pollingTimeoutRef.current = pollInterval
                } else if (isMounted) {
                  setIsLoading(false)
                }
              }
            } else {
              console.log("No se encontró booking para email:", userData.userEmail)
              if (isMounted) setIsLoading(false)
            }
          } else {
            // Si no tenemos email, no podemos proceder
            toast({
              title: "Error",
              description: "Falta información de usuario. Por favor contacte soporte.",
              variant: "destructive"
            })
            if (isMounted) setIsLoading(false)
          }
          return
        }
        
        // Para Polar, continuar con el checkout order ID desde URL
        if (isMounted) {
          setOrderId(checkoutOrderIdFromUrl)
          checkoutOrderIdRef.current = checkoutOrderIdFromUrl
        }
        
        // Carga inicial de datos
        const isComplete = await loadPaymentData(checkoutOrderIdFromUrl)
        
        // Iniciar polling si no está completo
        if (!isComplete && !isCompletedRef.current && isMounted) {
          const pollInterval = setInterval(async () => {
            if (!isMounted) {
              clearInterval(pollInterval)
              return
            }
            
            retryCountRef.current += 1
            
            if (retryCountRef.current > MAX_RETRIES) {
              console.log(`Máximo de reintentos alcanzado (${MAX_RETRIES}), deteniendo polling`)
              clearInterval(pollInterval)
              pollingTimeoutRef.current = null
              if (isMounted) setIsLoading(false)
              return
            }
            
            const isComplete = await loadPaymentData(checkoutOrderIdFromUrl)
            
            if (isComplete || isCompletedRef.current || paymentStatus !== PaymentOrderStatus.Pending) {
              console.log("Estado de pago cambiado, deteniendo polling")
              clearInterval(pollInterval)
              pollingTimeoutRef.current = null
              if (isMounted) setIsLoading(false)
              return
            }
          }, 3000)
          
          pollingTimeoutRef.current = pollInterval
        } else if (isMounted) {
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error cargando datos de pago:", error)
        if (isMounted) {
          toast({
            title: "Error",
            description: "No se pudo cargar la información de reserva",
            variant: "destructive"
          })
          setIsLoading(false)
        }
      }
    }
    
    loadData()
    
    // Limpieza al desmontar
    return () => {
      isMounted = false
      if (pollingTimeoutRef.current) {
        clearInterval(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }
  }, [searchParams, handleBookingConfirmation, loadPaymentData, paymentStatus, toast]) // Incluir todas las dependencias requeridas
  
  return {
    isLoading,
    isPaid: paymentStatus === PaymentOrderStatus.Paid || paymentStatus === PaymentOrderStatus.Active,
    booking,
    userTimezone,
    userEmail,
    paymentStatus,
    orderId
  }
}