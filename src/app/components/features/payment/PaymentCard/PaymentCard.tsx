import { ReactNode } from 'react'
import { Card } from '@/app/components/ui-kit/card'
import { cn } from '@/lib/utils'

interface PaymentCardProps {
  children: ReactNode
  className?: string
}

export function PaymentCard({ children, className }: PaymentCardProps) {
  return (
    <Card className={cn("max-w-2xl mx-auto p-8", className)}>
      {children}
    </Card>
  )
}
