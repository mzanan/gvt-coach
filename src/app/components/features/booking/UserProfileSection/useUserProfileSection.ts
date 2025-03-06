interface UseUserProfileSectionProps {
  onProfileComplete: () => void
  onEditProfile: () => void
}

export function useUserProfileSection({
  onProfileComplete,
  onEditProfile
}: UseUserProfileSectionProps) {
  
  const handleProfileSave = () => {
    onProfileComplete()
    onEditProfile()
  }

  return {
    handleProfileSave
  }
} 