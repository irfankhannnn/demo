import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, SkipForward } from 'lucide-react';
import { getIdToken } from '../../utils/authStorage';

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL as string;
const API_URL = import.meta.env.VITE_API_URL as string;
const BAILEY_ENABLED = import.meta.env.VITE_BAILEY_ENABLED === 'true';

export default function ConnectWhatsApp() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  if (!BAILEY_ENABLED) {
    navigate('/crm', { replace: true });
    return null;
  }

  const handleGetQr = async () => {
    setLoading(true);
    setError('');
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
        setError('WhatsApp connection is not enabled on this server.');
        return;
      }
      setQrCode(data.qrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/crm');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-green-100 p-3 rounded-full">
            <MessageCircle className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Connect WhatsApp</h1>
            <p className="text-sm text-slate-500">Optional — receive leads via WhatsApp</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {connected ? (
          <div className="text-center py-6">
            <p className="text-green-700 font-medium mb-4">WhatsApp connected successfully!</p>
            <button
              onClick={() => navigate('/crm')}
              className="bg-[#2563EB] text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Go to CRM
            </button>
          </div>
        ) : (
          <>
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
              <div className="mb-4 text-center">
                <img src={qrCode} alt="WhatsApp QR Code" className="mx-auto max-w-[200px] border rounded-lg" />
                <p className="text-xs text-slate-500 mt-2">Scan with WhatsApp Business app</p>
              </div>
            )}

            <button
              onClick={handleGetQr}
              disabled={loading || !phone}
              className="w-full bg-[#2563EB] text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 mb-3"
            >
              {loading ? 'Loading...' : qrCode ? 'Refresh QR' : 'Get QR Code'}
            </button>

            <button
              onClick={handleSkip}
              className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 py-2 text-sm"
            >
              <SkipForward className="h-4 w-4" />
              Skip for now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
