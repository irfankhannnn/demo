import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { api } from '@/services/api';

type Handler = (url: string, init: RequestInit) => { status: number; body?: unknown } | Promise<{ status: number; body?: unknown }>;

function mockFetch(handler: Handler) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const r = await handler(url, init);
    return new Response(r.body === undefined ? '' : JSON.stringify(r.body), {
      status: r.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

function Probe() {
  const { status, user, profileComplete } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="name">{user?.name ?? ''}</span>
      <span data-testid="complete">{String(profileComplete)}</span>
    </div>
  );
}

const user = { userId: 'u1', name: 'Asha', phone: '+919876543210', email: null };

describe('AuthProvider bootstrap', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('restores the session from the refresh cookie and loads /auth/me', async () => {
    const { calls } = mockFetch((url) => {
      if (url.endsWith('/auth/refresh')) return { status: 200, body: { accessToken: 'acc', idToken: 'tok-1', expiresIn: 3600 } };
      if (url.endsWith('/auth/me')) return { status: 200, body: { user } };
      return { status: 404, body: { error: 'nope' } };
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authed'));
    expect(screen.getByTestId('name')).toHaveTextContent('Asha');
    expect(screen.getByTestId('complete')).toHaveTextContent('true');

    const refresh = calls.find((c) => c.url.endsWith('/auth/refresh'));
    expect(refresh?.init.credentials).toBe('include');
    const me = calls.find((c) => c.url.endsWith('/auth/me'));
    expect((me?.init.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
  });

  it('lands on anon when the refresh cookie is missing', async () => {
    mockFetch((url) => {
      if (url.endsWith('/auth/refresh')) return { status: 401, body: { error: 'no cookie' } };
      return { status: 500 };
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anon'));
  });
});

describe('refresh-on-401 through the api client', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('refreshes once and retries with the new bearer', async () => {
    let refreshCount = 0;
    const { calls } = mockFetch((url, init) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      if (url.endsWith('/auth/refresh')) {
        refreshCount += 1;
        return { status: 200, body: { accessToken: 'acc', idToken: `tok-${refreshCount}`, expiresIn: 3600 } };
      }
      if (url.endsWith('/auth/me')) return { status: 200, body: { user } };
      if (url.endsWith('/me/saved')) {
        // first token is "expired": force a 401 until the client refreshes
        if (auth === 'Bearer tok-1') return { status: 401, body: { error: 'expired' } };
        return { status: 200, body: { items: [{ propertyId: 'p1' }] } };
      }
      return { status: 404 };
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authed'));

    let result: { items: { propertyId: string }[] } | undefined;
    await act(async () => {
      result = await api.get<{ items: { propertyId: string }[] }>('/me/saved', { auth: 'required' });
    });

    expect(result?.items[0].propertyId).toBe('p1');
    expect(refreshCount).toBe(2);
    const savedCalls = calls.filter((c) => c.url.endsWith('/me/saved'));
    expect(savedCalls).toHaveLength(2);
    expect((savedCalls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer tok-2');
  });

  it('drops the session when the refresh after a 401 also fails', async () => {
    let refreshCount = 0;
    mockFetch((url) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCount += 1;
        if (refreshCount === 1) return { status: 200, body: { accessToken: 'acc', idToken: 'tok-1', expiresIn: 3600 } };
        return { status: 401, body: { error: 'cookie expired' } };
      }
      if (url.endsWith('/auth/me')) return { status: 200, body: { user } };
      if (url.endsWith('/me/saved')) return { status: 401, body: { error: 'expired' } };
      return { status: 404 };
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authed'));

    await act(async () => {
      await expect(api.get('/me/saved', { auth: 'required' })).rejects.toMatchObject({ status: 401 });
    });
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anon'));
  });
});
