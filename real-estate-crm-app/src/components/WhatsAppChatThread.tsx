import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Check, CheckCheck, Clock, AlertCircle, Send } from 'lucide-react';
import type { WhatsAppMessage, WhatsAppToolCall } from '../types/whatsapp';

interface WhatsAppChatThreadProps {
  messages: WhatsAppMessage[];
  contactPhone: string;
  isLoading: boolean;
  onSendMessage?: (text: string) => Promise<void>;
  sending?: boolean;
}

function formatPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateSeparator(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function StatusIcon({ status }: { status?: WhatsAppMessage['status'] }) {
  if (status === 'read') {
    return <CheckCheck className="h-3 w-3 text-blue-200" />;
  }
  if (status === 'delivered' || status === 'sent') {
    return <CheckCheck className="h-3 w-3 text-slate-300" />;
  }
  if (status === 'failed') {
    return <AlertCircle className="h-3 w-3 text-red-300" />;
  }
  if (status === 'pending') {
    return <Clock className="h-3 w-3 text-slate-300" />;
  }
  return <Check className="h-3 w-3 text-slate-300" />;
}

function ToolCallCard({ toolCall }: { toolCall: WhatsAppToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const summary = toolCall.result || toolCall.tool || 'Tool call';
  const hasDetails = !!(toolCall.parameters && Object.keys(toolCall.parameters).length > 0);

  return (
    <div className="mt-1.5 rounded-lg bg-black/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-2.5 py-1.5 flex items-center justify-between text-left"
      >
        <span className="text-xs font-medium text-white/90">{summary}</span>
        {hasDetails && (
          <span className="text-white/70">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        )}
      </button>
      {expanded && hasDetails && (
        <div className="px-2.5 pb-2 pt-0 text-xs text-white/80 border-t border-white/10">
          <pre className="whitespace-pre-wrap break-words font-mono">
            {JSON.stringify(toolCall.parameters, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function WhatsAppChatThread({ messages, contactPhone, isLoading, onSendMessage, sending }: WhatsAppChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !onSendMessage || sending) return;
    const text = draft.trim();
    setDraft('');
    try {
      await onSendMessage(text);
    } catch {
      setDraft(text);
    } finally {
      inputRef.current?.focus();
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-slate-300 border-t-brand rounded-full mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading messages...</p>
        </div>
      </div>
    );
  }

  const sendForm = (
    <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          disabled={sending || !onSendMessage}
          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim() || !onSendMessage}
          className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-brand text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          {sending ? (
            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </form>
  );

  if (sortedMessages.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 px-4 text-center">
          <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center mb-4">
            <Bot className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-lg font-medium text-slate-600 mb-1">No messages yet</p>
          <p className="text-sm">Start a conversation with {formatPhone(contactPhone)}</p>
        </div>
        {sendForm}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sortedMessages.map((message, index) => {
          const showDateSeparator =
            index === 0 || !isSameDay(sortedMessages[index - 1].createdAt, message.createdAt);
          const isOutbound = message.direction === 'outbound' || message.fromMe;
          const isAi = message.aiGenerated;

          return (
            <div key={message.messageId}>
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <span className="px-3 py-1 bg-slate-200 text-slate-600 text-xs rounded-full font-medium">
                    {formatDateSeparator(message.createdAt)}
                  </span>
                </div>
              )}

              <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] min-w-[120px] rounded-2xl px-4 py-2.5 shadow-sm ${
                  isOutbound
                    ? 'bg-brand text-white rounded-br-none'
                    : 'bg-white text-slate-900 rounded-bl-none border border-slate-200'
                }`}>
                  {isAi && isOutbound && (
                    <div className="flex items-center gap-1 mb-1 text-white/80">
                      <Bot className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wide">AI</span>
                    </div>
                  )}

                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>

                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.toolCalls.map((toolCall, toolIndex) => (
                        <ToolCallCard key={toolIndex} toolCall={toolCall} />
                      ))}
                    </div>
                  )}

                  <div className={`flex items-center justify-end gap-1.5 mt-1.5 ${
                    isOutbound ? 'text-white/70' : 'text-slate-400'
                  }`}>
                    <span className="text-[10px]">{formatMessageTime(message.createdAt)}</span>
                    {isOutbound && <StatusIcon status={message.status} />}
                  </div>

                  {typeof message.creditsCharged === 'number' && message.creditsCharged > 0 && (
                    <div className={`text-[10px] mt-1 ${isOutbound ? 'text-white/60' : 'text-slate-400'}`}>
                      {message.creditsCharged} credit{message.creditsCharged !== 1 ? 's' : ''} used
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {sendForm}
    </div>
  );
}
