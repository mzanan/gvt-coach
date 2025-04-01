import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/app/components/ui-kit/use-toast'
import { BookingDB } from '@/types/booking'
import { getUserDataFromCookies } from '@/lib/utils/payment'
import { fetchBookingByOrderId, fetchPaymentMapping, fetchPaymentStatus } from '@/lib/utils/payment/queries'
import { bookingService } from '@/services/bookingService'
import { supabase } from '@/lib/supabase/client'
import { PaymentOrderStatus } from '@/types/enums'
import { sendBookingConfirmation } from '@/services/mailer'
import { getTimezoneCookie } from '@/lib/utils/cookies'

export const usePaymentSuccess = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [booking, setBooking] = useState<BookingDB | null>(null)
  const [userTimezone, setUserTimezone] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentOrderStatus>(PaymentOrderStatus.Pending)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [isEmailSending, setIsEmailSending] = useState(false)
  const [isEmailSent, setIsEmailSent] = useState(false)
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
  
  // Función centralizada para envío de correo (envuelta en useCallback)
  const sendConfirmationEmailOnce = useCallback(async (bookingData: BookingDB) => {
    // Comprobar si el email ya fue enviado usando el ref (persistente entre renderizados)
    if (emailSentRef.current) {
      return;
    }
    
    // Marcar como enviado inmediatamente para evitar duplicados
    emailSentRef.current = true;
    
    // Actualizar UI - Iniciando envío de email
    setIsEmailSending(true);
    
    try {
      await sendBookingConfirmation(
        bookingData.user_email,
        {
          start_time: bookingData.booking_date,
          end_time: new Date(new Date(bookingData.booking_date).getTime() + (bookingData.duration || 60) * 60000),
          zoom_link: bookingData.meet_link,
          user_name: bookingData.user_name,
          booking_id: bookingData.id,
          user_timezone: bookingData.user_timezone,
          coach: bookingData.coach
        }
      );
      
      // Actualizar UI - Email enviado con éxito
      setIsEmailSending(false);
      setIsEmailSent(true);
    } catch (emailError) {
      // En caso de error, permitir reintentos
      emailSentRef.current = false;
      console.error("Error enviando correo de confirmación:", emailError);
      // Actualizar UI - Error en envío de email
      setIsEmailSending(false);
      
      // Reintentar después de un breve retraso
      setTimeout(() => {
        if (bookingData) {
          sendConfirmationEmailOnce(bookingData);
        }
      }, 5000); // Reintentar después de 5 segundos
    }
  }, []); // Dependencies: only refs and state setters used, which don't need to be listed
  
  // Función para manejar la confirmación del booking - envuelta en useCallback
  const handleBookingConfirmation = useCallback(async (bookingData: BookingDB) => {
    try {
      // Get the timezone from cookie to ensure it's properly passed through the booking process
      const cookieTimezone = getTimezoneCookie();
      const bookingWithUserTimezone = {
        ...bookingData,
        user_timezone: cookieTimezone || bookingData.user_timezone
      };
      
      // Si el booking ya está confirmado completamente, no hacer nada más
      if (bookingWithUserTimezone.meet_link && bookingWithUserTimezone.confirmation_email_sent) {
        emailSentRef.current = true; // Marcar como enviado en el ref
        setIsEmailSent(true); // Actualizar estado UI
        return bookingWithUserTimezone;
      }

      // 1. Actualizar estado del booking
      const { data, error } = await supabase
        .from('gvt_coach_meetings_bookings')
        .update({
          payment_status: PaymentOrderStatus.Paid,
          checkout_completed: true,
          payment_confirmed: true,
          user_timezone: bookingWithUserTimezone.user_timezone // Ensure timezone is saved
        })
        .eq('id', bookingWithUserTimezone.id)
        .select()
        .single();

      if (error) {
        console.error("Error actualizando estado del booking:", error);
        return null;
      }

      const updatedBooking = data || bookingWithUserTimezone;
      
      // Ensure user_timezone is correctly set
      const finalBooking = {
        ...updatedBooking,
        user_timezone: cookieTimezone || updatedBooking.user_timezone || bookingWithUserTimezone.user_timezone
      };

      // 2. Generar enlace de Zoom si es necesario
      if (!finalBooking.meet_link) {
        const meetingTime = new Date(finalBooking.booking_date);
        const meetingTopic = `GVT Coaching Session with ${finalBooking.user_email}`;
        const duration = finalBooking.duration || 60;
        
        const response = await fetch('/api/zoom/meeting', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            meetingTopic,
            meetingTime: meetingTime.toISOString(),
            duration,
            timezone: finalBooking.user_timezone || 'UTC'
          })
        });

        if (response.ok) {
          const zoomData = await response.json();
          if (zoomData.join_url) {
            const { error: updateError } = await supabase
              .from('gvt_coach_meetings_bookings')
              .update({ meet_link: zoomData.join_url })
              .eq('id', finalBooking.id);

            if (!updateError) {
              finalBooking.meet_link = zoomData.join_url;
            }
          }
        }
      }

      // Actualizar estado UI
      setBooking(finalBooking);
      setPaymentStatus(PaymentOrderStatus.Paid);
      isCompletedRef.current = true;
      setIsLoading(false);

      // 3. Enviar correo de confirmación (centralizado) - solo si no está marcado como enviado
      if (!bookingWithUserTimezone.confirmation_email_sent && !emailSentRef.current) {
        await sendConfirmationEmailOnce(finalBooking);
      } else if (bookingWithUserTimezone.confirmation_email_sent) {
        // Si ya se había enviado anteriormente, actualizar estado UI
        setIsEmailSent(true);
      }

      // 4. Limpiar caché de slots de tiempo
      bookingService.clearTimeSlotsCache();

      return finalBooking;
    } catch (error) {
      console.error("Error en handleBookingConfirmation:", error);
      return null;
    }
  }, [sendConfirmationEmailOnce]);

  // Función para cargar datos de pago (reutilizada en polling) - envuelta en useCallback
  const loadPaymentData = useCallback(async (checkoutOrderId: string) => {
    try {
      // Omitir si ya está completado
      if (isCompletedRef.current) {
        return true;
      }
      
      // Obtener booking directamente
      const bookingData = await fetchBookingByOrderId(checkoutOrderId);
      
      if (bookingData) {
        // Ensure the user_timezone is correctly set from the cookie
        const cookieTimezone = getTimezoneCookie();
        const updatedBookingData = {
          ...bookingData,
          user_timezone: cookieTimezone || bookingData.user_timezone
        };
        
        // Si el booking ya tiene el flag de correo enviado, actualizar estado ref
        if (updatedBookingData.confirmation_email_sent) {
          emailSentRef.current = true;
        }
        
        // Si el booking ya está confirmado, hemos terminado
        if (updatedBookingData.payment_status === PaymentOrderStatus.Paid || 
            updatedBookingData.payment_confirmed === true ||
            updatedBookingData.checkout_completed === true) {
          
          // Actualizar UI primero
          setBooking(updatedBookingData);
          setPaymentStatus(PaymentOrderStatus.Paid);
          isCompletedRef.current = true;
          setIsLoading(false);

          // Luego manejar confirmación (correos, etc.)
          await handleBookingConfirmation(updatedBookingData);
          return true;
        }

        // Si no está confirmado, actualizar estado del booking en UI
        setBooking(updatedBookingData);
      }
      
      // Si el booking no está confirmado, verificar estado de pago
      const mappingData = await fetchPaymentMapping(checkoutOrderId);
      
      if (!mappingData) {
        console.warn("No payment mapping found");
        return false;
      }
      
      // Obtener estado de pago desde mapping
      if (mappingData.payment_status_id) {
        const paymentStatusData = await fetchPaymentStatus(mappingData.payment_status_id);
        
        if (paymentStatusData) {
          const statusFromRecord = paymentStatusData.status;
          
          setPaymentStatus(statusFromRecord);
          
          // Actualizar el estado del pago según respuesta
          if (statusFromRecord === PaymentOrderStatus.Paid || statusFromRecord === PaymentOrderStatus.Active) {
            // Si estamos en estado paid/active, marcamos como completo y actualizamos UI
            isCompletedRef.current = true;
            setBooking(bookingData);
            // Actualizar estado con handle completo
            await handleBookingConfirmation(bookingData as BookingDB);
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
  const fetchLatestBookingByEmail = useCallback(async (email: string): Promise<BookingDB | null> => {
    try {
      if (!email) return null
      
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
        return data[0] as BookingDB
      }
      
      return null
    } catch {
      console.error("Error en fetchLatestBookingByEmail:")
      return null
    }
  }, []); // Removed supabase dependency as it's stable

  // Obtener ID de orden desde URL y cargar datos
  useEffect(() => {
    let isMounted = true
    
    async function loadData() {
      if (effectExecutionFlag.current) return 
      effectExecutionFlag.current = true
      
      try {
        // Intentar obtener checkout order ID desde URL (para Polar)
        const checkoutOrderIdFromUrl = searchParams.get('checkout_order_id')
        
        // IMPORTANTE: Priorizar timezone de la cookie sobre cualquier otra fuente
        const cookieTimezone = getTimezoneCookie()
        if (cookieTimezone && isMounted) {
          setUserTimezone(cookieTimezone)
        } else {
          // Fallback: cargar datos de usuario desde cookies
          const userData = getUserDataFromCookies()
          if (userData && isMounted) {
            if (userData.timezone) setUserTimezone(userData.timezone)
            if (userData.userEmail) setUserEmail(userData.userEmail)
          }
        }

        // Solo establecer email desde cookies (no afecta la timezone)
        const userData = getUserDataFromCookies()
        if (userData && userData.userEmail && isMounted) {
          setUserEmail(userData.userEmail)
        }

        if (!checkoutOrderIdFromUrl) {
          // Para LemonSqueezy, no tenemos checkout_order_id en URL
          if (userData && userData.userEmail) {
            // Intentar encontrar booking por email
            const bookingByEmail = await fetchLatestBookingByEmail(userData.userEmail)
            
            if (bookingByEmail) {
              // Update booking with correct timezone from cookie
              const updatedBooking = {
                ...bookingByEmail,
                user_timezone: cookieTimezone || userData.timezone || bookingByEmail.user_timezone
              };
              
              setBooking(updatedBooking)
              // Asignar el checkout_order_id solo si existe
              checkoutOrderIdRef.current = updatedBooking.checkout_order_id || null
              
              // Si el booking ya está confirmado, hemos terminado
              if (updatedBooking.payment_status === PaymentOrderStatus.Paid || 
                  updatedBooking.payment_confirmed === true ||
                  updatedBooking.payment_status === PaymentOrderStatus.Completed) {
                
                // Actualizar UI primero
                setBooking(updatedBooking)
                setPaymentStatus(PaymentOrderStatus.Paid)
                isCompletedRef.current = true
                setIsLoading(false)
                
                // Luego manejar confirmación (correos, etc.)
                await handleBookingConfirmation(updatedBooking);
              } else if (updatedBooking.checkout_order_id) {
                // Si encontramos un booking con checkout_order_id, iniciar polling de su estado
                const isComplete = await loadPaymentData(updatedBooking.checkout_order_id)
                
                // Iniciar polling si no está completo
                if (!isComplete && !isCompletedRef.current && isMounted) {
                  const pollInterval = setInterval(async () => {
                    if (!isMounted) {
                      clearInterval(pollInterval)
                      return
                    }
                    
                    retryCountRef.current += 1
                    
                    if (retryCountRef.current > MAX_RETRIES) {
                      clearInterval(pollInterval)
                      pollingTimeoutRef.current = null
                      if (isMounted) setIsLoading(false)
                      return
                    }
                    
                    // Comprobación explícita de que checkout_order_id existe y no es undefined
                    if (!updatedBooking.checkout_order_id) {
                      clearInterval(pollInterval);
                      pollingTimeoutRef.current = null;
                      if (isMounted) setIsLoading(false);
                      return;
                    }
                    
                    const isComplete = await loadPaymentData(updatedBooking.checkout_order_id)
                    
                    if (isComplete || isCompletedRef.current || paymentStatus !== PaymentOrderStatus.Pending) {
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
              clearInterval(pollInterval)
              pollingTimeoutRef.current = null
              if (isMounted) setIsLoading(false)
              return
            }
            
            const isComplete = await loadPaymentData(checkoutOrderIdFromUrl)
            
            if (isComplete || isCompletedRef.current || paymentStatus !== PaymentOrderStatus.Pending) {
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
      } catch {
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
  }, [searchParams, handleBookingConfirmation, loadPaymentData, paymentStatus, toast, fetchLatestBookingByEmail])
  
  return {
    isLoading,
    isPaid: paymentStatus === PaymentOrderStatus.Paid || paymentStatus === PaymentOrderStatus.Active,
    booking,
    userTimezone,
    userEmail,
    paymentStatus,
    orderId,
    isEmailSending,
    isEmailSent
  }
}