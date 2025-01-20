export interface UserProfile {
  email: string
  first_name: string
  last_name: string
  phone: string
}

export interface BookingDB {
  id: string
  user_email: string
  booking_date: string
  status: 'confirmed' | 'pending' | 'cancelled'
  meet_link: string
} 