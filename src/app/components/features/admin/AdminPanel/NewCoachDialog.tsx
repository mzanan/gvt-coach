'use client'

import { useState, ReactNode } from 'react'
import { Button } from '@/app/components/ui-kit/button'
import { Input } from '@/app/components/ui-kit/input'
import { Label } from '@/app/components/ui-kit/label'
import {
  Dialog,
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

export function NewCoachDialog({ children, isSaving, onCreate }: NewCoachDialogProps) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')

  const suggestedId = displayName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')

  const handleCreate = async () => {
    if (!displayName.trim() || !suggestedId) return
    const created = await onCreate(suggestedId, displayName.trim())
    if (created) {
      setOpen(false)
      setDisplayName('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New coach</DialogTitle>
          <DialogDescription>
            The coach starts with default settings you can edit right after.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-coach-name">Name</Label>
          <Input
            id="new-coach-name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="e.g. Ana"
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
            }}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isSaving || !displayName.trim()}>
            {isSaving ? 'Creating...' : 'Create coach'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
