'use client';

import { CoachId } from '@/config/coaches';

interface UseCoachSelectorProps {
  onCoachSelect: (coach: CoachId) => void;
}

export const useCoachSelector = ({ onCoachSelect }: UseCoachSelectorProps) => {
  const handleCoachCardClick = (coach: CoachId) => {
    onCoachSelect(coach);
  };

  return {
    handleCoachCardClick,
  };
}; 