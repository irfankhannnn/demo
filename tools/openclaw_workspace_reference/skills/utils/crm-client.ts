import axios, { AxiosError } from 'axios';
import './bootstrap';

export interface CrmError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

function classifyError(err: AxiosError): CrmError {
  if (err.response) {
    const status = err.response.status;
    const data = err.response.data as any;
    const backendMsg = data?.error || data?.message;

    switch (status) {
      case 400:
        return { status, code: 'VALIDATION_ERROR', message: backendMsg || 'Invalid request data', details: data };
      case 401:
        return { status, code: 'UNAUTHORIZED', message: 'Authentication failed. Check CRM_TOKEN in .env.' };
      case 403:
        return { status, code: 'FORBIDDEN', message: 'Access denied. You do not have permission for this operation.' };
      case 404:
        return { status, code: 'NOT_FOUND', message: backendMsg || 'The requested resource was not found.' };
      case 409:
        return { status, code: 'CONFLICT', message: backendMsg || 'A record with this data already exists.' };
      case 429:
        return { status, code: 'RATE_LIMITED', message: 'Too many requests. Please wait and try again.' };
      default:
        if (status >= 500) {
          return { status, code: 'SERVER_ERROR', message: 'The CRM backend is experiencing issues. Try again later.' };
        }
        return { status, code: 'HTTP_ERROR', message: backendMsg || err.message };
    }
  }

  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return { status: 0, code: 'TIMEOUT', message: 'Request timed out. Check your network or try again.' };
  }

  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    return { status: 0, code: 'NETWORK_ERROR', message: 'Cannot reach the CRM backend. Check your network connection.' };
  }

  return { status: 0, code: 'NETWORK_ERROR', message: err.message || 'An unexpected network error occurred.' };
}

export const crmClient = axios.create({
  baseURL: process.env.CRM_API_BASE,
  headers: {
    Authorization: `Bearer ${process.env.CRM_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

crmClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const crmErr = classifyError(err);
    const enriched = Object.assign(new Error(crmErr.message), {
      crmError: crmErr,
      originalError: err,
    });
    return Promise.reject(enriched);
  }
);

export function isCrmError(err: unknown): err is Error & { crmError: CrmError } {
  return err instanceof Error && 'crmError' in err;
}