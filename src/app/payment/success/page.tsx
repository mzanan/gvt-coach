import { Suspense } from "react"
import { Card } from "@/app/components/ui-kit/card"
import { Loader2, Clock } from "lucide-react"
import { PaymentSuccess } from './PaymentSuccess/PaymentSuccess'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payment Success',
  description: 'Your payment has been completed successfully.',
}

/**
 * Payment success page wrapped in a Suspense boundary
 */
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="page-container py-8 max-w-2xl">
        <Card className="p-8 text-center">
          <Clock className="h-8 w-8 text-orange-500 mx-auto" />
          <h1 className="text-2xl font-bold mb-2">Loading Payment Details</h1>
          <div className="flex justify-center my-6">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <p>Please wait...</p>
          </div>
        </Card>
      </div>
    }>
      <PaymentSuccess />
    </Suspense>
  )
}