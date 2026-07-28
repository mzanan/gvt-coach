import { ReactNode } from 'react'
import { Loader2 } from "lucide-react"
import { PaymentCard } from "@/app/components/features/payment/PaymentCard/PaymentCard"

interface PaymentProgressProps {
  icon: ReactNode
  title: string
  loadingText?: string
  description: string
  fallbackText?: string
  action?: ReactNode
}

export function PaymentProgress({
  icon,
  title,
  loadingText,
  description,
  fallbackText,
  action
}: PaymentProgressProps) {
  return (
    <div className="page-container py-8 max-w-2xl">
      <PaymentCard className="text-center animate-in fade-in-0 duration-300 motion-reduce:animate-none">
        <div className="mx-auto mb-4">
          {icon}
        </div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        {loadingText && (
          <div className="flex justify-center my-6">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <p>{loadingText}</p>
          </div>
        )}
        <p className="text-muted-foreground mb-4">
          {description}
        </p>
        {fallbackText && (
          <p className="text-xs text-muted-foreground mt-2">
            {fallbackText}
          </p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </PaymentCard>
    </div>
  )
}