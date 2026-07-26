'use client'

import { Button } from '@/app/components/ui-kit/button'
import { Card } from '@/app/components/ui-kit/card'
import { Input } from '@/app/components/ui-kit/input'
import { Label } from '@/app/components/ui-kit/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui-kit/select'
import { AppConfig } from '@/config/appConfig'
import { CoachId } from '@/config/coaches'
import { useAdminPanel } from './useAdminPanel'
import { CoachSettingsCard } from './CoachSettingsCard'

interface AdminPanelProps {
  initialConfig: AppConfig;
}

export function AdminPanel({ initialConfig }: AdminPanelProps) {
  const {
    config,
    isSaving,
    updateSite,
    updateCoach,
    updateProvider,
    handleSave,
  } = useAdminPanel(initialConfig)

  return (
    <div className="space-y-8">
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium">Site</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siteName">Site name</Label>
            <Input
              id="siteName"
              value={config.site.siteName}
              onChange={e => updateSite('siteName', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siteDescription">Description</Label>
            <Input
              id="siteDescription"
              value={config.site.siteDescription}
              onChange={e => updateSite('siteDescription', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="companyName">Company name</Label>
            <Input
              id="companyName"
              value={config.site.companyName}
              onChange={e => updateSite('companyName', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={config.site.contactEmail}
              onChange={e => updateSite('contactEmail', e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium">Providers</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Payment provider</Label>
            <Select
              value={config.paymentProvider}
              onValueChange={value => updateProvider('paymentProvider', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="polar">Polar</SelectItem>
                <SelectItem value="lemonsqueezy">Lemon Squeezy</SelectItem>
                <SelectItem value="disabled">Disabled (testing)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Meeting provider</Label>
            <Select
              value={config.meetingProvider}
              onValueChange={value => updateProvider('meetingProvider', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zoom">Zoom</SelectItem>
                <SelectItem value="google-meet">Google Meet (coming soon)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {(Object.keys(config.coaches) as CoachId[]).map(coachId => (
        <CoachSettingsCard
          key={coachId}
          coachId={coachId}
          coach={config.coaches[coachId]}
          onChange={updateCoach}
        />
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
