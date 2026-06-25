import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Wifi, WifiOff, RefreshCw, ChevronLeft } from 'lucide-react';
import { api } from '../../services/api';
import type { ConversationSummary, WhatsAppMessage } from '../../types/whatsapp';
import WhatsAppConversationList, { formatPhone as formatWhatsAppPhone, avatarInitials as whatsAppAvatarInitials } from '../../components/WhatsAppConversationList';
import WhatsAppChatThread from '../../components/WhatsAppChatThread';
import Toast from '../../components/Toast';

const REFRESH_INTERVAL_MS = 5000;

function formatPhone(phone: string): string {
  return formatWhatsAppPhone(phone);
}

function avatarInitials(phone: string): string {
  return whatsAppAvatarInitials(phone);
}

export default function WhatsAppInbox() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'error') => {
    setToast({ message, type });
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getWhatsAppConversations();
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading WhatsApp conversations:', error);
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoadingConversations(false);
    }
  }, [navigate]);

  const loadMessages = useCallback(async (phone: string) => {
    try {
      setLoadingMessages(true);
      const [conversation] = await Promise.all([
        api.getWhatsAppConversation(phone),
        api.markWhatsAppConversationRead(phone).catch((err) => {
          console.error('Failed to mark conversation as read:', err);
        }),
      ]);
      setMessages(conversation.messages || []);

      // Update unread count in conversation list for this contact
      setConversations((prev) =>
        prev.map((c) =>
          c.contactPhone === phone ? { ...c, unreadCount: 0 } : c
        )
      );
    } catch (error) {
      console.error('Error loading WhatsApp conversation:', error);
      setMessages([]);
      showToast('Failed to load messages', 'error');
      if (error instanceof Error && error.message.includes('token')) {
        navigate('/login');
      }
    } finally {
      setLoadingMessages(false);
    }
  }, [navigate, showToast]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const resolvePhone = async () => {
      try {
        const config = await api.getAiEmployeeConfig();
        return config.connectedWhatsAppPhone || null;
      } catch {
        return null;
      }
    };

    const checkStatus = async (phone: string) => {
      if (cancelled) return;
      const result = await api.getWhatsAppConnectionStatus(phone);
      if (cancelled) return;
      setConnectionStatus(result.connected ? 'connected' : 'disconnected');
    };

    const start = async () => {
      const phone = await resolvePhone();
      if (!phone) {
        setConnectionStatus('disconnected');
        return;
      }
      await checkStatus(phone);
      interval = setInterval(() => checkStatus(phone), REFRESH_INTERVAL_MS);
    };

    start();

    // Pause polling when tab is hidden to reduce unnecessary API calls
    const handleVisibility = () => {
      if (document.hidden && interval) {
        clearInterval(interval);
        interval = null;
      } else if (!document.hidden && !interval && !cancelled) {
        start();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleSelect = useCallback((phone: string) => {
    setSelectedPhone(phone);
    setMobileView('thread');
    loadMessages(phone);
  }, [loadMessages]);

  const handleRefresh = useCallback(() => {
    loadConversations();
    if (selectedPhone) {
      loadMessages(selectedPhone);
    }
  }, [loadConversations, loadMessages, selectedPhone]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!selectedPhone) return;
    try {
      setSendingMessage(true);
      await api.sendWhatsAppMessage(selectedPhone, text);
      showToast('Message sent', 'success');
      await loadMessages(selectedPhone);
      await loadConversations();
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      showToast(error instanceof Error ? error.message : 'Failed to send message', 'error');
      throw error;
    } finally {
      setSendingMessage(false);
    }
  }, [selectedPhone, loadMessages, loadConversations, showToast]);

  const selectedConversation = conversations.find((c) => c.contactPhone === selectedPhone);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/crm"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to CRM
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-[#2563EB]" />
              <h1 className="text-xl font-bold text-slate-900">WhatsApp Inbox</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-sm">
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-slate-700">Connected</span>
                </>
              ) : connectionStatus === 'disconnected' ? (
                <>
                  <WifiOff className="h-4 w-4 text-red-500" />
                  <span className="text-slate-700">Disconnected</span>
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-500">Checking...</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main two-pane layout */}
      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* Left pane: conversation list */}
        <div className={`w-full sm:w-80 md:w-96 flex-shrink-0 h-full ${mobileView === 'thread' ? 'hidden sm:block' : 'block'}`}>
          <WhatsAppConversationList
            conversations={conversations}
            selectedPhone={selectedPhone}
            onSelect={handleSelect}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Right pane: chat thread */}
        <div className={`flex-1 flex-col h-full border-r border-slate-200 bg-white ${mobileView === 'thread' ? 'flex sm:flex' : 'hidden sm:flex'}`}>
          {selectedPhone ? (
            <>
              {/* Thread header */}
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                <button
                  onClick={() => setMobileView('list')}
                  className="sm:hidden inline-flex items-center justify-center p-1 -ml-2 text-slate-600 hover:text-slate-900"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="h-9 w-9 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-sm font-semibold">
                  {avatarInitials(selectedPhone)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">
                    {formatPhone(selectedPhone)}
                  </p>
                  {selectedConversation && selectedConversation.unreadCount > 0 && (
                    <p className="text-xs text-slate-500">
                      {selectedConversation.unreadCount} unread message{selectedConversation.unreadCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
              <WhatsAppChatThread
                messages={messages}
                contactPhone={selectedPhone}
                isLoading={loadingMessages}
                onSendMessage={handleSendMessage}
                sending={sendingMessage}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 px-4 text-center">
              <div className="h-20 w-20 rounded-full bg-slate-200 flex items-center justify-center mb-4">
                <MessageSquare className="h-10 w-10 text-slate-400" />
              </div>
              <p className="text-lg font-medium text-slate-600 mb-1">Select a conversation</p>
              <p className="text-sm">Choose a chat from the list to view messages</p>
            </div>
          )}
        </div>
      </div>

      {loadingConversations && conversations.length === 0 && (
        <div className="fixed inset-0 bg-white/60 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-[#2563EB] rounded-full mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading conversations...</p>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
