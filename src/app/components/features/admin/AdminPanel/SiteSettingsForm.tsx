'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/app/components/ui-kit/button'
import { Card } from '@/app/components/ui-kit/card'
import { Input } from '@/app/components/ui-kit/input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/app/components/ui-kit/form'
import { SiteConfig } from '@/config/appConfig'

interface SiteSettingsFormProps {
  site: SiteConfig;
  isSaving: boolean;
  onSave: (site: SiteConfig) => void;
}

export function SiteSettingsForm({ site, isSaving, onSave }: SiteSettingsFormProps) {
  const form = useForm<SiteConfig>({ defaultValues: site });

  useEffect(() => {
    form.reset(site);
  }, [site, form]);

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSave)}>
        <Card className="p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium">Site</h2>
            <p className="text-sm text-muted-foreground">Public identity of the booking site.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="siteName"
              rules={{ required: 'Site name is required.' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="siteDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>Shown in the footer.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactEmail"
              rules={{
                required: 'Contact email is required.',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' }
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormDescription>
                    Sender of booking confirmation emails when no dedicated sender is configured.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-end">
            <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? 'Saving...' : 'Save site settings'}
            </Button>
          </div>
        </Card>
      </form>
    </Form>
  )
}
