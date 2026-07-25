import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/app/components/ui-kit/use-toast'
import { BookingDB } from '@/types/booking'
import { getUserDataFromCookies } from '@/lib/utils/payment'
import { fetchBookingByOrderId, fetchPaymentMapping, fetchPaymentStatus } from '@/lib/utils/payment/queries'
import { bookingService } from '@/services/bookingService'
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

  const retryCountRef = useRef(0)
  const MAX_RETRIES = 10
  const checkoutOrderIdRef = useRef<string | null>(null)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isCompletedRef = useRef(false)
  const emailSentRef = useRef(false)
  const effectExecutionFlag = useRef(false)

  const sendConfirmationEmailOnce = useCallback(async function sendConfirmationEmail(bookingData: BookingDB) {
    if (emailSentRef.current) {
      return;
    }

    emailSentRef.current = true;

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

      setIsEmailSending(false);
      setIsEmailSent(true);
    } catch (emailError) {
      emailSentRef.current = false;
      console.error("Error enviando correo de confirmación:", emailError);
      setIsEmailSending(false);

      setTimeout(() => {
        if (bookingData) {
          sendConfirmationEmail(bookingData);
        }
      }, 5000);
    }
  }, []);

  const handleBookingConfirmation = useCallback(async (bookingData: BookingDB) => {
    try {
      const cookieTimezone = getTimezoneCookie();
      const bookingWithUserTimezone = {
        ...bookingData,
        user_timezone: cookieTimezone || bookingData.user_timezone
      };

      if (bookingWithUserTimezone.meet_link && bookingWithUserTimezone.confirmation_email_sent) {
        emailSentRef.current = true;
        setIsEmailSent(true);
        return bookingWithUserTimezone;
      }

      const updateResponse = await fetch(`/api/bookings/${encodeURIComponent(bookingWithUserTimezone.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: PaymentOrderStatus.Paid,
          checkout_completed: true,
          payment_confirmed: true,
          user_timezone: bookingWithUserTimezone.user_timezone
        })
      });

      if (!updateResponse.ok) {
        console.error("Error actualizando estado del booking:", updateResponse.status);
        return null;
      }

      const data = await updateResponse.json();
      const updatedBooking = data || bookingWithUserTimezone;

      const finalBooking = {
        ...updatedBooking,
        user_timezone: cookieTimezone || updatedBooking.user_timezone || bookingWithUserTimezone.user_timezone
      };

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
            const meetLinkResponse = await fetch(`/api/bookings/${encodeURIComponent(finalBooking.id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ meet_link: zoomData.join_url })
            });

            if (meetLinkResponse.ok) {
              finalBooking.meet_link = zoomData.join_url;
            }
          }
        }
      }

      setBooking(finalBooking);
      setPaymentStatus(PaymentOrderStatus.Paid);
      isCompletedRef.current = true;
      setIsLoading(false);

      if (!bookingWithUserTimezone.confirmation_email_sent && !emailSentRef.current) {
        await sendConfirmationEmailOnce(finalBooking);
      } else if (bookingWithUserTimezone.confirmation_email_sent) {
        setIsEmailSent(true);
      }

      bookingService.clearTimeSlotsCache();

      return finalBooking;
    } catch (error) {
      console.error("Error en handleBookingConfirmation:", error);
      return null;
    }
  }, [sendConfirmationEmailOnce]);

  const loadPaymentData = useCallback(async (checkoutOrderId: string) => {
    try {
      if (isCompletedRef.current) {
        return true;
      }

      const bookingData = await fetchBookingByOrderId(checkoutOrderId);

      if (bookingData) {
        const cookieTimezone = getTimezoneCookie();
        const updatedBookingData = {
          ...bookingData,
          user_timezone: cookieTimezone || bookingData.user_timezone
        };

        if (updatedBookingData.confirmation_email_sent) {
          emailSentRef.current = true;
        }

        if (updatedBookingData.payment_status === PaymentOrderStatus.Paid ||
            updatedBookingData.payment_confirmed === true ||
            updatedBookingData.checkout_completed === true) {

          setBooking(updatedBookingData);
          setPaymentStatus(PaymentOrderStatus.Paid);
          isCompletedRef.current = true;
          setIsLoading(false);

          await handleBookingConfirmation(updatedBookingData);
          return true;
        }

        setBooking(updatedBookingData);
      }

      const mappingData = await fetchPaymentMapping(checkoutOrderId);

      if (!mappingData) {
        console.warn("No payment mapping found");
        return false;
      }

      if (mappingData.payment_status_id) {
        const paymentStatusData = await fetchPaymentStatus(mappingData.payment_status_id);

        if (paymentStatusData) {
          const statusFromRecord = paymentStatusData.status;

          setPaymentStatus(statusFromRecord);

          if (statusFromRecord === PaymentOrderStatus.Paid || statusFromRecord === PaymentOrderStatus.Active) {
            isCompletedRef.current = true;
            setBooking(bookingData);
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

  const fetchLatestBookingByEmail = useCallback(async (email: string): Promise<BookingDB | null> => {
    try {
      if (!email) return null

      const response = await fetch(`/api/bookings/latest?email=${encodeURIComponent(email)}`)

      if (!response.ok) {
        return null
      }

      return await response.json() as BookingDB
    } catch {
      console.error("Error en fetchLatestBookingByEmail:")
      return null
    }
  }, []);

  useEffect(() => {
    let isMounted = true

    async function loadData() {
      if (effectExecutionFlag.current) return
      effectExecutionFlag.current = true

      try {
        const checkoutOrderIdFromUrl = searchParams.get('checkout_order_id')

        const cookieTimezone = getTimezoneCookie()
        if (cookieTimezone && isMounted) {
          setUserTimezone(cookieTimezone)
        } else {
          const userData = getUserDataFromCookies()
          if (userData && isMounted) {
            if (userData.timezone) setUserTimezone(userData.timezone)
            if (userData.userEmail) setUserEmail(userData.userEmail)
          }
        }

        const userData = getUserDataFromCookies()
        if (userData && userData.userEmail && isMounted) {
          setUserEmail(userData.userEmail)
        }

        if (!checkoutOrderIdFromUrl) {
          if (userData && userData.userEmail) {
            const bookingByEmail = await fetchLatestBookingByEmail(userData.userEmail)

            if (bookingByEmail) {
              const updatedBooking = {
                ...bookingByEmail,
                user_timezone: cookieTimezone || userData.timezone || bookingByEmail.user_timezone
              };

              setBooking(updatedBooking)
              checkoutOrderIdRef.current = updatedBooking.checkout_order_id || null

              if (updatedBooking.payment_status === PaymentOrderStatus.Paid ||
                  updatedBooking.payment_confirmed === true ||
                  updatedBooking.payment_status === PaymentOrderStatus.Completed) {

                setBooking(updatedBooking)
                setPaymentStatus(PaymentOrderStatus.Paid)
                isCompletedRef.current = true
                setIsLoading(false)

                await handleBookingConfirmation(updatedBooking);
              } else if (updatedBooking.checkout_order_id) {
                const isComplete = await loadPaymentData(updatedBooking.checkout_order_id)

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
            toast({
              title: "Error",
              description: "Falta información de usuario. Por favor contacte soporte.",
              variant: "destructive"
            })
            if (isMounted) setIsLoading(false)
          }
          return
        }

        if (isMounted) {
          setOrderId(checkoutOrderIdFromUrl)
          checkoutOrderIdRef.current = checkoutOrderIdFromUrl
        }

        const isComplete = await loadPaymentData(checkoutOrderIdFromUrl)

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
