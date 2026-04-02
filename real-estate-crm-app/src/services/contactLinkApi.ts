const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL as string;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_id_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(response: Response) {
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`);
  }
  return data;
}

// --- Self-service contact linking ---

export async function startEmailLink(email: string) {
  const response = await fetch(`${AUTH_API_URL}/auth/profile/contact/email/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
}

export async function startPhoneLink(phoneNumber: string) {
  const response = await fetch(`${AUTH_API_URL}/auth/profile/contact/phone/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ phoneNumber }),
  });
  return handleResponse(response);
}

export async function verifyPhoneLink(phoneNumber: string, otp: string) {
  const response = await fetch(`${AUTH_API_URL}/auth/profile/contact/phone/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ phoneNumber, otp }),
  });
  return handleResponse(response);
}

// --- Admin-managed contact linking ---

export async function adminStartEmailLink(userId: string, email: string) {
  const response = await fetch(`${AUTH_API_URL}/users/${userId}/contact/email/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ email }),
  });
  return handleResponse(response);
}

export async function adminStartPhoneLink(userId: string, phoneNumber: string) {
  const response = await fetch(`${AUTH_API_URL}/users/${userId}/contact/phone/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ phoneNumber }),
  });
  return handleResponse(response);
}
