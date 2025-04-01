'use client';

import { Coach } from '@/app/config/coaches';

interface UseCoachSelectorProps {
  onCoachSelect: (coach: Coach) => void;
}

export const useCoachSelector = ({ onCoachSelect }: UseCoachSelectorProps) => {
  const handleCoachCardClick = (coach: Coach) => {
    onCoachSelect(coach);
  };

  return {
    handleCoachCardClick,
  };
}; 