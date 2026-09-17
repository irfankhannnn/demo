/**
 * Google Auth Error Types
 */
export interface GoogleAuthError {
  code: 'INVALID_AUTH_CODE' | 'ACCESS_DENIED' | 'TOKEN_EXCHANGE_FAILED' | 'NETWORK_ERROR';
  message: string;
  details?: any;
  retryable: boolean;
}

export const GOOGLE_AUTH_ERRORS = {
  INVALID_AUTH_CODE: {
    code: 'INVALID_AUTH_CODE' as const,
    message: 'Authorization code expired or already used. Please try signing in again.',
    retryable: false,
  },
  ACCESS_DENIED: {
    code: 'ACCESS_DENIED' as const,
    message: 'Access denied by Google or user cancelled authentication.',
    retryable: false,
  },
  TOKEN_EXCHANGE_FAILED: {
    code: 'TOKEN_EXCHANGE_FAILED' as const,
    message: 'Failed to exchange authorization code for tokens.',
    retryable: false,
  },
  NETWORK_ERROR: {
    code: 'NETWORK_ERROR' as const,
    message: 'Network error during authentication. Please try again.',
    retryable: true,
  },
};
