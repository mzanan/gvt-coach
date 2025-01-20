'use client'

import { useState, useEffect } from 'react'
import { Calendar } from './Calendar'
import { UserProfileForm } from './UserProfileForm'
import { TimeSlot, Booking } from '../types/booking'
import { bookingService } from '../services/bookingService'
import { UserProfile } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Check, Edit2, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'

interface Section {
  id: 'date' | 'time' | 'summary'
  title: string
  completed: boolean
}

export function BookingCalendar() {
  const [showInitialForm, setShowInitialForm] = useState(true)
  const [sections, setSections] = useState<Section[]>([
    { id: 'date', title: 'Select Date', completed: false },
    { id: 'time', title: 'Select Time', completed: false },
    { id: 'summary', title: 'Booking Summary', completed: false }
  ])
  const [activeSection, setActiveSection] = useState<string>('date')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [bookedDates, setBookedDates] = useState<Array<{ date: Date, fullyBooked: boolean }>>([])
  const [isBookingLoading, setIsBookingLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const profile = bookingService.getUserProfile()
    if (profile) {
      setUserProfile(profile)
      setShowInitialForm(false)
    }
  }, [])

  useEffect(() => {
    const loadBookedDates = async () => {
      try {
        const dates = await bookingService.getFullyBookedDates(new Date())
        setBookedDates(dates)
      } catch (error) {
        console.error('Error loading booked dates:', error)
      }
    }
    loadBookedDates()
  }, [])

  const handleProfileComplete = () => {
    const profile = bookingService.getUserProfile()
    if (profile) {
      setUserProfile(profile)
      setShowInitialForm(false)
    }
  }

  const handleEditProfile = () => {
    setIsEditingProfile(true)
  }

  const handleDateSelect = async (date: Date) => {
    if (bookedDates.some(bookedDate => 
      bookedDate.date.getDate() === date.getDate() &&
      bookedDate.date.getMonth() === date.getMonth() &&
      bookedDate.date.getFullYear() === date.getFullYear()
    )) {
      return
    }

    setSelectedDate(date)
    setSelectedSlot(null)
    try {
      const slots = await bookingService.getAvailableSlots(date)
      setAvailableSlots(slots)
      setSections(prev => prev.map(s => 
        s.id === 'date' ? { ...s, completed: true } : s
      ))
      setActiveSection('time')
    } catch (error) {
      console.error('Error loading slots:', error)
    }
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return
    setSelectedSlot(slot)
    setSections(prev => prev.map(s => 
      s.id === 'time' ? { ...s, completed: true } : s
    ))
    setActiveSection('summary')
  }

  const handleSectionClick = (sectionId: string) => {
    const sectionIndex = sections.findIndex(s => s.id === sectionId)
    
    const previousSectionsCompleted = sections
      .slice(0, sectionIndex)
      .every(s => s.completed)
    
    if (previousSectionsCompleted) {
      setActiveSection(sectionId)
    }
  }

  const handleBookingSubmit = async () => {
    if (!selectedSlot || !userProfile) return
    
    setIsBookingLoading(true)
    try {
      const booking = await bookingService.createBooking(userProfile.email, selectedSlot.date)
      router.push(`/booking-confirmation/${booking.id}`)
    } catch (error) {
      console.error('Error creating booking:', error)
      toast({
        title: "Error",
        description: "Failed to create meeting. Please try again later.",
        variant: "destructive"
      })
    } finally {
      setIsBookingLoading(false)
    }
  }

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'date':
        return (
          <Calendar 
            onSelectDate={handleDateSelect}
            selectedDate={selectedDate}
            bookedDates={bookedDates}
          />
        )
      case 'time':
        return (
          <div className="grid gap-2">
            {availableSlots.map((slot) => (
              <button
                key={slot.id}
                className={`
                  w-full p-3 text-left rounded-md transition-colors duration-200
                  ${slot.available 
                    ? 'hover:bg-accent cursor-pointer'
                    : 'bg-muted text-gray-400 cursor-not-allowed'
                  }
                  ${selectedSlot?.id === slot.id ? 'ring-2 ring-blue-500' : ''}
                `}
                onClick={() => slot.available && handleSlotSelect(slot)}
                disabled={!slot.available}
              >
                {slot.date.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </button>
            ))}
          </div>
        )
      case 'summary':
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <h3 className="font-semibold">Selected Date & Time</h3>
              <p>{selectedDate?.toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</p>
              <p>{selectedSlot?.date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}</p>
            </div>
            <Button 
              className="w-full mt-4"
              onClick={handleBookingSubmit}
              disabled={isBookingLoading}
            >
              {isBookingLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating booking...
                </>
              ) : (
                "Confirm Booking"
              )}
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  if (showInitialForm) {
    return <UserProfileForm onComplete={handleProfileComplete} />
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* User Profile Section */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Personal Information</h2>
          {!isEditingProfile && (
            <Button variant="ghost" size="sm" onClick={handleEditProfile}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
        
        {isEditingProfile ? (
          <UserProfileForm 
            onComplete={() => {
              handleProfileComplete()
              setIsEditingProfile(false)
            }}
            initialData={userProfile}
            showCard={false} showTitle={false}
          />
        ) : (
          <div className="space-y-2">
            <p><span className="font-medium">Name:</span> {userProfile?.first_name} {userProfile?.last_name}</p>
            <p><span className="font-medium">Email:</span> {userProfile?.email}</p>
            <p><span className="font-medium">Phone:</span> {userProfile?.phone}</p>
          </div>
        )}
      </Card>

      {/* Collapsible Sections */}
      {sections.map((section) => {
        const sectionIndex = sections.findIndex(s => s.id === section.id)
        const previousSectionsCompleted = sections
          .slice(0, sectionIndex)
          .every(s => s.completed)
        const isAvailable = previousSectionsCompleted

        return (
          <Card
            key={section.id}
            className="overflow-hidden"
          >
            <button
              className={`
                w-full p-4 flex items-center justify-between text-left
                ${isAvailable ? 'hover:bg-accent/50' : 'opacity-50 cursor-not-allowed'}
              `}
              onClick={() => handleSectionClick(section.id)}
              disabled={!isAvailable}
            >
              <div className="flex items-center space-x-2">
                {section.completed && <Check className="w-4 h-4" />}
                <span className="font-medium">{section.title}</span>
              </div>
              {activeSection === section.id ? 
                <ChevronUp className="w-4 h-4" /> : 
                <ChevronDown className="w-4 h-4" />
              }
            </button>
            
            {activeSection === section.id && isAvailable && (
              <div className="p-4 border-t">
                {renderSectionContent(section.id)}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}