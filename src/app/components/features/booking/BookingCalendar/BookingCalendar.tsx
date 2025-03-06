'use client'

import { useBookingCalendar } from './useBookingCalendar'
import { Calendar } from '../Calendar/Calendar'
import { UserProfileForm } from '../../user/UserProfileForm/UserProfileForm'
import { Button } from '@/app/components/ui-kit/button'
import { ChevronDown, ChevronUp, Check, Edit2, Loader2 } from 'lucide-react'
import { Card } from '@/app/components/ui-kit/card'
import { DateTime } from 'luxon'
import { FrequencySelector } from '../FrequencySelector/FrequencySelector'
import { getBookingSummary } from '@/lib/utils'
import { TwiceWeeklySelector } from '../TwiceWeeklySelector/TwiceWeeklySelector'
import { cn } from '@/lib/utils'

export function BookingCalendar() {
  const {
    sections,
    activeSection,
    selectedDate,
    suggestedDate,
    selectedSlot,
    availableSlots,
    bookingPlan,
    userProfile,
    isEditingProfile,
    bookedDates,
    isBookingLoading,
    selectedTimezone,
    handleProfileComplete,
    handleEditProfile,
    handleDateSelect,
    handleSlotSelect,
    handleSectionClick,
    handleTimezoneChange,
    handleFrequencySelect,
    formatSlotTime,
    handleBookingConfirm
  } = useBookingCalendar()

  const renderSummary = () => {
    if (bookingPlan?.frequency === 'twice-weekly') {
      const firstSlotDate = bookingPlan?.firstSlot?.date
      const secondSlotDate = bookingPlan?.secondSlot?.date
  
      if (!firstSlotDate || !secondSlotDate) return null
  
      return (
        <div className="flex justify-center">
          <div className="space-y-4 text-left">
            <div className="space-y-2">
              <p>{getBookingSummary(
                firstSlotDate,
                'twice-weekly',
                bookingPlan.duration,
                true,
                selectedTimezone,
                secondSlotDate
              )}</p>
              <p>Duration: {bookingPlan.duration} {bookingPlan.duration === 1 ? 'month' : 'months'}</p>
              <p className="mt-4">Starting from {DateTime.fromJSDate(firstSlotDate).toFormat('MMMM d, yyyy')}</p>
              <p>Ending on {DateTime.fromJSDate(secondSlotDate)
                .plus({ months: bookingPlan.duration })
                .toFormat('MMMM d, yyyy')}</p>
            </div>
            <div className="flex justify-center mt-6">
              <Button 
                onClick={handleBookingConfirm} 
                disabled={isBookingLoading}
                className="w-full max-w-sm"
              >
                {isBookingLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Proceed to Payment
              </Button>
            </div>
          </div>
        </div>
      )
    }
  
    return (
      <div className="space-y-4 text-center">
        <p className="text-xl">
          {getBookingSummary(selectedSlot!.date, bookingPlan?.frequency || 'once', bookingPlan?.duration, true, selectedTimezone)}
        </p>
        <div className="flex justify-center">
          <Button 
            onClick={handleBookingConfirm} 
            disabled={isBookingLoading}
            className="w-full max-w-sm"
          >
            {isBookingLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Proceed to Payment
          </Button>
        </div>
      </div>
    )
  }

  const renderSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'frequency':
        return (
          <FrequencySelector 
            onFrequencySelect={handleFrequencySelect} 
            selectedFrequency={bookingPlan?.frequency}
            disableWeekly={true}
            disableTwiceWeekly={true}
          />
        )
      case 'date':
        return (
          <Calendar 
            onSelectDate={handleDateSelect}
            onConfirmDates={(firstDate) => {
              handleDateSelect(firstDate)
            }}
            selectedDate={selectedDate}
            bookedDates={bookedDates}
            frequency={bookingPlan?.frequency}
            suggestedDate={suggestedDate}
            selectedTimezone={selectedTimezone}
          />
        )
      case 'time':
        if (bookingPlan?.frequency === 'twice-weekly') {
          return (
            <TwiceWeeklySelector
              firstDate={selectedDate!}
              duration={bookingPlan.duration}
              timezone={selectedTimezone}
              onComplete={(firstSlot) => {
                handleSlotSelect(firstSlot)
              }}
            />
          );
        }
        
        return (
          <>
            {availableSlots.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-gray-500 dark:text-gray-400">No hay horarios disponibles para la fecha seleccionada.</p>
              </div>
            ) : (
              availableSlots.map((dayGroup) => {
                return (
                  <div key={dayGroup.date.toString()} className="mb-6">
                    <h3 className="text-sm font-medium mb-2">
                      {DateTime.fromJSDate(dayGroup.date)
                        .setZone(selectedTimezone)
                        .toFormat('cccc, MMMM d')}
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {dayGroup.slots.map((slot, index) => {
                        return (
                          <Button
                            key={`${slot.date.toString()}-${index}`}
                            variant={selectedSlot?.date.toString() === slot.date.toString() ? 'default' : 'outline'}
                            disabled={!slot.available}
                            onClick={() => handleSlotSelect(slot.slot!)}
                            className={cn(
                              "whitespace-nowrap",
                              !slot.available && "opacity-60 cursor-not-allowed dark:bg-gray-800 bg-gray-100 dark:text-gray-400 text-gray-500"
                            )}
                          >
                            {formatSlotTime(slot.date)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )
      case 'summary':
        return (
        <div className="space-y-6">
          {renderSummary()}
        </div>
        )
      default:
        return null
    }
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