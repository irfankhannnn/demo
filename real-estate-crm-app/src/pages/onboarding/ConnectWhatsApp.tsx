import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, SkipForward, CheckCircle, Lock, LogOut, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { getIdToken } from '../../utils/authStorage';
import {
  validateWhatsAppPhone,
  isStorageUnreliable,
  fetchConnectionStatus,
  saveConnectedPhone as apiSaveConnectedPhone,
  clearConnectedPhone as apiClearConnectedPhone,
  resolveConnectedPhone,
  WhatsappConnectionSync,
  WhatsappPoller,
  WHATSAPP_QR_POLL_INTERVAL_MS,
  WHATSAPP_QR_POLL_TIMEOUT_MS,
  type WhatsappStatusResult,
} from '../../utils/whatsappConnection';

const API_URL = import.meta.env.VITE_API_URL as string;
const BAILEY_ENABLED = import.meta.env.VITE_BAILEY_ENABLED === 'true';

type Provider = 'bailey' | 'meta';

/**
 * Build a consistent user-facing status message from a status result.
 * Centralized here so the mount check and the manual refresh share the
 * same wording for each error type.
 */
function buildStatusMessage(result: WhatsappStatusResult): string {
  if (result.errorType === 'network') {
    return 'Network error checking connection. Please try again.';
  }
  if (result.errorType === 'auth') {
    return 'Authentication failed. Please log in again.';
  }
  if (result.error) {
    return `Could not verify WhatsApp connection: ${result.error}. You can scan a new QR code to reconnect.`;
  }
  return 'WhatsApp is not connected. Scan a new QR code to reconnect.';
}

export default function ConnectWhatsApp() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const pollerRef = useRef<WhatsappPoller | null>(null);
  const syncRef = useRef<WhatsappConnectionSync | null>(null);
  const qrGenerationInProgressRef = useRef(false);

  const [provider, setProvider] = useState<Provider>('bailey');
  const [phone, setPhone] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [storageUnreliable, setStorageUnreliable] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  if (!BAILEY_ENABLED) {
    navigate('/crm', { replace: true });
    return null;
  }

  // Cleanup mounted flag and resources on unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollerRef.current?.stop();
      syncRef.current?.close();
    };
  }, []);

  // Check if storage is unreliable (incognito mode) on mount.
  useEffect(() => {
    isStorageUnreliable().then((unreliable) => {
      if (unreliable && mountedRef.current) {
        setStorageUnreliable(true);
        setStatusMessage('⚠️ Private browsing detected. Your connection state may not persist after closing the browser.');
      }
    });
  }, []);

  // Set up cross-tab synchronization.
  useEffect(() => {
    syncRef.current = new WhatsappConnectionSync();
    const unsubscribe = syncRef.current.onChange((state) => {
      if (!mountedRef.current) return;
      if (state.phone !== undefined) setPhone(state.phone || '');
      if (state.connected !== undefined) setConnected(state.connected);
      if (state.error !== undefined) setError(state.error || '');
    });
    return () => {
      unsubscribe();
      syncRef.current?.close();
    };
  }, []);

  // On mount, resolve phone from API config (single source of truth) and check connection status.
  useEffect(() => {
    const loadPhoneAndCheck = async () => {
      try {
        const resolvedPhone = await resolveConnectedPhone(() => api.getAiEmployeeConfig());
        if (!mountedRef.current) return;

        if (!resolvedPhone) {
          setLoading(false);
          return;
        }

        setPhone(resolvedPhone);
        setLoading(true);
        let cancelled = false;

        const check = async () => {
          if (cancelled || !mountedRef.current) return;
          const result = await fetchConnectionStatus(resolvedPhone);
          if (cancelled || !mountedRef.current) return;

          if (result.connected) {
            setConnected(true);
            setStatusMessage('');
          } else {
            // Distinguish between network errors and actual disconnection.
            setStatusMessage(buildStatusMessage(result));
          }
          setLoading(false);
        };

        await check();
      } catch (err) {
        console.error('Failed to load phone and check status:', err);
        if (mountedRef.current) {
          setLoading(false);
          setStatusMessage('Failed to load connection status. Please refresh the page.');
        }
      }
    };

    loadPhoneAndCheck();
  }, []);

  // Publish state changes to other tabs.
  // syncRef is a stable ref so it's intentionally omitted from deps;
  // we only want to republish when phone/connected/error actually change.
  useEffect(() => {
    syncRef.current?.publish({ phone, connected, error });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, connected, error]);

  const handleRefreshStatus = async () => {
    if (!phone) return;
    setLoading(true);
    setError('');
    const result = await fetchConnectionStatus(phone);
    if (!mountedRef.current) return;

    if (result.connected) {
      setConnected(true);
      const saveResult = await apiSaveConnectedPhone(phone, (config) => api.updateAiEmployeeConfig(config));
      if (!saveResult.success) {
        setError('WhatsApp connection verified, but failed to save to config. Please try again.');
      }
      setStatusMessage('');
      syncRef.current?.publish({ phone, connected: true, error: '' });
    } else {
      setConnected(false);
      setStatusMessage(buildStatusMessage(result));
    }
    setLoading(false);
  };

  // Poll for status while a QR code is displayed.
  useEffect(() => {
    if (!qrCode || connected || !phone) return;

    const maxAttempts = WHATSAPP_QR_POLL_TIMEOUT_MS / WHATSAPP_QR_POLL_INTERVAL_MS;
    let attempts = 0;

    const handlePollerResult = async (result: WhatsappStatusResult) => {
      if (!mountedRef.current) return;
      attempts += 1;

      if (result.connected) {
        setConnected(true);
        const saveResult = await apiSaveConnectedPhone(phone, (config) => api.updateAiEmployeeConfig(config));
        if (!saveResult.success) {
          setError('WhatsApp connection verified, but failed to save to config. Please refresh.');
        }
        setStatusMessage('');
        syncRef.current?.publish({ phone, connected: true, error: '' });
        pollerRef.current?.stop();
        return;
      }

      if (attempts >= maxAttempts) {
        setStatusMessage('Still waiting for connection. If your phone is stuck, try refreshing the QR code.');
        pollerRef.current?.stop();
        return;
      }

      setStatusMessage('Waiting for you to scan and connect...');
    };

    pollerRef.current = new WhatsappPoller();
    pollerRef.current.start(phone, WHATSAPP_QR_POLL_INTERVAL_MS, handlePollerResult);

    return () => {
      pollerRef.current?.stop();
      pollerRef.current = null;
    };
  }, [qrCode, connected, phone]);

  const handleGetQr = async () => {
    if (provider !== 'bailey') return;
    // Edge case 12: Prevent concurrent QR generation with in-progress flag.
    if (qrGenerationInProgressRef.current) {
      setError('QR code generation already in progress. Please wait.');
      return;
    }

    // Edge case 11: Validate phone number before requesting QR.
    const validation = validateWhatsAppPhone(phone);
    if (!validation.valid) {
      setPhoneError(validation.error || 'Invalid phone number');
      return;
    }
    setPhoneError('');

    qrGenerationInProgressRef.current = true;
    setLoading(true);
    setError('');
    setConnected(false);
    setStatusMessage('');
    setQrCode(null);

    try {
      // Edge case 10: Clear connection with rollback on failure.
      const clearResult = await apiClearConnectedPhone((config) => api.updateAiEmployeeConfig(config));
      if (!clearResult.success) {
        setError('Failed to clear previous connection. Please try again.');
        setLoading(false);
        qrGenerationInProgressRef.current = false;
        return;
      }

      const idToken = getIdToken();
      const res = await fetch(`${API_URL}/auth/whatsapp/pairing-qr`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: validation.normalized }),
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
        const saveResult = await apiSaveConnectedPhone(validation.normalized, (config) => api.updateAiEmployeeConfig(config));
        if (!saveResult.success) {
          setError('WhatsApp connection verified, but failed to save to config. Please try again.');
        }
        syncRef.current?.publish({ phone: validation.normalized, connected: true, error: '' });
        return;
      }

      setQrCode(data.qrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get QR code');
    } finally {
      if (mountedRef.current) setLoading(false);
      qrGenerationInProgressRef.current = false;
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
      // Edge case 10: Rollback on disconnect failure.
      const clearResult = await apiClearConnectedPhone((config) => api.updateAiEmployeeConfig(config));
      if (!clearResult.success) {
        setError('WhatsApp disconnected, but failed to clear config. Please refresh.');
      }
      setConnected(false);
      setQrCode(null);
      setStatusMessage('');
      syncRef.current?.publish({ phone: '', connected: false, error: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2.5 sm:p-3 rounded-full flex-shrink-0">
              <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">Connect WhatsApp</h1>
              <p className="text-xs sm:text-sm text-slate-500">Receive and send leads via WhatsApp</p>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-5 sm:mb-6 pl-1">
            Optional — you can skip and connect later from Settings.
          </p>

          {connected ? (
            <div className="text-center py-6 sm:py-8">
              <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-500 mx-auto mb-3" />
              <p className="text-green-700 font-semibold text-base sm:text-lg mb-1">WhatsApp Connected!</p>
              <p className="text-slate-500 text-sm mb-2">
                {phone ? `Connected to ${phone}` : "You'll now receive lead notifications on WhatsApp."}
              </p>
              <p className="text-slate-400 text-xs mb-6">
                Your phone will stay linked until you disconnect.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => navigate('/crm')}
                  className="w-full min-h-[44px] touch-manipulation bg-brand text-white px-6 sm:px-8 py-2.5 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Go to CRM
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="w-full min-h-[44px] touch-manipulation flex items-center justify-center gap-2 text-red-600 hover:text-red-700 py-2 text-sm transition-colors disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect WhatsApp
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Provider Selection */}
              <div className="mb-5 sm:mb-6">
                <p className="text-sm font-medium text-slate-700 mb-3">Choose connection method</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Bailey — MVP Primary */}
                  <button
                    onClick={() => setProvider('bailey')}
                    className={`relative min-h-[44px] touch-manipulation p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${
                      provider === 'bailey'
                        ? 'border-brand bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1 pr-6">
                      <MessageCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="font-semibold text-slate-900 text-sm">Bailey</span>
                      <span className="bg-green-100 text-green-700 text-xs font-medium px-1.5 py-0.5 rounded">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Instant QR scan. Connect your WhatsApp Business number in 60 seconds.
                    </p>
                    {provider === 'bailey' && (
                      <CheckCircle className="absolute top-3 right-3 h-4 w-4 text-brand" />
                    )}
                  </button>

                  {/* Meta Official — Phase 2 */}
                  <div className="relative p-3 sm:p-4 rounded-xl border-2 border-slate-200 opacity-60 cursor-not-allowed">
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
                  {storageUnreliable && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 mb-4 text-sm">
                      ⚠️ Private browsing detected. Your connection state may not persist after closing the browser.
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 mb-4 text-sm">
                      {error}
                    </div>
                  )}

                  {statusMessage && (
                    <div className={`rounded-lg p-3 mb-4 text-sm border ${
                      statusMessage.includes('Network') || statusMessage.includes('Authentication')
                        ? 'bg-orange-50 border-orange-200 text-orange-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                    }`}>
                      {statusMessage}
                    </div>
                  )}

                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    WhatsApp Business Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneError('');
                    }}
                    placeholder="+91 98765 43210"
                    className={`w-full min-h-[44px] text-base border rounded-lg px-3 py-2 mb-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      phoneError ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                  {phoneError && (
                    <p className="text-red-600 text-xs mb-4">{phoneError}</p>
                  )}

                  {qrCode && (
                    <div className="mb-4 p-3 sm:p-4 bg-slate-50 rounded-lg text-center">
                      <img
                        src={qrCode}
                        alt="WhatsApp QR Code"
                        className="mx-auto w-full max-w-[200px] h-auto border rounded-lg mb-2"
                      />
                      <p className="text-xs text-slate-500">
                        Open WhatsApp Business → Settings → Linked Devices → Scan QR
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleGetQr}
                    disabled={loading || !phone.trim()}
                    className="w-full min-h-[44px] touch-manipulation bg-brand text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-3 transition-colors"
                  >
                    {loading ? 'Connecting...' : qrCode ? 'Refresh QR Code' : 'Get QR Code'}
                  </button>

                  <button
                    onClick={handleRefreshStatus}
                    disabled={loading || !phone.trim()}
                    className="w-full min-h-[44px] touch-manipulation flex items-center justify-center gap-2 text-slate-600 hover:text-slate-800 py-2 text-sm transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh status
                  </button>
                </div>
              )}

              <button
                onClick={() => navigate('/crm')}
                className="w-full min-h-[44px] touch-manipulation flex items-center justify-center gap-2 text-center text-slate-500 hover:text-slate-700 py-2 text-sm transition-colors"
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
