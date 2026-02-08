// AI Calling Module Types

export type CallStatus = 
  | 'initiated'
  | 'ringing'
  | 'connected'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy'
  | 'cancelled';

export type CallPurpose =
  | 'lead_followup'
  | 'property_inquiry'
  | 'site_visit_reminder'
  | 'site_visit_scheduling'
  | 'general_faq'
  | 'payment_reminder';

export type IntentType =
  | 'PROPERTY_AVAILABILITY'
  | 'PROPERTY_DETAILS'
  | 'SCHEDULE_SITE_VISIT'
  | 'FAQ_POLICY'
  | 'AGENCY_INFO'
  | 'PRICING_INFO'
  | 'SMALL_TALK'
  | 'HANDOFF_HUMAN'
  | 'CALL_END'
  | 'UNKNOWN';

export type KnowledgeCategory = 'faq' | 'policies' | 'agency_info' | 'pricing';

export type DocumentStatus = 'uploading' | 'processing' | 'indexed' | 'failed';

export interface CallSession {
  callSessionId: string;
  tenantId: string;
  leadId?: string;
  leadName?: string;
  leadPhone: string;
  callPurpose: CallPurpose;
  status: CallStatus;
  exotelCallSid?: string;
  elevenLabsSessionId?: string;
  startedAt?: string;
  endedAt?: string;
  duration: number;
  transcriptSummary?: string;
  intentsDetected: IntentType[];
  actionsPerformed: CallAction[];
  outcome?: string;
  recordingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallAction {
  action: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface TranscriptEntry {
  speaker: 'customer' | 'ai' | 'system';
  text: string;
  timestamp: string;
  intent?: IntentType;
  dataSource?: string;
}

export interface StartCallRequest {
  leadId?: string;
  leadName?: string;
  leadPhone: string;
  callPurpose?: CallPurpose;
}

export interface StartCallResponse {
  callSessionId: string;
  status: CallStatus;
  exotelCallSid?: string;
}

export interface CallStatusResponse {
  callSessionId: string;
  status: CallStatus;
  duration: number;
  startedAt?: string;
  endedAt?: string;
  intentsDetected: IntentType[];
  actionsPerformed: CallAction[];
}

export interface CallMetrics {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  noAnswerCalls: number;
  avgDuration: number;
  totalDuration: number;
  byStatus: Record<CallStatus, number>;
  byPurpose: Record<CallPurpose, number>;
  byOutcome: Record<string, number>;
}

export interface KnowledgeDocument {
  documentId: string;
  tenantId: string;
  name: string;
  category: KnowledgeCategory;
  s3Key: string;
  fileType: string;
  fileSize: number;
  status: DocumentStatus;
  chunksCreated: number;
  error?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadUrlResponse {
  documentId: string;
  uploadUrl: string;
  s3Key: string;
}

export interface AgentConfig {
  configured: boolean;
  agencyName?: string;
  agentVoice?: string;
  agentPersonality?: string;
  greeting?: string;
  fallbackMessage?: string;
  exotelNumber?: string;
  maxCallDuration?: number;
  enableRecording?: boolean;
  escalationPhone?: string;
  updatedAt?: string;
}

export interface SaveAgentConfigRequest {
  agencyName: string;
  agentVoice?: string;
  agentPersonality?: string;
  greeting?: string;
  fallbackMessage?: string;
  exotelNumber: string;
  maxCallDuration?: number;
  enableRecording?: boolean;
  escalationPhone?: string;
}

export interface LeadForCall {
  leadId: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  leadType: string;
  budget?: number;
  propertyType?: string;
  preferredLocations?: string[];
}
