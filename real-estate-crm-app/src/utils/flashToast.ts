export type FlashToast = {
  message: string;
  type: 'success' | 'error';
};

export function readFlashToast(state: unknown): FlashToast | null {
  if (!state || typeof state !== 'object') return null;
  const toast = (state as { toast?: FlashToast }).toast;
  if (!toast?.message || (toast.type !== 'success' && toast.type !== 'error')) {
    return null;
  }
  return toast;
}
