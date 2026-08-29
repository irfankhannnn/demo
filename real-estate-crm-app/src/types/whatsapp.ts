export interface WhatsAppToolCall {
  tool: string;
  result?: string;
  parameters?: Record<string, unknown>;
}

export interface WhatsAppMessage {
  messageId: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  text: string;
  fromMe: boolean;
  aiGenerated: boolean;
  toolCalls?: WhatsAppToolCall[];
  creditsCharged?: number;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: string;
}

export interface ConversationSummary {
  contactPhone: string;
  lastMessage: string;
  unreadCount: number;
  lastReadAt?: string;
  lastMessageAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WhatsAppConversation {
  contactPhone: string;
  messages: WhatsAppMessage[];
}
