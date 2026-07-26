'use client'

import { Button } from '@/app/components/ui-kit/button'
import { Card } from '@/app/components/ui-kit/card'
import { Input } from '@/app/components/ui-kit/input'
import { Label } from '@/app/components/ui-kit/label'
import { SiteConfig } from '@/config/appConfig'

interface SiteSettingsFormProps {
  site: SiteConfig;
  isSaving: boolean;
  onChange: (field: keyof SiteConfig, value: string) => void;
  onSave: () => void;
}

export function SiteSettingsForm({ site, isSaving, onChange, onSave }: SiteSettingsFormProps) {
  return (
    <Card className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-medium">Site</h2>
        <p className="text-sm text-muted-foreground">Public identity of the booking site.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="siteName">Site name</Label>
          <Input
            id="siteName"
            value={site.siteName}
            onChange={e => onChange('siteName', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteDescription">Description</Label>
          <Input
            id="siteDescription"
            value={site.siteDescription}
            onChange={e => onChange('siteDescription', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName">Company name</Label>
          <Input
            id="companyName"
            value={site.companyName}
            onChange={e => onChange('companyName', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Shown in the footer.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input
            id="contactEmail"
            type="email"
            value={site.contactEmail}
            onChange={e => onChange('contactEmail', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Sender of booking confirmation emails when no dedicated sender is configured.
          </p>
        </div>
      </div>

      <div className="flex justify-end border-t pt-4">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save site settings'}
        </Button>
      </div>
    </Card>
  )
}
