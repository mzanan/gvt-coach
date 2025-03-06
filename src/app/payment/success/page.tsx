'use client'

import { useEffect, useState } from 'react'
import { Card } from "@/app/components/ui-kit/card"
import { Button } from "@/app/components/ui-kit/button"
import Link from 'next/link'
import { ChevronLeft, Check } from "lucide-react"
import { Loader2 } from "lucide-react"
import { BookingSummaryDisplay } from '@/app/components/features/booking/BookingSummaryDisplay'
import { useRouter } from 'next/navigation'
import { BookingDB } from '@/app/types/booking'
import { BookingFrequency as SuperbaseBookingFrequency } from '@/app/types/enums/booking'
import { BookingFrequency as AppBookingFrequency } from '@/app/types/booking'
import { paymentService } from '@/services/paymentService';
import { PaymentOrderStatus } from '@/app/types/payments';
import { zoomService } from '@/services/zoomService';
import { getAuthToken } from '@/lib/auth';
import { useEmailNotifications } from '@/app/components/features/notifications/EmailNotifications';
import { useToast } from '@/app/components/ui-kit/use-toast';

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
  const [isLoading, setIsLoading] = useState(true)
  const [booking, setBooking] = useState<BookingDB | null>(null)
  const [userTimezone, setUserTimezone] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const router = useRouter()
  const { sendBookingConfirmation, isSending, error } = useEmailNotifications()
  const { toast } = useToast()

  // Obtener datos del usuario actual
  useEffect(() => {
    const getUserData = async () => {
      try {
        console.log('PaymentSuccess: Getting user data from localStorage...');
        
        // Get user data from localStorage
        if (typeof window !== 'undefined') {
          // Get user profile from localStorage
          const userProfileStr = localStorage.getItem('userProfile');
          if (userProfileStr) {
            try {
              const profileData = JSON.parse(userProfileStr);
              const profile = profileData.value; // Profile is inside .value
              
              if (profile && profile.email) {
                console.log('PaymentSuccess: Email found in localStorage:', profile.email);
                setUserEmail(profile.email);
                
                // Set name if available
                if (profile.first_name) {
                  const name = `${profile.first_name} ${profile.last_name || ''}`.trim();
                  setUserName(name);
                  console.log('PaymentSuccess: Name found in localStorage:', name);
                }
                return;
              }
            } catch (e) {
              console.error('PaymentSuccess: Error parsing user profile:', e);
            }
          } else {
            console.log('PaymentSuccess: No user profile found in localStorage');
          }
          
          // Also check for email in pendingBooking
          const pendingBookingStr = localStorage.getItem('pendingBooking');
          if (pendingBookingStr) {
            try {
              const pendingData = JSON.parse(pendingBookingStr);
              if (pendingData.userEmail) {
                console.log('PaymentSuccess: Email found in pendingBooking.userEmail:', pendingData.userEmail);
                setUserEmail(pendingData.userEmail);
                return;
              }
              if (pendingData.booking && pendingData.booking.user_email) {
                console.log('PaymentSuccess: Email found in pendingBooking.booking.user_email:', pendingData.booking.user_email);
                setUserEmail(pendingData.booking.user_email);
                return;
              }
            } catch (e) {
              console.error('PaymentSuccess: Error parsing pendingBooking:', e);
            }
          }
        }
        
        console.log('PaymentSuccess: Could not find email in localStorage');
      } catch (error) {
        console.error('PaymentSuccess: Error getting user data:', error);
      }
    }
    
    getUserData()
  }, [])

  useEffect(() => {
    const pendingBooking = localStorage.getItem('pendingBooking')
    if (!pendingBooking) {
      router.push('/')
      return
    }
    
    console.log('PaymentSuccess: Complete pendingBooking content:', JSON.parse(pendingBooking));
    
    const bookingData = JSON.parse(pendingBooking)
    setUserTimezone(bookingData.selectedTimezone)
    setBooking(bookingData.booking)
    setIsLoading(false)
  }, [router])

  // Enviar correo de confirmación cuando tengamos los datos necesarios
  useEffect(() => {
    const sendConfirmationEmail = async () => {
      // Si ya se envió un email o hay un error previo, no hacer nada
      if (emailSent) {
        console.log('PaymentSuccess: Email was already sent, skipping');
        return;
      }

      // Determinar qué email usar (prioridad: userEmail, luego booking.user_email)
      const emailToUse = process.env.NODE_ENV === 'development' 
        ? process.env.NEXT_PUBLIC_COACH_EMAIL 
        : (userEmail || booking?.user_email);

      
      if (!booking || !emailToUse || isLoading) {
        const reason = !booking 
          ? 'No booking data available' 
          : !emailToUse 
            ? 'No user email available' 
            : 'Page is still loading';
              
        console.log(`PaymentSuccess: Not sending email automatically. Reason: ${reason}`);
        return;
      }

      // Marcar como enviado antes de intentar enviar para prevenir múltiples intentos
      setEmailSent(true);

      console.log(`PaymentSuccess: Attempting to send email to:`, emailToUse);
      console.log('PaymentSuccess: Booking details:', {
        id: booking.id,
        date: new Date(booking.booking_date).toLocaleString(),
        duration: booking.duration || 60,
        link: booking.meet_link || 'Not available',
        email_source: userEmail ? 'userEmail state' : 'booking.user_email'
      });
      
      try {
        const success = await sendBookingConfirmation(booking, emailToUse, userName || undefined);
        
        if (success) {
          console.log('PaymentSuccess: Confirmation email sent successfully');
          
          toast({
            title: "Email sent",
            description: "We've sent the confirmation to your email",
          });
        } else {
          console.error('PaymentSuccess: Error sending confirmation email');
          console.error('PaymentSuccess: Reported error:', error);
          
          setEmailSent(false); // Allow retry if failed
          setEmailError(`Could not send the email automatically. Please use the button to try manually.`);
          
          toast({
            title: "Error sending email",
            description: error || "Could not send confirmation automatically. Use the button to try manually.",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('PaymentSuccess: Exception sending confirmation email:', error);
        
        setEmailSent(false); // Allow retry if failed
        const errorMessage = error instanceof Error 
          ? `Error: ${error.message}` 
          : "Unexpected error sending the email";
          
        setEmailError(`${errorMessage}. Try with the manual button.`);
        
        toast({
          title: "Unexpected error",
          description: "An error occurred sending the confirmation. Try with the manual button.",
          variant: "destructive"
        });
      }
    };
    
    // Solo intentamos enviar el correo si tenemos los datos necesarios y no se ha enviado ya
    if (booking?.meet_link && !emailSent) {
      sendConfirmationEmail();
    }
  }, [booking?.meet_link]); // Solo depender del meet_link para enviar el email

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    const checkStatus = async () => {
      const pendingBooking = localStorage.getItem('pendingBooking');
      if (!pendingBooking) return;
  
      const data = JSON.parse(pendingBooking);
      if (!data.orderId) {
        console.error('No orderId found in pendingBooking');
        router.push('/payment/cancel');
        return;
      }
  
      try {
        const orderStatus = await paymentService.getOrderStatus(data.orderId);
        console.log('orderStatus:', orderStatus);
        
        // Si hay un email en el booking, guardarlo
        if (data.booking && data.booking.user_email && !userEmail) {
          console.log('PaymentSuccess: Email obtained from booking in checkStatus:', data.booking.user_email);
          setUserEmail(data.booking.user_email);
        }

        if ([PaymentOrderStatus.Active, PaymentOrderStatus.Paid].includes(orderStatus)) {
          if (interval) clearInterval(interval);

          try {
            const meetLink = await zoomService.createMeeting(new Date(data.booking.booking_date));
            const token = await getAuthToken();
            
            // Log the full URL being used for the API call
            const apiUrl = `/api/bookings/${data.booking.id}`;
            console.log('Making API call to:', apiUrl);
            console.log('Booking ID being used:', data.booking.id);
            
            try {
              const response = await fetch(apiUrl, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  meet_link: meetLink
                })
              });

              if (!response.ok) {
                console.error('Failed API response:', {
                  status: response.status,
                  statusText: response.statusText
                });
                
                // Try to get the error message from the response
                try {
                  const errorData = await response.json();
                  console.error('API error details:', errorData);
                } catch (e) {
                  console.error('Could not parse error response', e);
                }
                
                // If response is 404 (Not Found), try to find the booking by order_id instead
                if (response.status === 404 && data.orderId) {
                  console.log('Booking not found by ID, attempting to find by order_id:', data.orderId);
                  
                  // Make a request to fetch the booking by order_id
                  const orderResponse = await fetch(`/api/bookings/by-order/${data.orderId}`, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  
                  if (orderResponse.ok) {
                    const bookingByOrder = await orderResponse.json();
                    console.log('Found booking by order_id:', bookingByOrder);
                    
                    if (bookingByOrder?.id) {
                      // Now try to update this booking with the Zoom link
                      const updateResponse = await fetch(`/api/bookings/${bookingByOrder.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          meet_link: meetLink
                        })
                      });
                      
                      if (updateResponse.ok) {
                        const updatedBooking = await updateResponse.json();
                        console.log('Successfully updated booking using order_id lookup:', updatedBooking);
                        setBooking(updatedBooking);
                        setIsLoading(false);
                        localStorage.removeItem('pendingBooking');
                        return; // Exit the function early
                      } else {
                        console.error('Failed to update booking even after finding by order_id');
                      }
                    }
                  } else {
                    console.error('Failed to find booking by order_id:', data.orderId);
                  }
                }
                
                throw new Error('Failed to update booking with Zoom link');
              }

              const updatedBooking = await response.json();

              setBooking(updatedBooking);
              setIsLoading(false);

              localStorage.removeItem('pendingBooking');
            } catch (fetchError) {
              console.error('Fetch error:', fetchError);
              // Still show the booking information even if the update failed
              setBooking({
                ...data.booking,
                meet_link: meetLink // Add the meet link anyway so user has access
              });
              setIsLoading(false);
              
              // Show error but don't remove pendingBooking
              // so we can try again later if needed
              throw fetchError;
            }
          } catch (error) {
            console.error('Error creating/updating Zoom meeting:', error);
            setBooking(data.booking);
            setIsLoading(false);
          }
        } else if ([PaymentOrderStatus.Cancelled].includes(orderStatus)) {
          if (interval) clearInterval(interval);
          router.push('/payment/cancel');
        }

        // Verificar si tenemos el email después de obtener el booking actualizado
        if (booking && booking.user_email && !userEmail) {
          console.log('PaymentSuccess: Email obtained from updated booking:', booking.user_email);
          setUserEmail(booking.user_email);
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        if (interval) clearInterval(interval);
        router.push('/payment/cancel');
      }
    };
  
    checkStatus();
    interval = setInterval(checkStatus, 5000);
  
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [router]);


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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Processing your booking...</h1>
          <p className="text-muted-foreground">Please wait while we confirm your payment</p>
        </Card>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Booking Not Found</h1>
          <p className="text-muted-foreground">Unable to load booking details</p>
          <div className="mt-8">
            <Button variant="outline" asChild>
              <Link href="/">
                Return to Calendar
              </Link>
            </Button>
          </div>
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
                📩 We&apos;ve sent your session details to <span className="font-medium text-foreground">{userEmail || booking.user_email}</span>.
              </p>
            </div>
          </div>
          
          <div>
            <h2 className="font-medium text-lg mb-2">Booking Reference</h2>
            <p className="font-mono text-sm text-muted-foreground">{booking.id}</p>
          </div>
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