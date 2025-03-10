'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from "@/app/components/ui-kit/card"
import { Button } from "@/app/components/ui-kit/button"
import Link from 'next/link'
import { ChevronLeft, Check } from "lucide-react"
import { Loader2, Clock } from "lucide-react"
import { BookingSummaryDisplay } from '@/app/components/features/booking/BookingSummaryDisplay'
import { useRouter } from 'next/navigation'
import { BookingDB } from '@/app/types/booking'
import { BookingFrequency as SuperbaseBookingFrequency } from '@/app/types/enums/booking'
import { BookingFrequency as AppBookingFrequency } from '@/app/types/booking'
import { useEmailNotifications } from '@/app/components/features/notifications/EmailNotifications';
import { useToast } from '@/app/components/ui-kit/use-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Helper function to convert between BookingFrequency types
function convertBookingFrequency(frequency: SuperbaseBookingFrequency): AppBookingFrequency {
  switch (frequency) {
    case SuperbaseBookingFrequency.Once:
      return 'once';
    case SuperbaseBookingFrequency.Weekly:
      return 'weekly';
    case SuperbaseBookingFrequency.TwiceWeekly:
      return 'twice-weekly';
    default:
      return 'once'; // Default fallback
  }
}

export default function PaymentSuccessPage() {
  const [isPaymentPending, setIsPaymentPending] = useState(true)
  const [booking, setBooking] = useState<BookingDB | null>(null)
  const [userTimezone, setUserTimezone] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [emailRetryCount, setEmailRetryCount] = useState(0)
  const MAX_EMAIL_RETRIES = 3
  const router = useRouter()
  const { sendBookingConfirmation, isSending } = useEmailNotifications()
  const { toast } = useToast()
  const supabase = createClientComponentClient()

  // Enviar confirmación por email
  const sendConfirmationEmail = useCallback(async () => {
    if (!booking || !userEmail || emailSent || isSending || emailRetryCount >= MAX_EMAIL_RETRIES) return;
    
    try {
      // Call sendBookingConfirmation with the correct parameters
      const success = await sendBookingConfirmation(
        booking,
        userEmail,
        userName || undefined
      );
      
      if (success) {
        setEmailSent(true);
        
        toast({
          title: "Confirmation Sent",
          description: "We've sent you an email with your booking details",
          variant: "default"
        });
      } else {
        throw new Error("Failed to send email");
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      setEmailRetryCount(prev => prev + 1);
      
      if (emailRetryCount >= MAX_EMAIL_RETRIES - 1) {
        setEmailError("We couldn't send the confirmation email automatically. Please contact support.");
      } else {
        setEmailError(`We couldn't send the confirmation email automatically. Retrying... (${emailRetryCount + 1}/${MAX_EMAIL_RETRIES})`);
      }
      
      toast({
        title: "Couldn't Send Email",
        description: emailRetryCount >= MAX_EMAIL_RETRIES - 1 
          ? "Failed to send confirmation after multiple attempts. Please contact support."
          : "There was an error sending the confirmation email. Retrying...",
        variant: "destructive"
      });
    }
  }, [booking, userEmail, userName, emailSent, isSending, toast, sendBookingConfirmation, emailRetryCount, MAX_EMAIL_RETRIES]);

  // Obtener datos del usuario actual
  useEffect(() => {
    const getUserData = async () => {
      try {
        // Get user data from localStorage
        if (typeof window !== 'undefined') {
          // Get user profile from localStorage
          const userProfileStr = localStorage.getItem('userProfile');
          if (userProfileStr) {
            try {
              const profileData = JSON.parse(userProfileStr);
              const profile = profileData.value; // Profile is inside .value
              
              if (profile && profile.email) {
                setUserEmail(profile.email);
                
                // Set name if available
                if (profile.first_name) {
                  const name = `${profile.first_name} ${profile.last_name || ''}`.trim();
                  setUserName(name);
                }
                return;
              }
            } catch (e: unknown) {
              const errorMessage = e instanceof Error ? e.message : String(e);
              throw new Error(`Error getting user data: ${errorMessage}`);
            }
          }

          // Also check for email in pendingBooking
          const pendingBookingStr = localStorage.getItem('pendingBooking');
          if (pendingBookingStr) {
            try {
              const pendingData = JSON.parse(pendingBookingStr);
              if (pendingData.userEmail) {
                setUserEmail(pendingData.userEmail);
                return;
              }
              if (pendingData.booking && pendingData.booking.user_email) {
                setUserEmail(pendingData.booking.user_email);
                return;
              }
            } catch (e: unknown) {
              const errorMessage = e instanceof Error ? e.message : String(e);
              throw new Error(`Error getting user data: ${errorMessage}`);
            }
          }
        }
      } catch (e: unknown) {
        // En lugar de silenciar el error, lo registramos pero permitimos que la UI siga funcionando
        console.error("Error al cargar datos de usuario:", e);
      }
    }
    
    getUserData()
  }, [])

  // Load booking data from localStorage
  useEffect(() => {
    const pendingBooking = localStorage.getItem('pendingBooking')
    if (!pendingBooking) {
      router.push('/')
      return
    }
    
    const bookingData = JSON.parse(pendingBooking)
    setUserTimezone(bookingData.selectedTimezone)
    setOrderId(bookingData.orderId)
    
    // No direct booking assignment here - we'll get it from the database
  }, [router])
  
  // Set up a Supabase subscription to listen for payment status changes
  useEffect(() => {
    if (!orderId) return;
    
    // First, get the current status
    const checkPaymentStatus = async () => {
      if (!orderId) return;
      
      try {
        // Primero buscar en la tabla de mapeo
        const { data: mappingData, error: mappingError } = await supabase
          .from('gvt_coach_checkout_mapping')
          .select('payment_status_id')
          .eq('checkout_order_id', orderId)
          .maybeSingle();

        if (mappingError) {
          console.error(`Error fetching mapping for orderId ${orderId}:`, mappingError);
          return;
        }
        
        if (!mappingData || !mappingData.payment_status_id) {
          console.warn(`No payment mapping found for orderId: ${orderId}`);
          return;
        }
          
        // Buscar el estado del pago usando el ID
        const { data: paymentStatus, error: paymentError } = await supabase
          .from('gvt_coach_payments_status')
          .select('*')
          .eq('id', mappingData.payment_status_id)
          .maybeSingle();
          
        if (paymentError) {
          console.error(`Error fetching payment status:`, paymentError);
          return;
        }
        
        if (!paymentStatus) {
          console.warn(`No payment status found`);
          return;
        }
        
        // Si el pago está confirmado, buscar la reserva
        if (paymentStatus.status === 'PAID' || paymentStatus.status === 'ACTIVE') {
          setIsPaymentPending(false);
          
          // Buscar la reserva que referencia este checkout_order_id
          const { data: bookingData, error: bookingError } = await supabase
            .from('gvt_coach_meetings_bookings')
            .select('*')
            .eq('checkout_order_id', orderId)
            .single();
            
          if (bookingError) {
            console.error(`Error fetching booking for orderId ${orderId}:`, bookingError);
            return;
          }
          
          if (!bookingData) {
            console.warn(`No booking found for orderId: ${orderId}`);
            return;
          }
          
          // Only log once when booking is first found
          if (!booking && bookingData) {
            console.log('Found booking:', bookingData);
          }
          
          setBooking(bookingData);
          
          // If we have a booking and email, send the confirmation
          if (bookingData && userEmail && !emailSent && !isSending && emailRetryCount < MAX_EMAIL_RETRIES) {
            sendConfirmationEmail();
          }
        }
      }
      catch (e: unknown) {
        // Registramos el error pero permitimos que la UI siga funcionando
        console.error("Error checking payment status:", e);
      }
    };
    
    // Check immediately
    checkPaymentStatus();
    
    // Set up subscription for real-time updates
    const subscription = supabase
      .channel('payment-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'gvt_coach_payments_status',
          filter: `checkout_order_id=eq.${orderId}`
        },
        () => {
          // Reduced logging
          checkPaymentStatus();
        }
      )
      .subscribe();
      
    // Poll every 15 seconds instead of 5 to reduce load
    const interval = setInterval(checkPaymentStatus, 15000);
    
    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [orderId, userEmail, emailSent, isSending, supabase, sendConfirmationEmail, booking, emailRetryCount, MAX_EMAIL_RETRIES]);

  // Actualizar el mensaje en la interfaz
  function getStatusMessage() {
    if (emailSent) {
      return "We've sent the details to your email";
    }
    
    if (isSending) {
      return "Sending confirmation to your email...";
    }
    
    if (emailError) {
      return "Could not send confirmation automatically";
    }
    
    return "Confirm your booking details";
  }

  if (isPaymentPending) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Card className="p-8 text-center">
          <Clock className="h-8 w-8 text-orange-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Payment Processing</h1>
          <div className="flex justify-center my-6">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <p>Waiting for payment confirmation...</p>
          </div>
          <p className="text-muted-foreground mb-4">
            This may take a few moments. Please don&apos;t close this page.
          </p>
          <p className="text-xs text-muted-foreground">
            Order ID: {orderId}
          </p>
        </Card>
      </div>
    )
  }

  // Si el pago está confirmado pero no tenemos datos de la reserva aún,
  // seguimos mostrando "Payment Processing" en lugar de "Loading Booking Details"
  if (!booking) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Card className="p-8 text-center">
          <Clock className="h-8 w-8 text-orange-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Payment Processing</h1>
          <div className="flex justify-center my-6">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <p>Waiting for payment confirmation...</p>
          </div>
          <p className="text-muted-foreground mb-4">
            This may take a few moments. Please don&apos;t close this page.
          </p>
          <p className="text-xs text-muted-foreground">
            Order ID: {orderId}
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Link href="/" className="text-primary hover:underline mb-8 inline-flex items-center gap-2">
        <ChevronLeft className="h-4 w-4" />
        Back to Calendar
      </Link>

      <Card className="max-w-2xl mx-auto p-8">
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground">
            {getStatusMessage()}
          </p>
          {emailError && (
            <p className="text-red-500 text-sm mt-2">
              {emailError}
            </p>
          )}
       
        </div>
              
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h2 className="font-medium text-lg mb-3">Schedule Details</h2>
            <div className="space-y-2 text-muted-foreground">
              <BookingSummaryDisplay 
                booking={booking ? {
                  ...booking,
                  frequency: convertBookingFrequency(booking.frequency)
                } : null}
                timezone={userTimezone}
              />
            </div>
          </div>
          
          <div className="border-b pb-4">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                📩 We&apos;ve sent your session details to <span className="font-medium text-foreground">{userEmail || (booking?.user_email || '')}</span>.
              </p>
            </div>
          </div>
          
          {booking && (
            <div>
              <h2 className="font-medium text-lg mb-2">Booking Reference</h2>
              <p className="font-mono text-sm text-muted-foreground">{booking.id}</p>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Button variant="outline" asChild>
            <Link href="/">
              Book Another Session
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}