'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/app/components/ui-kit/button'
import { Card } from '@/app/components/ui-kit/card'
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
    saveSite,
    saveCoach,
    createCoach,
    removeCoach,
    coachDrafts,
    keepCoachDraft,
  } = useAdminPanel(initialConfig)

  const coachList = Object.values(coaches)
  const activeCoach = coaches[activeCoachId] || coachList[0]

  return (
    <Tabs value={section} onValueChange={setSection} className="space-y-6">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="general" className="flex-1 sm:flex-none">General</TabsTrigger>
        <TabsTrigger value="coaches" className="flex-1 sm:flex-none">Coaches</TabsTrigger>
      </TabsList>

        <TabsContent value="general" forceMount hidden={section !== 'general'}>
          <SiteSettingsForm
            site={site}
            isSaving={isSaving}
            onSave={saveSite}
          />
        </TabsContent>

        <TabsContent value="coaches" className="space-y-6" forceMount hidden={section !== 'coaches'}>
          {coachList.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Tabs value={activeCoach?.id} onValueChange={setActiveCoachId}>
                <TabsList className="w-full">
                  {coachList.map(coach => (
                    <TabsTrigger key={coach.id} value={coach.id} className="flex-1 min-w-28">
                      {coach.displayName}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <NewCoachDialog onCreate={createCoach} isSaving={isSaving}>
                <Button variant="outline" className="w-full sm:w-auto">
                  <Plus />
                  New coach
                </Button>
              </NewCoachDialog>
            </div>
          )}

          {activeCoach ? (
            <CoachForm
              key={activeCoach.id}
              coach={activeCoach}
              draft={coachDrafts[activeCoach.id]}
              canDelete={coachList.length > 1}
              isSaving={isSaving}
              onSave={saveCoach}
              onDelete={removeCoach}
              onKeepDraft={keepCoachDraft}
            />
          ) : (
            <Card className="p-6 text-center space-y-4">
              <p className="font-medium">No coaches yet</p>
              <p className="text-sm text-muted-foreground">Add the first coach to start taking bookings.</p>
              <NewCoachDialog onCreate={createCoach} isSaving={isSaving}>
                <Button className="w-full sm:w-auto">New coach</Button>
              </NewCoachDialog>
            </Card>
          )}
      </TabsContent>
    </Tabs>
  )
}
