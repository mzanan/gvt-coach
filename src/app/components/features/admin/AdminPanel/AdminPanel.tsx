'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/app/components/ui-kit/button'
import { Card } from '@/app/components/ui-kit/card'
import { Input } from '@/app/components/ui-kit/input'
import { Label } from '@/app/components/ui-kit/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui-kit/tabs'
import { AppConfig } from '@/config/appConfig'
import { useAdminPanel } from './useAdminPanel'
import { CoachForm } from './CoachForm'
import { NewCoachDialog } from './NewCoachDialog'

interface AdminPanelProps {
  initialConfig: AppConfig;
}

export function AdminPanel({ initialConfig }: AdminPanelProps) {
  const {
    site,
    coaches,
    activeTab,
    setActiveTab,
    isSaving,
    updateSite,
    updateCoach,
    saveSite,
    saveCoach,
    createCoach,
    removeCoach,
  } = useAdminPanel(initialConfig)

  const coachList = Object.values(coaches)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {coachList.map(coach => (
            <TabsTrigger key={coach.id} value={coach.id}>
              {coach.displayName}
            </TabsTrigger>
          ))}
        </TabsList>
        <NewCoachDialog onCreate={createCoach} isSaving={isSaving}>
          <Button variant="outline" size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            New coach
          </Button>
        </NewCoachDialog>
      </div>

      <TabsContent value="general">
        <Card className="p-6 space-y-4 max-w-2xl">
          <h2 className="text-lg font-medium">Site</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="siteName">Site name</Label>
              <Input
                id="siteName"
                value={site.siteName}
                onChange={e => updateSite('siteName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteDescription">Description</Label>
              <Input
                id="siteDescription"
                value={site.siteDescription}
                onChange={e => updateSite('siteDescription', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                value={site.companyName}
                onChange={e => updateSite('companyName', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={site.contactEmail}
                onChange={e => updateSite('contactEmail', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used as the sender of booking confirmation emails when no dedicated sender is configured.
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveSite} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save site settings'}
            </Button>
          </div>
        </Card>
      </TabsContent>

      {coachList.map(coach => (
        <TabsContent key={coach.id} value={coach.id}>
          <CoachForm
            coach={coach}
            canDelete={coachList.length > 1}
            isSaving={isSaving}
            onChange={updateCoach}
            onSave={saveCoach}
            onDelete={removeCoach}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
