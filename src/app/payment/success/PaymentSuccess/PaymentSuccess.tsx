'use client'

import React from 'react'
import { Clock, Loader2, Check } from 'lucide-react'
import { Card } from '@/app/components/ui-kit/card'
import Link from 'next/link'
import { ChevronLeft } from "lucide-react"
import { BookingSummaryDisplay } from '@/app/components/features/booking/BookingSummaryDisplay'
import { usePaymentSuccess } from './usePaymentSuccess'
import { PaymentProgress } from '@/app/components/features/payment/PaymentProgress/PaymentProgress'

export function PaymentSuccess() {
  const {
    isLoading,
    isPaid,
    booking,
    userTimezone,
    userEmail,
    orderId,
    isEmailSending,
    isEmailSent
  } = usePaymentSuccess();

  if (isLoading || !isPaid) {
    return (
      <PaymentProgress
        icon={<Clock className="h-8 w-8 text-orange-500 mx-auto" />}
        title="Payment Processing"
        loadingText="Confirming your payment..."
        description="This will be updated automatically when your payment is processed. Please don't close this page."
        orderId={orderId}
        fallbackText="Processing your payment. If you've completed checkout, please wait a moment."
      />
    )
  }

  return (
    <div className="page-container py-8 max-w-2xl">
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
                <div className="flex items-center text-sm text-amber-600">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>Sending email to your account...</span>
                </div>
              ) : isEmailSent ? (
                <div className="flex items-center text-sm text-green-600">
                  <Check className="h-4 w-4 mr-2" />
                  <span>You can now close this screen</span>
                </div>
              ) : (
                <div className="flex items-center text-sm text-amber-600">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>Preparing email confirmation...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
} 