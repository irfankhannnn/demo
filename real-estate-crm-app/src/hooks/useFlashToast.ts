import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { readFlashToast } from '../utils/flashToast';

/** Show a toast passed via react-router location state, then clear state. */
export function useFlashToast(showToast: (message: string, type: 'success' | 'error') => void) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const flash = readFlashToast(location.state);
    if (!flash) return;
    showToast(flash.message, flash.type);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);
}
