'use client'

import { useEffect, useState } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { ChevronLeft, Check, Video } from "lucide-react"
import { Loader2 } from "lucide-react"
import { BookingSummaryDisplay } from '@/app/components/BookingSummaryDisplay'
import { useRouter } from 'next/navigation'
import { BookingDB, BookingStatus } from '@/lib/supabase/types'
import { paymentService } from '@/app/services/paymentService';
import { PaymentOrderStatus } from '@/app/types/payments';
import { zoomService } from '@/app/services/zoomService';
import { supabase } from '@/lib/supabase/client'
import { getAuthToken } from '@/app/helpers/authHelpers';
import { useEmailNotifications } from '@/hooks/useEmailNotifications';
import { useToast } from '@/hooks/use-toast';

export default function PaymentSuccessPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [booking, setBooking] = useState<BookingDB | null>(null)
  const [userTimezone, setUserTimezone] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()
  const { sendBookingConfirmation, isSending, error } = useEmailNotifications()
  const { toast } = useToast()

  // Obtener datos del usuario actual
  useEffect(() => {
    const getUserData = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setUserEmail(data.session.user.email || null)
        // Intentamos obtener el nombre del usuario si existe
        const { data: userData } = await supabase
          .from('profiles')
          .select('full_name, first_name')
          .eq('id', data.session.user.id)
          .single()
        
        if (userData) {
          setUserName(userData.full_name || userData.first_name || null)
        }
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
    
    const bookingData = JSON.parse(pendingBooking)
    setUserTimezone(bookingData.selectedTimezone)
    setBooking(bookingData.booking)
    setIsLoading(false)
  }, [router])

  // Enviar correo de confirmación cuando tengamos los datos necesarios
  useEffect(() => {
    const sendConfirmationEmail = async () => {
      if (booking && userEmail && !emailSent && !isLoading) {
        console.log('Sending booking confirmation email to:', userEmail);
        
        try {
          // Aseguramos que userEmail no sea null
          const success = await sendBookingConfirmation(booking, userEmail, userName || undefined);
          
          if (success) {
            console.log('Booking confirmation email sent successfully');
            setEmailSent(true);
            toast({
              title: "Email enviado",
              description: "Se ha enviado la confirmación a tu correo electrónico",
            });
          } else {
            console.error('Failed to send booking confirmation email');
            toast({
              title: "Error al enviar email",
              description: "No se pudo enviar la confirmación a tu correo. Intenta más tarde.",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error('Error sending booking confirmation email:', error);
        }
      }
    };
    
    sendConfirmationEmail();
  }, [booking, userEmail, emailSent, isLoading, sendBookingConfirmation, userName, toast]);

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
        
        if ([PaymentOrderStatus.Active, PaymentOrderStatus.Paid].includes(orderStatus)) {
          if (interval) clearInterval(interval);

          try {
            console.log('About to create Zoom meeting for booking:', {
              bookingId: data.booking.id,
              bookingDate: data.booking.booking_date,
              fullBookingObject: data.booking
            });
            
            const meetLink = await zoomService.createMeeting(new Date(data.booking.booking_date));
            console.log('Zoom meeting created:', meetLink);
            
            const token = await getAuthToken();
            
            // Log the full URL being used for the API call
            const apiUrl = `/api/bookings/${data.booking.id}`;
            console.log('Making API call to:', apiUrl);
            console.log('Booking ID being used:', data.booking.id);
            console.log('Token length:', token ? token.length : 'No token');
            
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

              console.log('API response status:', response.status);
              
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
                  console.error('Could not parse error response');
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
              console.log('Booking updated with Zoom link:', updatedBooking);

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
            {emailSent 
              ? "Hemos enviado los detalles a tu correo electrónico" 
              : isSending 
                ? "Enviando confirmación a tu correo..." 
                : "Confirma los detalles de tu reserva"
            }
          </p>
          {error && (
            <p className="text-red-500 text-sm mt-2">
              No pudimos enviar el correo de confirmación. Por favor, guarda esta información.
            </p>
          )}
        </div>

        <div className="space-y-6">
          <div className="border-b pb-4">
            <h2 className="font-medium text-lg mb-3">Schedule Details</h2>
            <div className="space-y-2 text-muted-foreground">
              <BookingSummaryDisplay 
                booking={booking}
                timezone={userTimezone}
              />
            </div>
          </div>

          <div className="border-b pb-4">
            <h2 className="font-medium text-lg mb-3">Meeting Link</h2>
            <a 
              href={booking.meet_link} 
              className="inline-flex items-center gap-2 text-primary hover:underline" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Video className="h-4 w-4" />
              Join Zoom Meeting
            </a>
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