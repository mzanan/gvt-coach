'use client'

import React, { useMemo } from 'react'
import { useBookingCalendar } from './useBookingCalendar'
import { Calendar } from '../Calendar'
import { Button } from '@/app/components/ui-kit/button'
import { Input } from '@/app/components/ui-kit/input'
import { Label } from '@/app/components/ui-kit/label'
import { ChevronDown, ChevronUp, Check, Loader2, Globe, User, DollarSign, Clock, CreditCard, CalendarIcon } from 'lucide-react'
import { Card } from '@/app/components/ui-kit/card'
import { DateTime } from 'luxon'
import { CoachSelector } from '../CoachSelector'
import { TimeZoneSelector } from '../TimeZoneSelector'
import { getBookingSummary, cn } from '@/lib/utils'
import { useAppConfig } from '@/app/components/core/AppConfigProvider'


// Memoized payment button component to reduce renders
const PaymentButton = React.memo(({ onClick, isLoading }: { onClick: () => void, isLoading: boolean }) => (
  <Button 
    onClick={onClick} 
    disabled={isLoading}
    className="w-full max-w-sm"
  >
    {isLoading ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : null}
    Proceed to Payment
  </Button>
));
PaymentButton.displayName = 'PaymentButton';

// Memoized component to render a section to avoid unnecessary renders
const MemoizedBookingSection = React.memo(({ 
  section, 
  activeSection, 
  isAvailable, 
  onSectionClick,
  renderContent
}: { 
  section: { id: string, title: string, completed: boolean }, 
  activeSection: string,
  isAvailable: boolean,
  onSectionClick: (id: string) => void,
  renderContent: () => React.ReactNode
}) => (
  <Card className="overflow-hidden">
    <button
      className={`
        w-full p-4 flex items-center justify-between text-left
        ${isAvailable ? 'hover:bg-accent/50' : 'opacity-50 cursor-not-allowed'}
      `}
      onClick={() => onSectionClick(section.id)}
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
        {renderContent()}
      </div>
    )}
  </Card>
));
MemoizedBookingSection.displayName = 'MemoizedBookingSection';

export function BookingCalendar() {
  const { coaches } = useAppConfig()
  const {
    sections,
    activeSection,
    selectedDate,
    selectedSlot,
    availableSlots,
    bookingPlan,
    bookedDates,
    isBookingLoading,
    isLoadingSlots,
    selectedTimezone,
    userEmail,
    setUserEmail,
    handleDateSelect,
    handleSlotSelect,
    handleSectionClick,
    handleCoachSelect,
    handleTimezoneChange,
    handleBookingConfirm,
  } = useBookingCalendar()

  // Memoize summary rendering to avoid repeated calculations
  const summaryContent = useMemo(() => {
    if (!bookingPlan || !selectedSlot || !bookingPlan.coach) return null;
   
    const coach = bookingPlan.coach;
    const price = coaches[coach].prices.singleSession;
  
    return (
      <div className="space-y-6">
        <div className="p-6 border rounded-lg bg-card shadow-sm">
          <div className="flex flex-col space-y-4">
            {/* Session details */}
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="mt-1 p-2 bg-primary/10 rounded-full">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">Session Details</h3>
                  <p className="text-muted-foreground">
                    {getBookingSummary(selectedSlot.date, true, selectedTimezone)}
                  </p>
                </div>
              </div>
              
              {/* Coach info */}
              {coach && (
                <div className="flex items-start space-x-3">
                  <div className="mt-1 p-2 bg-blue-50 rounded-full dark:bg-blue-900/20">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">Coach</h3>
                    <p className="text-muted-foreground">{coaches[coach].displayName}</p>
                  </div>
                </div>
              )}
              
              {/* Price */}
              <div className="flex items-start space-x-3">
                <div className="mt-1 p-2 bg-green-50 rounded-full dark:bg-green-900/20">
                  <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-medium">Price</h3>
                  <p className="text-xl font-semibold">${price}</p>
                </div>
              </div>
            </div>
            
            {/* Time and timezone */}
            <div className="pt-4 border-t border-muted">
              <div className="flex items-center text-sm text-muted-foreground">
                <Clock className="h-4 w-4 mr-1" />
                <span>Session time shown in timezone: {selectedTimezone}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="booking-email">Your email</Label>
          <Input
            id="booking-email"
            type="email"
            value={userEmail}
            onChange={e => setUserEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground">
            The booking confirmation and meeting link are sent to this address.
          </p>
        </div>

        {/* Payment button */}
        <Button
          onClick={handleBookingConfirm}
          disabled={isBookingLoading || !userEmail.trim()}
          className="w-full h-12 text-lg font-medium"
        >
          {isBookingLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-5 w-5" />
              Proceed to Payment
            </>
          )}
        </Button>
      </div>
    )
  }, [bookingPlan, selectedSlot, selectedTimezone, handleBookingConfirm, isBookingLoading, coaches, userEmail, setUserEmail]);

  // Function to render specific content for each section
  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'coach':
        return (
          <CoachSelector 
            onCoachSelect={handleCoachSelect}
            selectedCoach={bookingPlan.coach}
          />
        )
      case 'date':
        return (
          <Calendar 
            onSelectDate={handleDateSelect}
            selectedDate={selectedDate}
            bookedDates={bookedDates}
            selectedTimezone={selectedTimezone}
            selectedCoach={bookingPlan.coach || 'MATIAS'}
          />
        )
      case 'time':
        // Show loading indicator while slots are loading
        if (isLoadingSlots) {
          return (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }
        
        // Display time slots with coach info
        return (
          <>
            {/* Available time slots */}
            {availableSlots.map((dayGroup) => {
              return (
                <div key={dayGroup.date.toString()} className="mb-4">
                  <h3 className="font-medium mb-2">
                    {DateTime.fromJSDate(dayGroup.date).setZone(selectedTimezone).toFormat('EEEE, MMMM d')}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {dayGroup.slots.map((slot, index) => {
                      return (
                        <Button
                          key={`${slot.date.toString()}-${index}`}
                          variant={selectedSlot?.date.toString() === slot.date.toString() ? 'default' : 'outline'}
                          disabled={!slot.available}
                          onClick={() => {
                            handleSlotSelect(slot);
                          }}
                          className={cn(
                            "whitespace-nowrap",
                            !slot.available && "opacity-60 cursor-not-allowed dark:bg-gray-800 bg-gray-100 dark:text-gray-400 text-gray-500"
                          )}
                        >
                          {DateTime.fromJSDate(slot.date).setZone(selectedTimezone).toFormat('h:mm a')}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {/* Coach working hours explanation */}
            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              {(() => {
                const coach = bookingPlan.coach || 'MATIAS';
                return (
                  <p className="text-sm text-muted-foreground">
                    These time slots are available based on {coaches[coach].displayName}&apos;s working hours in their timezone ({coaches[coach].timezone}, UTC{DateTime.now().setZone(coaches[coach].timezone).toFormat('ZZ')}).
                  </p>
                );
              })()}
            </div>
          </>
        )
      case 'summary':
        return (
          <div className="space-y-6">
            {summaryContent}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center gap-4">
        <h2 className="text-2xl font-semibold shrink">Book a Consultation</h2>
          <div className="flex items-center space-x-2 shrink-0">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <TimeZoneSelector 
              currentTimezone={selectedTimezone}
              onTimezoneChange={handleTimezoneChange}
            />
          </div>
      </div>
      
      {sections
        .map((section) => {
          const sectionIndex = sections.findIndex(s => s.id === section.id)
          const previousSectionsCompleted = sections
            .slice(0, sectionIndex)
            .every(s => s.completed)
          
          const isAvailable = 
            section.id === 'date' && bookingPlan?.coach 
              ? true 
              : previousSectionsCompleted

          return (
            <MemoizedBookingSection 
              key={section.id} 
              section={section}
              activeSection={activeSection}
              isAvailable={isAvailable}
              onSectionClick={handleSectionClick}
              renderContent={() => renderSectionContent(section.id)}
            />
          )
        })}
    </div>
  )
}