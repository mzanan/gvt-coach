'use client'

import { useState, useCallback } from 'react'
import { AppConfig, SiteConfig } from '@/config/appConfig'
import { CoachId } from '@/config/coaches'
import { CoachConfig } from '@/types/coach'
import { useToast } from '@/app/components/ui-kit/use-toast'

export function useAdminPanel(initialConfig: AppConfig) {
  const { toast } = useToast()
  const [config, setConfig] = useState<AppConfig>(initialConfig)
  const [isSaving, setIsSaving] = useState(false)

  const updateSite = useCallback((field: keyof SiteConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      site: { ...prev.site, [field]: value }
    }))
  }, [])

  const updateCoach = useCallback((coachId: CoachId, coach: CoachConfig) => {
    setConfig(prev => ({
      ...prev,
      coaches: { ...prev.coaches, [coachId]: coach }
    }))
  }, [])

  const updateProvider = useCallback((field: 'paymentProvider' | 'meetingProvider', value: string) => {
    setConfig(prev => ({ ...prev, [field]: value } as AppConfig))
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Save failed with status ${response.status}`)
      }

      const saved = await response.json()
      setConfig(saved)

      toast({
        title: 'Saved',
        description: 'Configuration updated successfully.'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not save configuration.',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }, [config, toast])

  return {
    config,
    isSaving,
    updateSite,
    updateCoach,
    updateProvider,
    handleSave,
  }
}
