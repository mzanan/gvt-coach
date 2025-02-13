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

export type BookingFrequency = 'weekly' | 'twice-weekly' | 'once';

export interface BookingPlan {
  frequency: BookingFrequency;
  duration: number;
  firstSlot?: TimeSlot;
  secondSlot?: TimeSlot;
  variantId?: string;
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

export type PaymentStatus = 'pending' | 'completed' | 'failed'; 