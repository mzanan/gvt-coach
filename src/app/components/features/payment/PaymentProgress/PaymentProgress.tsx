import { ReactNode } from 'react'
import { Loader2, RefreshCw } from "lucide-react"
import { Card } from "@/app/components/ui-kit/card"
import { Button } from "@/app/components/ui-kit/button"

interface PaymentProgressProps {
  icon: ReactNode
  title: string
  loadingText: string
  description: string
  orderId?: string | null | undefined
  loadingRefresh: boolean
  onRefresh: () => void
  refreshButtonText: string
  loadingButtonText: string
  fallbackText: string
}

/**
 * Reusable component for payment progress states
 */
export function PaymentProgress({
  icon,
  title,
  loadingText,
  description,
  orderId,
  loadingRefresh,
  onRefresh,
  refreshButtonText,
  loadingButtonText,
  fallbackText
}: PaymentProgressProps) {
  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4">
          {icon}
        </div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <div className="flex justify-center my-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <p>{loadingText}</p>
        </div>
        <p className="text-muted-foreground mb-4">
          {description}
        </p>
        {orderId ? (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-4">
              Checkout ID: {orderId}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRefresh}
              disabled={loadingRefresh}
              className="mt-2"
            >
              {loadingRefresh ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {loadingButtonText}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {refreshButtonText}
                </>
              )}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">
            {fallbackText}
          </p>
        )}
      </Card>
    </div>
  )
} 