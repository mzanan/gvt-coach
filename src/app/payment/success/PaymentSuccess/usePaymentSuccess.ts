'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useToast } from '@/app/components/ui-kit/use-toast'
import { BookingDB } from '@/types/booking'
import { getUserDataFromCookies } from '@/lib/utils/payment'
import { bookingService } from '@/services/bookingService'
import { PaymentOrderStatus } from '@/types/enums'
import { getTimezoneCookie } from '@/lib/utils/cookies'

const POLL_INTERVAL_MS = 3000
const MAX_RETRIES = 10

interface ConfirmResponse {
  confirmed: boolean;
  status: PaymentOrderStatus;
  booking: BookingDB | null;
}

async function confirmCheckout(checkoutOrderId: string): Promise<ConfirmResponse | null> {
  try {
    const response = await fetch('/api/bookings/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkoutOrderId })
    })

    if (!response.ok) return null

    return await response.json() as ConfirmResponse
  } catch (error) {
    console.error('Error confirming checkout:', error)
    return null
  }
}

async function fetchLatestBookingByEmail(email: string): Promise<BookingDB | null> {
  try {
    if (!email) return null

    const response = await fetch(`/api/bookings/latest?email=${encodeURIComponent(email)}`)
    if (!response.ok) return null

    return await response.json() as BookingDB
  } catch {
    return null
  }
}

export const usePaymentSuccess = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isVoided, setIsVoided] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [booking, setBooking] = useState<BookingDB | null>(null)
  const [userTimezone, setUserTimezone] = useState('')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentOrderStatus>(PaymentOrderStatus.Pending)
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const retry = useCallback(() => {
    setHasError(false)
    setIsVoided(false)
    setIsLoading(true)
    setAttempt(previous => previous + 1)
  }, [])

  const isCompletedRef = useRef(false)

  const applyConfirmation = useCallback((result: ConfirmResponse) => {
    const cookieTimezone = getTimezoneCookie()

    if (result.booking) {
      setBooking({
        ...result.booking,
        user_timezone: cookieTimezone || result.booking.user_timezone
      })
    }

    setPaymentStatus(result.status)

    if (result.confirmed) {
      isCompletedRef.current = true
      setIsLoading(false)
      bookingService.clearTimeSlotsCache()
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let pollInterval: NodeJS.Timeout | null = null
    let retryCount = 0

    async function resolveCheckoutOrderId(): Promise<string | null> {
      const fromUrl = searchParams.get('checkout_order_id')
      if (fromUrl) return fromUrl

      const userData = getUserDataFromCookies()
      if (!userData?.userEmail) return null

      const latestBooking = await fetchLatestBookingByEmail(userData.userEmail)
      return latestBooking?.checkout_order_id || null
    }

    async function poll(checkoutOrderId: string) {
      const result = await confirmCheckout(checkoutOrderId)

      if (!isMounted || !result) return { confirmed: false, voided: false }

      applyConfirmation(result)
      return { confirmed: result.confirmed, voided: result.status === PaymentOrderStatus.Void }
    }

    async function loadData() {
      try {
        const cookieTimezone = getTimezoneCookie()
        const userData = getUserDataFromCookies()

        if (isMounted) {
          setUserTimezone(cookieTimezone || userData?.timezone || '')
          if (userData?.userEmail) setUserEmail(userData.userEmail)
        }

        const checkoutOrderId = await resolveCheckoutOrderId()

        if (!checkoutOrderId) {
          toast({
            title: 'Error',
            description: 'Booking information is missing. Please contact support.',
            variant: 'destructive'
          })
          if (isMounted) {
            setIsLoading(false)
            setHasError(true)
          }
          return
        }

        const first = await poll(checkoutOrderId)

        if (first.confirmed || !isMounted) return

        if (first.voided) {
          setIsLoading(false)
          setHasError(true)
          setIsVoided(true)
          return
        }

        pollInterval = setInterval(async () => {
          retryCount += 1

          if (!isMounted || retryCount > MAX_RETRIES) {
            if (pollInterval) clearInterval(pollInterval)
            if (isMounted) {
              setIsLoading(false)
              setHasError(true)
            }
            return
          }

          const result = await poll(checkoutOrderId)

          if (result.confirmed || result.voided) {
            if (pollInterval) clearInterval(pollInterval)
            if (result.voided && isMounted) {
              setIsLoading(false)
              setHasError(true)
              setIsVoided(true)
            }
          }
        }, POLL_INTERVAL_MS)
      } catch {
        if (isMounted) {
          toast({
            title: 'Error',
            description: 'Could not load booking information.',
            variant: 'destructive'
          })
          setIsLoading(false)
          setHasError(true)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [searchParams, toast, applyConfirmation, attempt])

  return {
    isLoading,
    hasError,
    isVoided,
    retry,
    isPaid: paymentStatus === PaymentOrderStatus.Paid || paymentStatus === PaymentOrderStatus.Active,
    booking,
    userTimezone,
    userEmail,
    paymentStatus,
    isEmailSending: false,
    isEmailSent: Boolean(booking?.confirmation_email_sent)
  }
}
