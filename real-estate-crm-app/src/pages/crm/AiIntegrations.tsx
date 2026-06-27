import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, LogOut, Plus, Trash2, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { logger } from '../../lib/logger';

interface ConnectedApp {
  clientId: string;
  clientName: string;
  status: 'connected' | 'pending' | 'disconnected';
  connectedAt?: string;
  lastUsedAt?: string;
  scopes?: string[];
}

interface AvailableApp {
  id: string;
  name: string;
  description: string;
  logo: string;
  url: string;
  color: string;
}

const AVAILABLE_APPS: AvailableApp[] = [
  {
    id: 'anthropic',
    name: 'Claude',
    description: 'Connect to Claude for AI-powered conversations and analysis',
    logo: '🤖',
    url: 'https://claude.ai',
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    description: 'Connect to ChatGPT for AI-powered conversations and analysis',
    logo: '✨',
    url: 'https://chatgpt.com',
    color: 'from-green-500 to-green-600',
  },
];

export default function AiIntegrations() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load connected apps
  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await api.get('/ai-integrations');
      setConnections(response.data.connections || []);
      setError(null);
    } catch (err) {
      logger.error('Failed to load AI integrations', err);
      setError('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (clientId: string) => {
    try {
      setConnecting(clientId);
      const response = await api.post('/ai-integrations/connect', { clientId });
      
      if (response.data.redirectUrl) {
        // Redirect to OAuth authorization
        window.location.href = response.data.redirectUrl;
      }
    } catch (err) {
      logger.error('Failed to initiate connection', err);
      setError(`Failed to connect to ${clientId}`);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (clientId: string) => {
    if (!window.confirm(`Are you sure you want to disconnect ${clientId}?`)) {
      return;
    }

    try {
      setDisconnecting(clientId);
      await api.delete(`/ai-integrations/${clientId}`);
      setConnections(connections.filter((c) => c.clientId !== clientId));
      setError(null);
    } catch (err) {
      logger.error('Failed to disconnect', err);
      setError(`Failed to disconnect ${clientId}`);
    } finally {
      setDisconnecting(null);
    }
  };

  const isConnected = (clientId: string) => {
    return connections.some((c) => c.clientId === clientId && c.status === 'connected');
  };

  const getConnectionInfo = (clientId: string) => {
    return connections.find((c) => c.clientId === clientId);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bot className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-slate-900">AI Integrations</h1>
          </div>
          <p className="text-slate-600">
            Connect RealtyFlow to Claude, ChatGPT, and other AI apps for intelligent conversations and analysis
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Available Apps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {AVAILABLE_APPS.map((app) => {
            const connected = isConnected(app.id);
            const connectionInfo = getConnectionInfo(app.id);

            return (
              <div
                key={app.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Card Header */}
                <div className={`bg-gradient-to-r ${app.color} p-6 text-white`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{app.logo}</div>
                      <div>
                        <h2 className="text-2xl font-bold">{app.name}</h2>
                        <p className="text-white/80 text-sm">{app.description}</p>
                      </div>
                    </div>
                    {connected && (
                      <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Connected</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6">
                  {connected && connectionInfo ? (
                    <div className="space-y-4">
                      <div className="bg-slate-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                          <Clock className="w-4 h-4" />
                          <span>Connected on {new Date(connectionInfo.connectedAt!).toLocaleDateString()}</span>
                        </div>
                        {connectionInfo.lastUsedAt && (
                          <div className="text-sm text-slate-600">
                            Last used: {new Date(connectionInfo.lastUsedAt).toLocaleDateString()}
                          </div>
                        )}
                        {connectionInfo.scopes && connectionInfo.scopes.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {connectionInfo.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="inline-block bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open {app.name}
                        </a>
                        <button
                          onClick={() => handleDisconnect(app.id)}
                          disabled={disconnecting === app.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          {disconnecting === app.id ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-slate-600 text-sm">
                        Connect {app.name} to RealtyFlow to enable AI-powered features and conversations.
                      </p>
                      <button
                        onClick={() => handleConnect(app.id)}
                        disabled={connecting === app.id}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium py-3 px-4 rounded-lg transition-all disabled:opacity-50"
                      >
                        <Plus className="w-5 h-5" />
                        {connecting === app.id ? 'Connecting...' : `Connect to ${app.name}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">How to Connect</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Click "Connect" Button</h3>
                <p className="text-slate-600">
                  Click the "Connect to Claude" or "Connect to ChatGPT" button above to start the authorization process.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Authorize RealtyFlow</h3>
                <p className="text-slate-600">
                  You'll be redirected to Claude or ChatGPT to authorize RealtyFlow access. Review the permissions and click "Allow".
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Start Using</h3>
                <p className="text-slate-600">
                  Once connected, you can use Claude or ChatGPT to interact with your RealtyFlow data. Ask questions like "Show me recent leads" or "Create a new property".
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-900 text-sm">
              <strong>💡 Tip:</strong> You can connect multiple AI apps at the same time. Each app will have access to your RealtyFlow data based on the permissions you grant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
