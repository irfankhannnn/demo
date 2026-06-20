import { useCreditsContext } from '../contexts/CreditsContext';

export function useCredits() {
  return useCreditsContext();
}
