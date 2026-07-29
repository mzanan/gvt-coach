'use client'

import React, { useEffect, useState } from 'react'
import { Clock, Loader2, Check, AlertTriangle } from 'lucide-react'
import { PaymentCard } from '@/app/components/features/payment/PaymentCard/PaymentCard'
import { Button } from '@/app/components/ui-kit/button'
import Link from 'next/link'
import { ChevronLeft } from "lucide-react"
import { BookingSummaryDisplay } from '@/app/components/features/booking/BookingSummaryDisplay'
import { usePaymentSuccess } from './usePaymentSuccess'
import { PaymentProgress } from '@/app/components/features/payment/PaymentProgress/PaymentProgress'

const MIN_LOADING_MS = 600

export function PaymentSuccess() {
  const {
    isLoading,
    hasError,
    isVoided,
    retry,
    isPaid,
    booking,
    userTimezone,
    userEmail,
    isEmailSending,
    isEmailSent
  } = usePaymentSuccess();

  const [minLoadingElapsed, setMinLoadingElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinLoadingElapsed(true), MIN_LOADING_MS);
    return () => clearTimeout(timer);
  }, []);

  if (isVoided) {
    return (
      <PaymentProgress
        icon={<AlertTriangle className="h-8 w-8 text-destructive mx-auto" />}
        title="This payment was canceled"
        description="This checkout was canceled or voided, so it can't be confirmed. Please start a new booking if you'd still like a session."
        action={<Button asChild><Link href="/">Back to booking</Link></Button>}
      />
    )
  }

  if (hasError && !isPaid) {
    return (
      <PaymentProgress
        icon={<AlertTriangle className="h-8 w-8 text-destructive mx-auto" />}
        title="We couldn't confirm your payment"
        description="This can happen if the confirmation is just delayed. If you completed checkout, your booking may still go through, try again in a moment or contact support with your email."
        action={<Button onClick={retry}>Try again</Button>}
      />
    )
  }

  if (isLoading || !isPaid || !minLoadingElapsed) {
    return (
      <PaymentProgress
        icon={<Clock className="h-8 w-8 text-warning-text mx-auto" />}
        title="Payment Processing"
        loadingText="Confirming your payment..."
        description="This will be updated automatically when your payment is processed. Please don't close this page."
        fallbackText="Processing your payment. If you've completed checkout, please wait a moment."
      />
    )
  }

  return (
    <div className="page-container py-8 max-w-2xl animate-in fade-in-0 duration-300 motion-reduce:animate-none">
      <Link href="/" className="text-primary hover:underline mb-8 inline-flex items-center gap-2">
        <ChevronLeft className="h-4 w-4" />
        Back to Calendar
      </Link>

      <PaymentCard>
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-success-surface rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-6 w-6 text-success-text" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
          <p className="text-muted-foreground">
            Your booking is confirmed and ready to go
          </p>
        </div>
              
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h2 className="font-medium text-lg mb-3">Schedule Details</h2>
            <div className="space-y-2 text-muted-foreground" data-testid="booking-details">
              <BookingSummaryDisplay 
                booking={booking ? {
                  ...booking,
                  user_timezone: userTimezone
                } : null}
                timezone={userTimezone}
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <p className="text-muted-foreground">
              📩 Your session details have been sent to <span className="font-medium text-foreground">{userEmail || (booking?.user_email || '')}</span>.
            </p>
            
            <div className="flex items-center justify-center border-t pt-4 mt-4">
              {isEmailSending ? (
                <div className="flex items-center text-sm text-warning-text">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>Sending email to your account...</span>
                </div>
              ) : isEmailSent ? (
                <div className="flex items-center text-sm text-success-text">
                  <Check className="h-4 w-4 mr-2" />
                  <span>You can now close this screen</span>
                </div>
              ) : (
                <div className="flex items-center text-sm text-warning-text">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>Preparing email confirmation...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </PaymentCard>
    </div>
  )
}