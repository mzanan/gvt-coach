import React from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardFooter, CardDescription, CardHeader, CardTitle } from '@/app/components/ui-kit/card'
import { Button } from '@/app/components/ui-kit/button'

export interface PaymentProgressProps {
  title?: string
  description?: string
  loading?: boolean
  onRetry?: () => void
  onCancel?: () => void
  needsHelp?: boolean
  retryDisabled?: boolean
  extraButtons?: React.ReactNode
}

export function PaymentProgress({
  title = 'Processing Payment',
  description = 'Please wait while we confirm your payment. This may take a few moments.',
  loading = true,
  onRetry,
  onCancel,
  needsHelp = false,
  retryDisabled = false,
  extraButtons
}: PaymentProgressProps) {
  return (
    <div className="w-full flex justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">{title}</CardTitle>
          <CardDescription className="text-center">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4 pb-2">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          {onRetry && (
            <Button 
              variant="outline" 
              onClick={onRetry} 
              className="w-full"
              disabled={retryDisabled}
            >
              {retryDisabled ? 'Checking...' : 'Check Payment Status'}
            </Button>
          )}
          
          {onCancel && (
            <Button 
              variant="ghost" 
              onClick={onCancel} 
              className="w-full text-destructive hover:text-destructive"
            >
              Cancel Booking
            </Button>
          )}
          
          {needsHelp && (
            <div className="text-center text-sm text-muted-foreground mt-4">
              Having trouble? Contact our support team for help.
            </div>
          )}
          
          {extraButtons && (
            <div className="w-full mt-2">
              {extraButtons}
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  )
} 