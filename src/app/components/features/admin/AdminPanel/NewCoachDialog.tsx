'use client'

import { useState, ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/app/components/ui-kit/button'
import { Input } from '@/app/components/ui-kit/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/app/components/ui-kit/form'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui-kit/dialog'

interface NewCoachDialogProps {
  children: ReactNode;
  isSaving: boolean;
  onCreate: (id: string, displayName: string) => Promise<boolean>;
}

interface NewCoachValues {
  displayName: string;
}

function toCoachId(displayName: string): string {
  return displayName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function NewCoachDialog({ children, isSaving, onCreate }: NewCoachDialogProps) {
  const [open, setOpen] = useState(false)
  const form = useForm<NewCoachValues>({ defaultValues: { displayName: '' } })

  const handleCreate = async ({ displayName }: NewCoachValues) => {
    const id = toCoachId(displayName)
    if (!id) {
      form.setError('displayName', { message: 'Use at least one letter or number.' })
      return
    }

    const created = await onCreate(id, displayName.trim())
    if (created) {
      setOpen(false)
      form.reset()
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleCreate)} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>New coach</DialogTitle>
              <DialogDescription>
                The coach starts with default settings you can edit right after.
              </DialogDescription>
            </DialogHeader>
            <FormField
              control={form.control}
              name="displayName"
              rules={{ required: 'Name is required.' }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Ana" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                {isSaving ? 'Creating...' : 'Create coach'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
