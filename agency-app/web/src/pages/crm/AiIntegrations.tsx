import { useState, useEffect } from 'react';
import { Bot, Trash2, CheckCircle, Clock, Monitor, AlertCircle, X } from 'lucide-react';
import { api } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { MCP_API_HOSTNAME, MCP_SERVER_URL } from '../../config/apiConfig';

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

// Hostnames that are allowed as OAuth redirect targets.
// This list includes the MCP server's custom domain (from config/apiConfig)
// so the frontend can safely redirect to the MCP /oauth/authorize page.
const ALLOWED_REDIRECT_HOSTS = [
  'claude.ai',
  'chatgpt.com',
  'api.openai.com',
  'localhost',
  ...(MCP_API_HOSTNAME ? [MCP_API_HOSTNAME] : []),
];

export default function AiIntegrations() {
  const [connections, setConnections] = useState<ConnectedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Claude Desktop (mcp-remote) flow:
   * When mcp-remote opens the browser to the MCP /oauth/authorize page without
   * a session, the MCP server redirects here with the original OAuth URL encoded
   * as `mcp_oauth_callback`. We show a "Claude Desktop wants to connect" banner
   * so the user can approve and send the browser back to the MCP consent page
   * with a valid session code.
   */
  const [mcpOauthCallback, setMcpOauthCallback] = useState<string | null>(null);
  const [desktopApproving, setDesktopApproving] = useState(false);

  // Load connected apps and detect returning from OAuth redirect or Claude Desktop
  useEffect(() => {
    loadConnections();

    const urlParams = new URLSearchParams(window.location.search);
    const oauthStatus = urlParams.get('oauth');
    const oauthClient = urlParams.get('client') || 'AI app';
    const mcpCallback = urlParams.get('mcp_oauth_callback');

    if (oauthStatus === 'success') {
      setSuccessMessage(`${oauthClient} connected successfully`);
      setError(null);
      // Refresh the connection list after returning from OAuth flow
      loadConnections();
    } else if (oauthStatus === 'error') {
      const errorMessage = urlParams.get('message') || 'Connection failed';
      setError(errorMessage);
      setSuccessMessage(null);
    }

    // Claude Desktop (mcp-remote) redirected here because the user was not
    // authenticated at the MCP /oauth/authorize page. Decode and store the
    // original OAuth URL so we can send the user back after generating a
    // session code.
    if (mcpCallback) {
      try {
        const decodedUrl = decodeURIComponent(mcpCallback);
        // Basic sanity check: must be an OAuth authorize URL
        const parsed = new URL(decodedUrl);
        if (parsed.pathname.includes('/oauth/authorize')) {
          setMcpOauthCallback(decodedUrl);
        } else {
          console.warn('AiIntegrations: mcp_oauth_callback URL is not an authorize endpoint');
        }
      } catch {
        console.warn('AiIntegrations: failed to parse mcp_oauth_callback');
      }
    }

    // Clean all OAuth/callback query params from URL without reloading
    if (oauthStatus || mcpCallback) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  /**
   * Validate that a redirect URL's hostname is explicitly allowed.
   * Prevents the frontend from being used as an open redirector.
   */
  function isTrustedRedirectUrl(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.origin);
      return (
        parsed.hostname === window.location.hostname ||
        ALLOWED_REDIRECT_HOSTS.some((allowed) =>
          parsed.hostname === allowed || parsed.hostname.endsWith(`.${allowed}`)
        )
      );
    } catch {
      return false;
    }
  }

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await api.get('/ai-integrations');
      setConnections(response.data.data.connections || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load AI integrations', err);
      setError('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initiate the web OAuth flow for a given AI app (Claude Web / ChatGPT).
   * The backend registers a DCR client, generates PKCE, creates a session code,
   * and returns an MCP /oauth/authorize URL to redirect the browser to.
   */
  const handleConnect = async (clientId: string) => {
    try {
      setConnecting(clientId);
      setError(null);
      const response = await api.post('/ai-integrations/connect', { clientId });

      if (response.data.data.redirectUrl) {
        // Only redirect to trusted hosts
        if (!isTrustedRedirectUrl(response.data.data.redirectUrl)) {
          setError('Security error: server returned an untrusted redirect URL');
          setConnecting(null);
          return;
        }
        window.location.href = response.data.data.redirectUrl;
      }
    } catch (err) {
      console.error('Failed to initiate connection', err);
      setError(`Failed to connect to ${clientId}. Please try again.`);
      setConnecting(null);
    }
  };

  /**
   * Approve a Claude Desktop (mcp-remote) connection request.
   *
   * Calls POST /api/ai-integrations/desktop-session which creates a session
   * code for the current user and injects it into the stored OAuth callback URL.
   * The browser is then redirected to the MCP /oauth/authorize page, where the
   * session code authenticates the user and the consent page is shown.
   */
  const handleDesktopApprove = async () => {
    if (!mcpOauthCallback) return;

    try {
      setDesktopApproving(true);
      setError(null);

      const response = await api.post('/ai-integrations/desktop-session', {
        oauthCallbackUrl: mcpOauthCallback,
      });

      if (response.datd.aata.authorizeUrl) {
        const authorizeUrl = response.data.data.authorizeUrl as string;
        if (!isTrustedRedirectUrl(authorizeUrl)) {
          setError('Security error: server returned an untrusted redirect URL');
          setDesktopApproving(false);
          return;
        }
        // Redirect browser back to MCP /oauth/authorize with session code
        window.location.href = authorizeUrl;
      }
    } catch (err) {
      console.error('Failed to create desktop session', err);
      setError('Failed to initiate Claude Desktop connection. Please try again.');
      setDesktopApproving(false);
    }
  };

  const handleDesktopDeny = () => {
    setMcpOauthCallback(null);
  };

  const handleDisconnect = async (clientId: string) => {
    const appName = AVAILABLE_APPS.find((a) => a.id === clientId)?.name || clientId;
    if (!window.confirm(`Are you sure you want to disconnect ${appName}?`)) {
      return;
    }

    try {
      setDisconnecting(clientId);
      await api.delete(`/ai-integrations/${clientId}`);
      setConnections(connections.filter((c) => c.clientId !== clientId));
      setError(null);
    } catch (err) {
      console.error('Failed to disconnect', err);
      setError(`Failed to disconnect ${appName}`);
    } finally {
      setDisconnecting(null);
    }
  };

  const isConnected = (clientId: string) =>
    connections.some((c) => c.clientId === clientId && c.status === 'connected');

  const getConnectionInfo = (clientId: string) =>
    connections.find((c) => c.clientId === clientId);

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

        {/* Claude Desktop Connection Request Banner */}
        {mcpOauthCallback && (
          <div className="mb-6 p-5 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <Monitor className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-blue-900 mb-1">
                  Claude Desktop wants to connect
                </h3>
                <p className="text-sm text-blue-700 mb-4">
                  Claude Desktop (mcp-remote) is requesting access to your RealtyFlow CRM data.
                  Click <strong>Approve</strong> to grant access. You will be taken to a confirmation
                  page where you can review and approve the permissions.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDesktopApprove}
                    disabled={desktopApproving}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {desktopApproving ? 'Redirecting…' : 'Approve Claude Desktop'}
                  </button>
                  <button
                    onClick={handleDesktopDeny}
                    className="px-4 py-2 bg-white border border-blue-200 text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <button
                onClick={handleDesktopDeny}
                className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <p className="text-green-700 text-sm">{successMessage}</p>
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
                          <span>
                            Connected on{' '}
                            {new Date(connectionInfo.connectedAt!).toLocaleDateString()}
                          </span>
                        </div>
                        {connectionInfo.lastUsedAt && (
                          <div className="text-sm text-slate-600">
                            Last used:{' '}
                            {new Date(connectionInfo.lastUsedAt).toLocaleDateString()}
                          </div>
                        )}
                        {connectionInfo.scopes && connectionInfo.scopes.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {connectionInfo.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={() => handleConnect(app.id)}
                          disabled={connecting === app.id}
                          className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                          {connecting === app.id ? 'Reconnecting…' : 'Reconnect'}
                        </button>
                        <button
                          onClick={() => handleDisconnect(app.id)}
                          disabled={disconnecting === app.id}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          {disconnecting === app.id ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">
                        Allow {app.name} to read and manage your RealtyFlow CRM data — leads,
                        properties, meetings, and more.
                      </p>

                      <button
                        onClick={() => handleConnect(app.id)}
                        disabled={connecting === app.id}
                        className={`w-full py-3 px-6 bg-gradient-to-r ${app.color} text-white font-semibold rounded-lg hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity`}
                      >
                        {connecting === app.id ? 'Connecting…' : `Connect ${app.name}`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Claude Desktop Setup Instructions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Monitor className="w-6 h-6 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-900">Claude Desktop Setup</h2>
          </div>
          {MCP_SERVER_URL ? (
            <>
              <p className="text-sm text-slate-600 mb-4">
                To connect Claude Desktop (the native app), add the following to your{' '}
                <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 text-xs font-mono">
                  claude_desktop_config.json
                </code>
                :
              </p>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre">
{JSON.stringify(
  { mcpServers: { realtyflow: { command: 'npx', args: ['mcp-remote', MCP_SERVER_URL] } } },
  null,
  2,
)}
              </pre>
              <p className="text-xs text-slate-500 mt-3">
                After saving, restart Claude Desktop. A browser window will open — log in to RealtyFlow
                if prompted, then approve the connection on this page.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              The Claude Desktop connector isn&apos;t available on this deployment yet.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
