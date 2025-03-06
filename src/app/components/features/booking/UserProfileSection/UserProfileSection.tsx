'use client'

import { Card } from '@/app/components/ui-kit/card'
import { Button } from '@/app/components/ui-kit/button'
import { UserProfileForm } from '../../../features/user/UserProfileForm/UserProfileForm'
import { UserProfile } from '@/app/types/user'
import { useUserProfileSection } from './useUserProfileSection'

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
  const {
    handleProfileSave
  } = useUserProfileSection({ 
    onProfileComplete, 
    onEditProfile
  })

  return (
    <div className="mb-8">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
        {isEditingProfile ? (
          <UserProfileForm 
            onComplete={handleProfileSave}
            showCard={false}
            showTitle={false}
          />
        ) : (
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
                  onClick={onEditProfile}
                >
                  Edit Information
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="mb-4">Please provide your information to continue</p>
                <Button
                  type="button"
                  onClick={onEditProfile}
                >
                  Enter Your Information
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
} 