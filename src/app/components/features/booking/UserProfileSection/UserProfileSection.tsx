'use client'

import { Card } from '@/app/components/ui-kit/card'
import { Button } from '@/app/components/ui-kit/button'
import { UserProfile } from '@/app/types/user'
import { useToast } from '@/app/components/ui-kit/use-toast'

interface UserProfileSectionProps {
  userProfile: UserProfile | null
  isEditingProfile: boolean
  selectedTimezone: string
  onProfileComplete: () => void
  onEditProfile: () => void
}

export function UserProfileSection({
  userProfile,
  isEditingProfile,
  selectedTimezone,
  onProfileComplete,
  onEditProfile
}: UserProfileSectionProps) {
  const { toast } = useToast()

  const handleClick = () => {
    toast({
      title: "Información",
      description: "La edición de perfil no está disponible. Los datos se obtienen automáticamente.",
    })
  }

  return (
    <div className="mb-8">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
        <div className="space-y-4">
          {userProfile ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Name</div>
                  <div>{userProfile.first_name} {userProfile.last_name}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div>{userProfile.email}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div>{userProfile.phone || 'Not provided'}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Timezone</div>
                  <div>{selectedTimezone}</div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleClick}
              >
                Information
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="mb-4">No user information available. User data is loaded automatically.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
} 