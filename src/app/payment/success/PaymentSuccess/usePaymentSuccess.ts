import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/app/components/ui-kit/use-toast'
import { BookingDB } from '@/app/types/booking'
import { getUserDataFromLocalStorage } from '@/lib/utils/payment'
import { fetchBookingByOrderId, fetchPaymentMapping, fetchPaymentStatus } from '@/lib/utils/payment/queries'
import { bookingService } from '@/services/bookingService'
import { supabase } from '@/lib/supabase/client'
import { PaymentOrderStatus, BookingStatus } from '@/app/types/enums/booking'

export const usePaymentSuccess = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [booking, setBooking] = useState<BookingDB | null>(null)
  const [userTimezone, setUserTimezone] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentOrderStatus>(PaymentOrderStatus.Pending)
  const [orderId, setOrderId] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  // References for controlling retries
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 10
  const checkoutOrderIdRef = useRef<string | null>(null)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isCompletedRef = useRef(false)
  
  // Function to load payment data (to reuse in polling)
  const loadPaymentData = async (checkoutOrderId: string) => {
    try {
      // Skip if already completed
      if (isCompletedRef.current) {
        return true
      }
      
      // Get booking directly
      const bookingData = await fetchBookingByOrderId(checkoutOrderId)
      
      if (bookingData) {
        console.log("Found booking:", bookingData)
        setBooking(bookingData)
        
        // Si la reserva ya está confirmada, hemos terminado
        if (bookingData.status === BookingStatus.BookingConfirmed || 
            bookingData.payment_status === PaymentOrderStatus.Paid || 
            bookingData.payment_confirmed === true) {
          console.log("Booking is confirmed, setting payment status to PAID and stopping polling")
          setPaymentStatus(PaymentOrderStatus.Paid)
          isCompletedRef.current = true
          setIsLoading(false)
          return true
        }
      }
      
      // Si la reserva no está confirmada, verificamos el estado del pago
      const mappingData = await fetchPaymentMapping(checkoutOrderId)
      
      if (!mappingData) {
        console.warn("No payment mapping found")
        return false
      }
      
      // Get payment status from mapping
      if (mappingData.payment_status_id) {
        const paymentStatusData = await fetchPaymentStatus(mappingData.payment_status_id)
        
        if (paymentStatusData) {
          console.log("Payment status found:", paymentStatusData)
          
          // Solo nos interesa el status principal, no el de json_data
          const statusFromRecord = paymentStatusData.status
          console.log("Using main status field for determination:", statusFromRecord)
          
          setPaymentStatus(statusFromRecord)
          
          // Si el estado es PAID/ACTIVE, marcar como completado y detener polling
          if (statusFromRecord === PaymentOrderStatus.Paid || statusFromRecord === PaymentOrderStatus.Active) {
            console.log("Payment status is PAID/ACTIVE, marking as complete and stopping polling")
            
            // 1. Actualizar la reserva para marcarla como confirmada
            try {
              const { data, error } = await supabase
                .from('gvt_coach_meetings_bookings')
                .update({
                  payment_status: PaymentOrderStatus.Paid,
                  checkout_completed: true,
                  payment_confirmed: true
                })
                .eq('checkout_order_id', checkoutOrderId)
                .select();
              
              if (error) {
                console.error("Error updating booking record:", error);
              } else {
                console.log("Updated booking record successfully:", data);
              }
            } catch (updateError) {
              console.error("Exception updating booking record:", updateError);
            }
            
            // 2. Actualizar json_data en payment_status
            try {
              const updatedJsonData = {
                ...(paymentStatusData.json_data || {}),
                status: PaymentOrderStatus.Paid
              };
              
              const { error } = await supabase
                .from('gvt_coach_payments_status')
                .update({
                  json_data: updatedJsonData
                })
                .eq('id', mappingData.payment_status_id);
              
              if (error) {
                console.error("Error updating payment json_data:", error);
              } else {
                console.log("Updated payment json_data successfully");
              }
            } catch (jsonError) {
              console.error("Exception updating json_data:", jsonError);
            }
            
            // 3. Generate Zoom meeting link if it doesn't exist yet
            try {
              // First get the updated booking
              const updatedBooking = await fetchBookingByOrderId(checkoutOrderId);
              
              if (updatedBooking && !updatedBooking.meet_link) {
                console.log("Generating Zoom meeting link for booking:", updatedBooking.id);
                
                const meetingTime = new Date(updatedBooking.booking_date);
                const meetingTopic = `GVT Coaching Session with ${updatedBooking.user_email}`;
                const duration = updatedBooking.session_minutes || 60;
                
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
                
                if (!response.ok) {
                  console.error("Failed to create Zoom meeting:", await response.text());
                } else {
                  const data = await response.json();
                  
                  if (data.join_url) {
                    // Update the booking with the meeting link
                    const { error } = await supabase
                      .from('gvt_coach_meetings_bookings')
                      .update({ meet_link: data.join_url })
                      .eq('id', updatedBooking.id);
                      
                    if (error) {
                      console.error("Error updating booking with meet link:", error);
                    } else {
                      console.log("Updated booking with meet link:", data.join_url);
                    }
                  }
                }
              } else if (updatedBooking?.meet_link) {
                console.log("Booking already has a meet link:", updatedBooking.meet_link);
              }
            } catch (meetingError) {
              console.error("Error generating meeting link:", meetingError);
            }
            
            // Limpiar cache de time slots para reflejar la reserva inmediatamente
            bookingService.clearTimeSlotsCache()
            console.log("Cleared time slots cache after payment confirmation")
            
            // Confirmar que el proceso está completado
            isCompletedRef.current = true
            
            // Buscar la reserva relacionada
            try {
              const updatedBooking = await fetchBookingByOrderId(checkoutOrderId)
              if (updatedBooking) {
                console.log("Found booking via mapping:", updatedBooking)
                setBooking(updatedBooking)
              }
            } catch (error) {
              console.error("Error fetching updated booking:", error)
            }
            
            return true
          }
        }
      }
      
      return false
    } catch (error) {
      console.error("Error checking payment status:", error)
      return false
    }
  }

  // Function to fetch booking by user email for LemonSqueezy where we don't have checkout_order_id in URL
  const fetchLatestBookingByEmail = async (email: string): Promise<BookingDB | null> => {
    try {
      if (!email) return null
      
      console.log(`Looking for latest booking with email: ${email}`)
      const { data, error } = await supabase
        .from('gvt_coach_meetings_bookings')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error) {
        console.error("Error fetching booking by email:", error)
        return null
      }
      
      if (data && data.length > 0) {
        console.log(`Found booking for email ${email}:`, data[0])
        return data[0] as BookingDB
      }
      
      return null
    } catch (error) {
      console.error("Error in fetchLatestBookingByEmail:", error)
      return null
    }
  }

  // Get order ID from URL and fetch data
  useEffect(() => {
    let isMounted = true
    
    async function loadData() {
      try {
        // Try to get checkout order ID from URL (for Polar)
        const checkoutOrderIdFromUrl = searchParams.get('checkout_order_id')
        
        if (!checkoutOrderIdFromUrl) {
          // For LemonSqueezy, we don't need a specific order ID - payments are handled by webhooks
          const userData = getUserDataFromLocalStorage()
          if (userData && userData.userEmail) {
            setUserEmail(userData.userEmail)
            
            // Try to find the booking by email
            const bookingByEmail = await fetchLatestBookingByEmail(userData.userEmail)
            
            if (bookingByEmail) {
              setBooking(bookingByEmail)
              
              // If booking is confirmed, we're done
              if (bookingByEmail.status === BookingStatus.BookingConfirmed || 
                  bookingByEmail.payment_status === PaymentOrderStatus.Paid || 
                  bookingByEmail.payment_confirmed === true) {
                console.log("Found confirmed booking for LemonSqueezy payment")
                setPaymentStatus(PaymentOrderStatus.Paid)
                isCompletedRef.current = true
              } else if (bookingByEmail.checkout_order_id) {
                // If we found a booking with checkout_order_id, check its payment status
                console.log(`Found booking with checkout_order_id: ${bookingByEmail.checkout_order_id}`)
                checkoutOrderIdRef.current = bookingByEmail.checkout_order_id
                setOrderId(bookingByEmail.checkout_order_id)
                
                // Start polling for this order ID
                const isComplete = await loadPaymentData(bookingByEmail.checkout_order_id || '')
                
                if (!isComplete && !isCompletedRef.current && isMounted) {
                  // Configure polling interval
                  const pollInterval = setInterval(async () => {
                    if (!isMounted) {
                      clearInterval(pollInterval)
                      return
                    }
                    
                    retryCountRef.current += 1
                    
                    if (retryCountRef.current > MAX_RETRIES) {
                      console.log(`Reached maximum retries (${MAX_RETRIES}), stopping polling`)
                      clearInterval(pollInterval)
                      pollingTimeoutRef.current = null
                      if (isMounted) setIsLoading(false)
                      return
                    }
                    
                    const isComplete = await loadPaymentData(bookingByEmail.checkout_order_id || '')
                    
                    if (isComplete || isCompletedRef.current || paymentStatus !== PaymentOrderStatus.Pending) {
                      console.log("Payment status changed, stopping polling")
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
                
                return
              }
            }
            
            // If we can't find a booking or it's not confirmed, just show the pending state
            if (isMounted) setIsLoading(false)
          } else {
            // If we don't even have the email, we can't proceed
            toast({
              title: "Error",
              description: "Missing user information. Please contact support.",
              variant: "destructive"
            })
            if (isMounted) setIsLoading(false)
          }
          return
        }
        
        // For Polar, continue with the checkout order ID from URL
        if (isMounted) {
          setOrderId(checkoutOrderIdFromUrl)
          checkoutOrderIdRef.current = checkoutOrderIdFromUrl
        }
        
        // Load user data from localStorage
        const userData = getUserDataFromLocalStorage()
        if (userData && isMounted) {
          if (userData.timezone) setUserTimezone(userData.timezone)
          if (userData.userEmail) setUserEmail(userData.userEmail)
        }
        
        // Primera carga de datos
        const isComplete = await loadPaymentData(checkoutOrderIdFromUrl)
        
        // Solo iniciar polling si no está completo y el estado es PENDING
        if (!isComplete && !isCompletedRef.current && isMounted) {
          // Configure polling interval - SOLO PARA PAGOS PENDIENTES
          const pollInterval = setInterval(async () => {
            if (!isMounted) {
              clearInterval(pollInterval)
              return
            }
            
            retryCountRef.current += 1
            
            // Si excedimos el número máximo de intentos, detenemos el polling
            if (retryCountRef.current > MAX_RETRIES) {
              console.log(`Reached maximum retries (${MAX_RETRIES}), stopping polling`)
              clearInterval(pollInterval)
              pollingTimeoutRef.current = null
              if (isMounted) setIsLoading(false)
              return
            }
            
            // Verificar estado del pago
            const isComplete = await loadPaymentData(checkoutOrderIdFromUrl)
            
            // Si el proceso está completo o el estado ya no es PENDING, detener polling
            if (isComplete || isCompletedRef.current || paymentStatus !== PaymentOrderStatus.Pending) {
              console.log("Payment status changed, stopping polling")
              clearInterval(pollInterval)
              pollingTimeoutRef.current = null
              
              // Establecer loading a false solo después de confirmar el estado
              if (isMounted) setIsLoading(false)
              return
            }
          }, 3000) // Verificar cada 3 segundos
          
          pollingTimeoutRef.current = pollInterval
        } else if (isMounted) {
          // Si ya está completo, no necesitamos polling
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error loading payment data:", error)
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to load booking information",
            variant: "destructive"
          })
          setIsLoading(false)
        }
      }
    }
    
    loadData()
    
    // Cleanup when unmounting
    return () => {
      isMounted = false
      if (pollingTimeoutRef.current) {
        clearInterval(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
    }
  }, [searchParams, toast, paymentStatus])
  
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