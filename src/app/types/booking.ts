export interface Booking {
  id: string
  userId: string
  date: Date
  status: 'pending' | 'confirmed' | 'cancelled'
  meetLink: string
}

export interface TimeSlot {
  id: string
  date: Date
  available: boolean
  utcDate: Date
}

export type BookingFrequency = 'once' | 'weekly' | 'twice-weekly'

export interface BookingPlan {
  frequency: BookingFrequency
  duration?: number // number of months for recurring bookings
  firstSlot?: TimeSlot
  secondSlot?: TimeSlot
}

export interface CreateBookingParams {
  email: string;
  startDate: Date;
  frequency: BookingFrequency;
  endDate?: Date | null;
}

export interface GroupedTimeSlots {
  date: Date;
  slots: TimeSlot[];
} 