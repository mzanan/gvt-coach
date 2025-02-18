export interface UserProfile {
  id: string;
  email: string;
  first_name: string
  last_name: string
  phone: string
  timezone?: string;
  full_name?: string;
}

export interface BookingDB {
  id: string
  user_email: string
  booking_date: string
  end_date?: string // For recurring bookings
  frequency: 'once' | 'weekly' | 'twice-weekly'
  status: 'confirmed' | 'pending' | 'cancelled'
  meet_link: string
  recurring_day?: string // Day of the week for recurring bookings
  recurring_time?: string // Time for recurring bookings
  second_booking_date?: string | null;
  duration?: number
}