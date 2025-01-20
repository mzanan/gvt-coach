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
} 