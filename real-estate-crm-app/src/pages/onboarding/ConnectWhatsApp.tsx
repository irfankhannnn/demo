import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, SkipForward, CheckCircle, Lock, LogOut, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { getIdToken } from '../../utils/authStorage';

const API_URL = import.meta.env.VITE_API_URL as string;
const BAILEY_ENABLED = import.meta.env.VITE_BAILEY_ENABLED === 'true';
const CONNECTED_PHONE_KEY = 'connectedWhatsAppPhone';

const STATUS_POLL_INTERVAL_MS = 3000;
const STATUS_POLL_TIMEOUT_MS = 120000;

type Provider = 'bailey' | 'meta';

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn('localStorage.getItem failed', err);
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn('localStorage.setItem failed', err);
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn('localStorage.removeItem failed', err);
  }
}

async function saveConnectedPhone(phone: string): Promise<boolean> {
  try {
    safeLocalStorageSet(CONNECTED_PHONE_KEY, phone);
    await api.updateAiEmployeeConfig({ connectedWhatsAppPhone: phone });
    return true;
  } catch (err) {
    console.error('Failed to save connected phone to config:', err);
    // Keep the local storage value but return false to indicate sync failed
    return false;
  }
}

async function clearConnectedPhone(): Promise<boolean> {
  try {
    safeLocalStorageRemove(CONNECTED_PHONE_KEY);
    await api.updateAiEmployeeConfig({ connectedWhatsAppPhone: null });
    return true;
  } catch (err) {
    console.error('Failed to clear connected phone from config:', err);
    // Keep the local storage cleared but return false to indicate sync failed
    return false;
  }
}

export default function ConnectWhatsApp() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const [provider, setProvider] = useState<Provider>('bailey');
  const [phone, setPhone] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  if (!BAILEY_ENABLED) {
    navigate('/crm', { replace: true });
    return null;
  }

  // Cleanup mounted flag on unmount to prevent state updates after unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // On mount, check connection status FIRST before showing the QR flow.
  // If the phone is already connected, show the connected state immediately.
  useEffect(() => {
    const storedPhone = safeLocalStorageGet(CONNECTED_PHONE_KEY);
    if (!storedPhone) {
      setLoading(false);
      return;
    }

    setPhone(storedPhone);
    setLoading(true);
    let cancelled = false;

    const check = async () => {
      if (cancelled || !mountedRef.current) return;

      const result = await fetchConnectionStatus(storedPhone);
      if (cancelled || !mountedRef.current) return;

      if (result.connected) {
        setConnected(true);
        setStatusMessage('');
      } else {
        // Status check failed or disconnected — allow the user to get a new QR code.
        setStatusMessage(
          result.error
            ? `Could not verify WhatsApp connection: ${result.error}. You can scan a new QR code to reconnect.`
            : 'WhatsApp is not connected. Scan a new QR code to reconnect.'
        );
      }
      setLoading(false);
    };

    check();

    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchConnectionStatus(phoneNumber: string): Promise<{ connected: boolean; error?: string }> {
    try {
      const idToken = getIdToken();
      const res = await fetch(`${API_URL}/auth/whatsapp/status/${encodeURIComponent(phoneNumber)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('status fetch failed', err);
        return { connected: false, error: err.error || 'status_check_failed' };
      }

      const data = await res.json();
      return { connected: !!data.connected, error: data.error };
    } catch (err) {
      console.error('status fetch error', err);
      return { connected: false, error: err instanceof Error ? err.message : 'unknown' };
    }
  }

  const handleRefreshStatus = async () => {
    if (!phone) return;
    setLoading(true);
    setError('');
    const result = await fetchConnectionStatus(phone);
    if (!mountedRef.current) return;

    if (result.connected) {
      setConnected(true);
      const syncSuccess = await saveConnectedPhone(phone);
      if (!syncSuccess) {
        setError('WhatsApp connection verified, but failed to save to config. Please try again.');
      }
      setStatusMessage('');
    } else {
      setConnected(false);
      setStatusMessage(
        result.error
          ? `Status check failed: ${result.error}. You can scan a new QR code to reconnect.`
          : 'WhatsApp is not connected. Scan a new QR code to reconnect.'
      );
    }
    setLoading(false);
  };

  // Poll for status while a QR code is displayed.
  useEffect(() => {
    if (!qrCode || connected || !phone) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = STATUS_POLL_TIMEOUT_MS / STATUS_POLL_INTERVAL_MS;

    const checkStatus = async () => {
      if (cancelled) return;
      attempts += 1;

      const result = await fetchConnectionStatus(phone);
      if (cancelled) return;

      if (result.connected) {
        setConnected(true);
        const syncSuccess = await saveConnectedPhone(phone);
        if (!syncSuccess) {
          setError('WhatsApp connection verified, but failed to save to config. Please refresh.');
        }
        setStatusMessage('');
        cancelled = true;
        return;
      }

      if (attempts >= maxAttempts) {
        setStatusMessage('Still waiting for connection. If your phone is stuck, try refreshing the QR code.');
        cancelled = true;
        return;
      }

      setStatusMessage('Waiting for you to scan and connect...');
    };

    checkStatus();
    const interval = setInterval(checkStatus, STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [qrCode, connected, phone]);

  const handleGetQr = async () => {
    if (provider !== 'bailey') return;
    setLoading(true);
    setError('');
    setConnected(false);
    setStatusMessage('');
    setQrCode(null);
    const cleared = await clearConnectedPhone();
    if (!cleared) {
      setError('Failed to clear previous connection. Please try again.');
      setLoading(false);
      return;
    }
    try {
      const idToken = getIdToken();
      const res = await fetch(`${API_URL}/auth/whatsapp/pairing-qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get QR code');
      }
      const data = await res.json();
      if (!data.enabled) {
        setError('WhatsApp connection is not enabled on this server. Contact your admin.');
        return;
      }

      // Already connected — show success immediately.
      if (data.connected) {
        setConnected(true);
        const syncSuccess = await saveConnectedPhone(phone);
        if (!syncSuccess) {
          setError('WhatsApp connection verified, but failed to save to config. Please try again.');
        }
        return;
      }

      setQrCode(data.qrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get QR code');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!phone) return;
    setLoading(true);
    setError('');
    try {
      const idToken = getIdToken();
      const res = await fetch(`${API_URL}/auth/whatsapp/disconnect/${encodeURIComponent(phone)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to disconnect');
      }
      const data = await res.json();
      if (!data.disconnected) {
        throw new Error(data.error || 'Disconnect failed on service side');
      }
      const syncSuccess = await clearConnectedPhone();
      if (!syncSuccess) {
        setError('WhatsApp disconnected, but failed to clear config. Please refresh.');
      }
      setConnected(false);
      setQrCode(null);
      setStatusMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-3 rounded-full">
              <MessageCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Connect WhatsApp</h1>
              <p className="text-sm text-slate-500">Receive and send leads via WhatsApp</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-6 pl-1">
            Optional — you can skip and connect later from Settings.
          </p>

          {connected ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-green-700 font-semibold text-lg mb-1">WhatsApp Connected!</p>
              <p className="text-slate-500 text-sm mb-2">
                {phone ? `Connected to ${phone}` : "You'll now receive lead notifications on WhatsApp."}
              </p>
              <p className="text-slate-400 text-xs mb-6">
                Your phone will stay linked until you disconnect.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate('/crm')}
                  className="bg-[#2563EB] text-white px-8 py-2.5 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Go to CRM
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 text-red-600 hover:text-red-700 py-2 text-sm transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect WhatsApp
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Provider Selection */}
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-700 mb-3">Choose connection method</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Bailey — MVP Primary */}
                  <button
                    onClick={() => setProvider('bailey')}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      provider === 'bailey'
                        ? 'border-[#2563EB] bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      <span className="font-semibold text-slate-900 text-sm">Bailey</span>
                      <span className="bg-green-100 text-green-700 text-xs font-medium px-1.5 py-0.5 rounded">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Instant QR scan. Connect your WhatsApp Business number in 60 seconds.
                    </p>
                    {provider === 'bailey' && (
                      <CheckCircle className="absolute top-3 right-3 h-4 w-4 text-[#2563EB]" />
                    )}
                  </button>

                  {/* Meta Official — Phase 2 */}
                  <div className="relative p-4 rounded-xl border-2 border-slate-200 opacity-60 cursor-not-allowed">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span className="font-semibold text-slate-700 text-sm">Meta Official</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Official WhatsApp Business API. Requires WABA approval (10-15 days).
                    </p>
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-slate-100 text-slate-500 text-xs px-1.5 py-0.5 rounded">
                      <Lock className="h-3 w-3" />
                      Coming soon
                    </div>
                  </div>
                </div>
              </div>

              {/* Bailey Connection Form */}
              {provider === 'bailey' && (
                <div>
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 mb-4 text-sm">
                      {error}
                    </div>
                  )}

                  {statusMessage && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 mb-4 text-sm">
                      {statusMessage}
                    </div>
                  )}

                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    WhatsApp Business Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />

                  {qrCode && (
                    <div className="mb-4 p-4 bg-slate-50 rounded-lg text-center">
                      <img
                        src={qrCode}
                        alt="WhatsApp QR Code"
                        className="mx-auto max-w-[200px] border rounded-lg mb-2"
                      />
                      <p className="text-xs text-slate-500">
                        Open WhatsApp Business → Settings → Linked Devices → Scan QR
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleGetQr}
                    disabled={loading || !phone.trim()}
                    className="w-full bg-[#2563EB] text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-3 transition-colors"
                  >
                    {loading ? 'Connecting...' : qrCode ? 'Refresh QR Code' : 'Get QR Code'}
                  </button>

                  <button
                    onClick={handleRefreshStatus}
                    disabled={loading || !phone.trim()}
                    className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 py-2 text-sm transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh status
                  </button>
                </div>
              )}

              <button
                onClick={() => navigate('/crm')}
                className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 py-2 text-sm transition-colors"
              >
                <SkipForward className="h-4 w-4" />
                Skip for now — connect later from Settings
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Bailey uses WhatsApp Web protocol. Meta Official requires Business Verification.
        </p>
      </div>
    </div>
  );
}
