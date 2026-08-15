import { Search, MessageSquare } from 'lucide-react';
import type { ConversationSummary } from '../types/whatsapp';

interface WhatsAppConversationListProps {
  conversations: ConversationSummary[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function classifyWhatsAppId(phone: string): { type: 'phone' | 'lid' | 'group' | 'unknown'; digits: string } {
  const digits = String(phone || '').replace(/@.*$/, '').replace(/:\d+$/, '').replace(/\D/g, '');
  if (!digits) return { type: 'unknown', digits: '' };
  if (phone.includes('@g.us') || (digits.length >= 18 && digits.startsWith('120'))) return { type: 'group', digits };
  if (phone.includes('@lid') || (digits.length === 14 && digits.startsWith('100'))) return { type: 'lid', digits };
  if (digits.length >= 10) return { type: 'phone', digits };
  return { type: 'unknown', digits };
}

export function formatPhone(phone: string): string {
  if (!phone) return '';
  const { type, digits } = classifyWhatsAppId(phone);
  if (type === 'group') return 'Group';
  if (type === 'lid') return 'WhatsApp User';
  if (type === 'unknown') return phone;
  // E.164 Indian number formatting: +91 98765 43210
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return digits;
}

function conversationTimestamp(conversation: ConversationSummary): string {
  return conversation.lastMessageAt || conversation.updatedAt || conversation.lastReadAt || '';
}

export function avatarInitials(phone: string): string {
  const { type, digits } = classifyWhatsAppId(phone);
  if (type === 'group') return 'Gr';
  if (type === 'lid') return 'WA';
  if (!digits) return '#';
  if (digits.length >= 10) {
    return digits.slice(-2);
  }
  return digits.slice(0, 2);
}

function relativeTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function WhatsAppConversationList({
  conversations,
  selectedPhone,
  onSelect,
  searchQuery,
  onSearchChange,
}: WhatsAppConversationListProps) {
  const filteredConversations = conversations.filter((conversation) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const phone = conversation.contactPhone?.toLowerCase() || '';
    const displayPhone = formatPhone(conversation.contactPhone).toLowerCase();
    const message = conversation.lastMessage?.toLowerCase() || '';
    return phone.includes(query) || displayPhone.includes(query) || message.includes(query);
  });

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 px-4 text-center">
            <MessageSquare className="h-8 w-8 mb-2" />
            <p className="text-sm">No conversations found</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filteredConversations.map((conversation) => {
              const isSelected = selectedPhone === conversation.contactPhone;
              return (
                <li key={conversation.contactPhone}>
                  <button
                    onClick={() => onSelect(conversation.contactPhone)}
                    className={`w-full px-4 py-3 flex items-start gap-3 transition-colors text-left ${
                      isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                        isSelected ? 'bg-brand text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {avatarInitials(conversation.contactPhone)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`font-medium truncate text-sm ${
                          isSelected ? 'text-brand' : 'text-slate-900'
                        }`}>
                          {formatPhone(conversation.contactPhone)}
                        </span>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {relativeTime(conversationTimestamp(conversation))}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate flex-1 ${
                          conversation.unreadCount > 0 ? 'text-slate-900 font-medium' : 'text-slate-500'
                        }`}>
                          {conversation.lastMessage?.slice(0, 60) || 'No messages yet'}
                          {conversation.lastMessage && conversation.lastMessage.length > 60 ? '...' : ''}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span className="flex-shrink-0 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 rounded-full bg-brand text-white text-xs font-medium">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
