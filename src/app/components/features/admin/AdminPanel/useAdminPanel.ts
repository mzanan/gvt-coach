'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AppConfig, SiteConfig } from '@/config/appConfig'
import { CoachRecord } from '@/types/coach'
import { useToast } from '@/app/components/ui-kit/use-toast'

export function useAdminPanel(initialConfig: AppConfig) {
  const router = useRouter()
  const { toast } = useToast()
  const [site, setSite] = useState<SiteConfig>(initialConfig.site)
  const [coaches, setCoaches] = useState<Record<string, CoachRecord>>(initialConfig.coaches)
  const [section, setSection] = useState('general')
  const [activeCoachId, setActiveCoachId] = useState(Object.keys(initialConfig.coaches)[0] || '')
  const [isSaving, setIsSaving] = useState(false)

  const updateSite = useCallback((field: keyof SiteConfig, value: string) => {
    setSite(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateCoach = useCallback((coach: CoachRecord) => {
    setCoaches(prev => ({ ...prev, [coach.id]: coach }))
  }, [])

  const notifyError = useCallback((error: unknown, fallback: string, title: string) => {
    toast({
      title,
      description: error instanceof Error ? error.message : fallback,
      variant: 'destructive'
    })
  }, [toast])

  const saveSite = useCallback(async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Could not save site settings')
      }

      toast({ title: 'Saved', description: 'Site settings updated.' })
      router.refresh()
    } catch (error) {
      notifyError(error, 'Could not save site settings.', 'Save Failed')
    } finally {
      setIsSaving(false)
    }
  }, [site, toast, router, notifyError])

  const saveCoach = useCallback(async (coach: CoachRecord) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/coaches/${encodeURIComponent(coach.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coach)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Could not save coach')
      }

      const saved = await response.json()
      setCoaches(prev => ({ ...prev, [saved.id]: saved }))
      toast({ title: 'Saved', description: `${saved.displayName} updated.` })
      router.refresh()
    } catch (error) {
      notifyError(error, 'Could not save coach.', 'Save Failed')
    } finally {
      setIsSaving(false)
    }
  }, [toast, router, notifyError])

  const createCoach = useCallback(async (id: string, displayName: string) => {
    setIsSaving(true)
    try {
      const template = Object.values(coaches)[0]
      const response = await fetch('/api/admin/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          displayName,
          name: displayName,
          description: '',
          photoUrl: '',
          email: site.contactEmail,
          timezone: template?.timezone || 'UTC',
          workingHours: template?.workingHours || { morning: { start: 1, end: 4 }, afternoon: { start: 12, end: 16 } },
          prices: { singleSession: 50, weekly: 200, twiceWeekly: 350 },
          paymentProvider: template?.paymentProvider || 'stripe',
          meetingProvider: template?.meetingProvider || 'zoom',
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Could not create coach')
      }

      const created = await response.json()
      setCoaches(prev => ({ ...prev, [created.id]: created }))
      setActiveCoachId(created.id)
      toast({ title: 'Created', description: `${created.displayName} added.` })
      router.refresh()
      return true
    } catch (error) {
      notifyError(error, 'Could not create coach.', 'Create Failed')
      return false
    } finally {
      setIsSaving(false)
    }
  }, [coaches, site.contactEmail, toast, router, notifyError])

  const removeCoach = useCallback(async (id: string) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/coaches/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Could not delete coach')
      }

      setCoaches(prev => {
        const next = { ...prev }
        delete next[id]
        setActiveCoachId(Object.keys(next)[0] || '')
        return next
      })
      toast({ title: 'Deleted', description: `Coach ${id} removed.` })
      router.refresh()
    } catch (error) {
      notifyError(error, 'Could not delete coach.', 'Delete Failed')
    } finally {
      setIsSaving(false)
    }
  }, [toast, router, notifyError])

  return {
    site,
    coaches,
    section,
    setSection,
    activeCoachId,
    setActiveCoachId,
    isSaving,
    updateSite,
    updateCoach,
    saveSite,
    saveCoach,
    createCoach,
    removeCoach,
  }
}
