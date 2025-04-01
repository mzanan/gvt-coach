import { BookingFrequency } from "@/types/booking"

interface UseFrequencySectionProps {
  onFrequencySelect: (frequency: BookingFrequency, duration?: number) => void
}

export function useFrequencySection({
  onFrequencySelect
}: UseFrequencySectionProps) {
  
  const handleFrequencyCardClick = (frequency: BookingFrequency, duration: number) => {
    onFrequencySelect(frequency, duration)
  }

  return {
    handleFrequencyCardClick
  }
} 