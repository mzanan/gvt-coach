import { Suspense } from "react"
import { Clock } from "lucide-react"
import { PaymentSuccess } from './PaymentSuccess/PaymentSuccess'
import { PaymentProgress } from '@/app/components/features/payment/PaymentProgress/PaymentProgress'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Payment Success',
  description: 'Your payment has been completed successfully.',
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <PaymentProgress
        icon={<Clock className="h-8 w-8 text-warning-text mx-auto" />}
        title="Payment Processing"
        loadingText="Confirming your payment..."
        description="This will be updated automatically when your payment is processed. Please don't close this page."
        fallbackText="Processing your payment. If you've completed checkout, please wait a moment."
      />
    }>
      <PaymentSuccess />
    </Suspense>
  )
}
