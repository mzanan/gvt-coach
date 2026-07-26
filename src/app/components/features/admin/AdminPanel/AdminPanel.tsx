'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/app/components/ui-kit/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui-kit/tabs'
import { AppConfig } from '@/config/appConfig'
import { useAdminPanel } from './useAdminPanel'
import { CoachForm } from './CoachForm'
import { NewCoachDialog } from './NewCoachDialog'
import { SiteSettingsForm } from './SiteSettingsForm'

interface AdminPanelProps {
  initialConfig: AppConfig;
}

export function AdminPanel({ initialConfig }: AdminPanelProps) {
  const {
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
  } = useAdminPanel(initialConfig)

  const coachList = Object.values(coaches)
  const activeCoach = coaches[activeCoachId] || coachList[0]

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage your site settings and coaches.
        </p>
      </header>

      <Tabs value={section} onValueChange={setSection} className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="general" className="flex-1 sm:flex-none">General</TabsTrigger>
          <TabsTrigger value="coaches" className="flex-1 sm:flex-none">Coaches</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <SiteSettingsForm
            site={site}
            isSaving={isSaving}
            onChange={updateSite}
            onSave={saveSite}
          />
        </TabsContent>

        <TabsContent value="coaches" className="mt-0 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={activeCoach?.id} onValueChange={setActiveCoachId}>
              <TabsList className="flex-wrap h-auto">
                {coachList.map(coach => (
                  <TabsTrigger key={coach.id} value={coach.id}>
                    {coach.displayName}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <NewCoachDialog onCreate={createCoach} isSaving={isSaving}>
              <Button variant="outline" size="sm" className="gap-1 self-start sm:self-auto">
                <Plus className="h-4 w-4" />
                New coach
              </Button>
            </NewCoachDialog>
          </div>

          {activeCoach && (
            <CoachForm
              key={activeCoach.id}
              coach={activeCoach}
              canDelete={coachList.length > 1}
              isSaving={isSaving}
              onChange={updateCoach}
              onSave={saveCoach}
              onDelete={removeCoach}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
