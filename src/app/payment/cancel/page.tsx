'use client'

import { useEffect } from 'react'
import { Card } from "@/app/components/ui-kit/card"
import { Button } from "@/app/components/ui-kit/button"
import Link from 'next/link'
import { XCircle } from "lucide-react"
import { deleteClientCookie } from '@/lib/utils/cookies'

export default function PaymentCancelPage() {
  useEffect(() => {
    deleteClientCookie('pending_booking')
  }, [])

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card className="p-8 text-center">
        <div className="mb-6">
          <XCircle className="h-12 w-12 text-red-500 mx-auto" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Payment Cancelled</h1>
        <p className="text-muted-foreground mb-6">
          Your payment was cancelled and no charges were made.
        </p>
        <Button asChild>
          <Link href="/">
            Return to Booking
          </Link>
        </Button>
      </Card>
    </div>
  )
} 