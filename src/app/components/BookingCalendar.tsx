'use client'

import { useState, useEffect } from 'react'
import { Calendar } from './Calendar'
import { UserProfileForm } from './UserProfileForm'
import { TimeSlot, BookingFrequency, BookingPlan } from '../types/booking'
import { bookingService } from '../services/bookingService'
import { UserProfile } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Check, Edit2, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { DateTime } from 'luxon'
import { FrequencySelector } from './FrequencySelector'
import { getBookingSummary } from '@/lib/utils'

interface Section {
  id: 'date' | 'time' | 'summary' | 'frequency'
  title: string
  completed: boolean
}

export function BookingCalendar() {
  const [showInitialForm, setShowInitialForm] = useState(true)
  const [sections, setSections] = useState<Section[]>([
    { id: 'frequency', title: 'Select Frequency', completed: false },
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
  const [selectedTimezone, setSelectedTimezone] = useState<string>('')
  const [bookingPlan, setBookingPlan] = useState<BookingPlan | null>(null)
  const [secondDateSelection, setSecondDateSelection] = useState<boolean>(false)
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
        const dates = await bookingService.getFullyBookedDates(new Date());
        setBookedDates(dates);
      } catch (error) {
        console.error('Error loading booked dates:', error);
        toast({
          title: "Error",
          description: "Failed to load calendar availability. Please try again later.",
          variant: "destructive"
        });
      }
    };
    loadBookedDates();
  }, []);

  useEffect(() => {
    setSelectedTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
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
    if (bookingPlan?.frequency === 'weekly') {
      const endDate = DateTime.fromJSDate(date)
        .plus({ months: bookingPlan.duration || 0 })
        .toJSDate();

      const dayOfWeek = date.getDay();
      const conflictingDates = bookedDates.filter(bookedDate => {
        const bookingDate = bookedDate.date;
        return bookingDate >= date && 
               bookingDate <= endDate && 
               bookingDate.getDay() === dayOfWeek;
      });

      if (conflictingDates.length > 0) {
        toast({
          title: "Date not available",
          description: "One or more dates in this recurring schedule are already booked.",
          variant: "destructive"
        });
        return;
      }
    }

    setSelectedDate(date);
    setSelectedSlot(null);
    try {
      const slots = await bookingService.getAvailableSlots(date);
      setAvailableSlots(slots);
      setSections(prev => prev.map(s => 
        s.id === 'date' ? { ...s, completed: true } : s
      ));
      setActiveSection('time');
    } catch (error) {
      console.error('Error loading slots:', error);
    }
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return
    
    if (bookingPlan?.frequency === 'twice-weekly' && !secondDateSelection) {
      setSelectedSlot(slot)
      setSecondDateSelection(true)
      // Clear date selection for second slot
      setSelectedDate(null)
    } else {
      setSelectedSlot(slot)
      if (bookingPlan?.frequency === 'twice-weekly') {
        setBookingPlan(prev => prev ? { ...prev, secondSlot: slot } : prev)
      }
      setSections(prev => prev.map(s => 
        s.id === 'time' ? { ...s, completed: true } : s
      ))
      setActiveSection('summary')
    }
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
    if (!selectedSlot || !userProfile || !bookingPlan) return;
    
    setIsBookingLoading(true);
    try {
      const startDate = selectedSlot.date;
      const endDate = bookingPlan.frequency !== 'once' 
        ? DateTime.fromJSDate(startDate)
            .plus({ months: bookingPlan.duration || 0 })
            .toJSDate()
        : null;

      const booking = await bookingService.createBooking(
        userProfile.email, 
        startDate,
        bookingPlan.frequency,
        endDate
      );
      
      router.push(`/booking-confirmation/${booking.id}`);
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Error",
        description: "Failed to create meeting. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsBookingLoading(false);
    }
  }

  const handleTimezoneChange = (timezone: string) => {
    setSelectedTimezone(timezone)
  }

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'frequency':
        return (
          <FrequencySelector 
            onFrequencySelect={(frequency, duration) => {
              setBookingPlan({ frequency, duration })
              setSections(prev => prev.map(s => 
                s.id === 'frequency' ? { ...s, completed: true } : s
              ))
              setActiveSection('date')
            }}
          />
        )
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
          <div className="grid grid-cols-3 gap-2">
            {availableSlots.map((slot) => (
              <button
                key={slot.id}
                className={`
                  p-3 text-left rounded-md transition-colors duration-200 text-center
                  ${slot.available 
                    ? 'hover:bg-accent cursor-pointer'
                    : 'bg-muted text-gray-400 cursor-not-allowed'
                  }
                  ${selectedSlot?.id === slot.id ? 'ring-2 ring-blue-500' : ''}
                `}
                onClick={() => slot.available && handleSlotSelect(slot)}
                disabled={!slot.available}
              >
                {DateTime.fromJSDate(slot.date).toLocaleString(DateTime.TIME_SIMPLE)}
              </button>
            ))}
          </div>
        )
      case 'summary':
        return (
          <div className="space-y-6">
            {selectedSlot?.date && (() => {
              const summary = getBookingSummary(
                selectedSlot.utcDate,
                bookingPlan?.frequency || 'once',
                bookingPlan?.duration,
                true,
                selectedTimezone
              );
              return (
                <div className="space-y-2 text-center">
                  <p className="text-xl">{summary}</p>
                </div>
              );
            })()}
            
            <Button 
              className="w-full" 
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
    <div className="max-w-[46rem] mx-auto space-y-6">
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
            showCard={false}
            showTitle={false}
            selectedTimezone={selectedTimezone}
            onTimezoneChange={handleTimezoneChange}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p><span className="font-medium">Name:</span> {userProfile?.first_name} {userProfile?.last_name}</p>
              <p><span className="font-medium">Email:</span> {userProfile?.email}</p>
              <p><span className="font-medium">Phone:</span> {userProfile?.phone}</p>
              <p><span className="font-medium">Timezone:</span> {selectedTimezone || 'Loading...'}</p>
            </div>
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