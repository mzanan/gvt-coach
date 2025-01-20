'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { bookingService } from '@/app/services/bookingService'
import { Booking } from '@/app/types/booking'
import { ArrowLeft } from 'lucide-react'

export default function BookingConfirmation() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState<Booking | null>(null)

  useEffect(() => {
    const loadBooking = async () => {
      const bookingData = await bookingService.getBooking(id as string)
      setBooking(bookingData)
    }
    loadBooking()
  }, [id])

  if (!booking) return <div>Loading...</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button
        onClick={() => router.push('/')}
        className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Calendar
      </button>

      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold text-black">Booking Confirmed!</h1>
        <p className="text-blue-600 mb-6 text-sm">
          You will receive this information in your email
        </p>
        
        <div className="space-y-4 text-black">
          <div>
            <h2 className="font-semibold">Date and Time</h2>
            <p>{booking.date.toLocaleString([], { 
                weekday: 'long',
                hour: '2-digit', 
                minute: '2-digit',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
                })}</p>
          </div>

          <div>
            <h2 className="font-semibold">Zoom Link</h2>
            <a 
              href={booking.meetLink} 
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Join Meeting
            </a>
          </div>

          <div>
            <h2 className="font-semibold">Booking ID</h2>
            <p>{booking.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
} 