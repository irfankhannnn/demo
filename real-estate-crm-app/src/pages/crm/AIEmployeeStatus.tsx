import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bot, Clock, CheckCircle, AlertTriangle, ExternalLink, MessageCircle } from 'lucide-react';
import { getIdToken } from '../../utils/authStorage';
import { CRM_API_URL } from '../../config/apiConfig';

interface ProvisioningData {
  tenantId: string;
  status: 'pending' | 'live' | 'escalated';
  expectedSLAEnd: string;
  loomUrl: string | null;
  liveAt: string | null;
  createdAt: string;
  updatedAt: string;
  contactPhone: string | null;
}

const API_URL = CRM_API_URL;

export default function AIEmployeeStatus() {
  const navigate = useNavigate();
  const [data, setData] = useState<ProvisioningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const idToken = getIdToken();
      const res = await fetch(`${API_URL}/ai-employee/status`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (res.status === 404) {
        setNotFound(true);
        return;
      }

      if (!res.ok) throw new Error('Failed to fetch status');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    // Poll while status is pending
    if (data?.status === 'pending') {
      const interval = setInterval(() => {
        fetchStatus();
      }, 30000); // Poll every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [data?.status, fetchStatus]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  // Not paid — show upgrade prompt
  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Bot className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">AI Employee is not active on your plan</h2>
          <p className="text-gray-500 mb-6">
            Upgrade to add an AI Employee that runs your broking agency on WhatsApp + Telegram.
          </p>
          <button
            onClick={() => navigate('/billing')}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            View Plans & Upgrade
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">AI Employee Status</h1>
          </div>
        </div>

        <div className="p-6">
          {/* Pending state */}
          {data.status === 'pending' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                  <Clock className="w-4 h-4 mr-1" /> Setup in Progress
                </span>
              </div>

              <p className="text-gray-700 mb-4">
                Our team will message your WhatsApp ({data.contactPhone || 'registered number'}) within 24 hours.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Expected by: {formatDate(data.expectedSLAEnd)}
              </p>

              {/* Visual progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                <div className="bg-yellow-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">What we're setting up:</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    Configuring your AI Employee personality & knowledge
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    Setting up WhatsApp Business + Telegram bot
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    Connecting to your CRM data (leads, properties, owners)
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    Running 3-message smoke test
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    Recording 90-second walkthrough video
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Live state */}
          {data.status === 'live' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  <CheckCircle className="w-4 h-4 mr-1" /> Live
                </span>
              </div>

              <p className="text-gray-700 mb-2 text-lg">
                🎉 Your AI Employee is live!
              </p>
              {data.liveAt && (
                <p className="text-sm text-gray-500 mb-4">
                  Live since: {formatDate(data.liveAt)}
                </p>
              )}
              {data.contactPhone && (
                <p className="text-gray-700 mb-6">
                  Send a test message to <span className="font-medium">{data.contactPhone}</span>
                </p>
              )}

              {/* Loom embed */}
              {data.loomUrl && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">90-sec Walkthrough</h3>
                  <div className="aspect-video rounded-lg overflow-hidden border border-gray-200">
                    <iframe
                      src={data.loomUrl.replace('share', 'embed')}
                      className="w-full h-full"
                      allow="autoplay; fullscreen"
                      allowFullScreen
                    />
                  </div>
                  <a
                    href={data.loomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mt-2"
                  >
                    Open in Loom <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Escalated state */}
          {data.status === 'escalated' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  <AlertTriangle className="w-4 h-4 mr-1" /> SLA Missed
                </span>
              </div>

              <p className="text-gray-700 mb-2">
                We missed our 24-hour SLA. We sincerely apologize.
              </p>
              <p className="text-gray-700 mb-4">
                A ₹500 credit has been applied to your account. Our founder will WhatsApp you within 1 hour.
              </p>

              <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-sm text-red-700">
                <p className="font-medium mb-1">What happened?</p>
                <p>Your setup was expected by {formatDate(data.expectedSLAEnd)} but wasn't completed in time. We're on it now with highest priority.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Last updated: {formatDate(data.updatedAt)}</span>
            <button
              onClick={() => {
                if (window.$crisp) {
                  window.$crisp.push(['do', 'chat:open']);
                }
              }}
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <MessageCircle className="w-4 h-4 mr-1" /> Chat with support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
