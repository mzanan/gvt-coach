'use client'

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { bookingService } from "@/services/bookingService"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  
  useEffect(() => {
    const userProfile = bookingService.getUserProfile()
    if (userProfile && pathname.includes('/auth/login')) {
      router.replace('/')
    }
  }, [router, pathname])

  return children
}
