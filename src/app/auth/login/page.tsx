'use client'

import { UserProfileForm } from "@/app/components/UserProfileForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const handleLoginComplete = () => {
    window.location.href = '/'
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            Sign in to book your trading consultation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserProfileForm 
            onComplete={handleLoginComplete}
            showCard={false}
            showTitle={false}
          />
        </CardContent>
      </Card>
    </div>
  )
}