'use client'

import { useState } from 'react'
import { UserProfile } from '@/lib/supabase/types'
import { bookingService } from '../services/bookingService'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { TimezoneDropdown } from "@/app/components/TimezoneDropdown"

const formSchema = z.object({
  email: z.string().email('Invalid email'),
  first_name: z.string().min(2, 'First name must be at least 2 characters'),
  last_name: z.string().min(2, 'Last name must be at least 2 characters'),
  phone: z.string().min(8, 'Invalid phone number')
})

interface UserProfileFormProps {
  onComplete: () => void
  initialData?: UserProfile | null
  showCard?: boolean
  showTitle?: boolean
  selectedTimezone?: string
  onTimezoneChange?: (timezone: string) => void
}

export function UserProfileForm({ 
  onComplete, 
  initialData,
  showCard = true,
  showTitle = true,
  selectedTimezone,
  onTimezoneChange
}: UserProfileFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: initialData?.email || '',
      first_name: initialData?.first_name || '',
      last_name: initialData?.last_name || '',
      phone: initialData?.phone || ''
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (initialData && 
        values.email === initialData.email &&
        values.first_name === initialData.first_name &&
        values.last_name === initialData.last_name &&
        values.phone === initialData.phone) {
      onComplete()
      return
    }

    try {
      await bookingService.saveUserProfile(values)
      onComplete()
    } catch (error) {
      form.setError("root", { 
        message: "Error saving data. Please try again." 
      })
    }
  }

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="your@email.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="first_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl>
                <Input placeholder="John" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="last_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl>
                <Input placeholder="Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input placeholder="Phone number" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <TimezoneDropdown
          selectedTimezone={selectedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
          onTimezoneChange={onTimezoneChange || (() => {})}
        />

        {form.formState.errors.root && (
          <div className="text-sm font-medium text-destructive">
            {form.formState.errors.root.message}
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full" 
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </form>
    </Form>
  )

  if (!showCard) {
    return formContent
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      {showTitle && (
        <CardHeader>
          <CardTitle>Enter your data</CardTitle>
          <CardDescription>
            Complete the form to reserve your class
          </CardDescription>
        </CardHeader>
      )}
      <CardContent>
        {formContent}
      </CardContent>
    </Card>
  )
} 