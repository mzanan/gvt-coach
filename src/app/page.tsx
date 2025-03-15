'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { bookingService } from "@/services/bookingService"
import { BookingCalendar } from "./components/features/booking/BookingCalendar"

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [key, setKey] = useState(0)

  useEffect(() => {
    const checkAuth = () => {
      const userProfile = bookingService.getUserProfile()
      if (!userProfile) {
        router.replace('/auth/login')
        return
      }
      setIsLoading(false)
    }
    
    checkAuth()
  }, [router])

  // Añadir listener para recargar el componente cuando la ventana recupera el foco
  useEffect(() => {
    const handleFocus = () => {
      // Limpiar la caché al volver a la página
      bookingService.clearTimeSlotsCache();
      console.log("Window focused, cache cleared");
      
      // Forzar actualización del componente para recargar los slots
      setKey(prev => prev + 1);
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  if (isLoading) {
    return null
  }

  return (
    <main className="container mx-auto py-8">
      <BookingCalendar key={key} />
    </main>
  )
}
