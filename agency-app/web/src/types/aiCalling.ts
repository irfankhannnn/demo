/**
 * Types for the AI Calling feature (outbound AI voice calls to leads).
 *
 * The browser never talks to ai-calling-service directly — see
 * `docs/agency-app/api/DISABLED_FEATURES.md`. Every shape here is what the CRM server
 * returns from its `/crm/ai-calling/*` proxy, which mirrors the microservice's
 * own payloads. Keeping the names identical to the service's
 * `src/config/constants.js` means a field added there needs one change here,
 * not a translation layer in between.
 */

/** Mirrors CALL_STATUS in agency-app/ai-calling/src/config/constants.js. */
export type AICallStatus =
  | 'initiated'
  | 'ringing'
  | 'connected'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy'
  | 'cancelled';

/** Mirrors CALL_PURPOSE. Only the two the CRM actually starts are offered in the UI. */
export type AICallPurpose =
  | 'lead_followup'
  | 'lead_qualification'
  | 'property_inquiry'
  | 'site_visit_reminder'
  | 'site_visit_scheduling'
  | 'general_faq'
  | 'payment_reminder';

/**
 * Mirrors QUALIFICATION_STATUS. `failed` is deliberately distinct from
 * `not_applicable`: a qualification call that produced no verdict is a data
 * quality problem worth surfacing, not the same as a call never meant to
 * qualify anyone.
 */
export type AIQualificationStatus =
  | 'not_applicable'
  | 'pending'
  | 'succeeded'
  | 'failed';

export type AICallTemperature = 'HOT' | 'WARM' | 'COLD';

export interface AICallSession {
  callSessionId: string;
  leadId: string | null;
  leadName: string | null;
  leadPhone: string | null;
  callPurpose: AICallPurpose;
  status: AICallStatus;
  /** Seconds. Absent until the call reaches a terminal state. */
  duration?: number | null;
  outcome?: string | null;
  transcriptSummary?: string | null;
  qualificationStatus?: AIQualificationStatus | null;
  temperature?: AICallTemperature | null;
  scoreReasons?: string | null;
  recordingUrl?: string | null;
  conversationId?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AICallTranscriptEntry {
  speaker: 'customer' | 'ai' | string;
  text: string;
  timestamp?: string;
  /** Which server tool, if any, produced this turn's data. */
  dataSource?: string | null;
}

export interface AICallMetrics {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  averageDuration: number;
  totalDuration?: number;
  qualifiedLeads?: number;
}

/** Response of GET /crm/ai-calling/config/agent. */
export interface AIAgentConfig {
  configured: boolean;
  message?: string;
  agencyName?: string;
  /** Optional per-tenant override of the shared ElevenLabs agent. */
  agentId?: string | null;
  /** Optional per-tenant override of the imported Exotel number. */
  agentPhoneNumberId?: string | null;
  agentVoice?: string | null;
  agentPersonality?: string | null;
  greeting?: string | null;
  fallbackMessage?: string | null;
  /**
   * Legacy. The number now lives in ElevenLabs as `agentPhoneNumberId`; the
   * service no longer requires this, but the endpoint still accepts and
   * returns it so existing rows round-trip unchanged.
   */
  exotelNumber?: string | null;
  maxCallDuration?: number | null;
  enableRecording?: boolean | null;
  escalationPhone?: string | null;
  updatedAt?: string;
}

/** Body of PUT /crm/ai-calling/config/agent. `agencyName` is the only required field. */
export interface SaveAIAgentConfigData {
  agencyName: string;
  agentId?: string;
  agentPhoneNumberId?: string;
  agentVoice?: string;
  agentPersonality?: string;
  greeting?: string;
  fallbackMessage?: string;
  exotelNumber?: string;
  maxCallDuration?: number;
  enableRecording?: boolean;
  escalationPhone?: string;
}

export interface StartAICallData {
  leadId: string;
  callPurpose: AICallPurpose;
}

export interface StartAICallResult {
  callSessionId: string;
  status: AICallStatus;
}

/** Statuses where the call is still live and the list should keep polling. */
export const AI_CALL_IN_FLIGHT_STATUSES: AICallStatus[] = [
  'initiated',
  'ringing',
  'connected',
  'in_progress',
];

export const AI_CALL_STATUS_LABELS: Record<AICallStatus, string> = {
  initiated: 'Starting',
  ringing: 'Ringing',
  connected: 'Connected',
  in_progress: 'In progress',
  completed: 'Completed',
  failed: 'Failed',
  no_answer: 'No answer',
  busy: 'Busy',
  cancelled: 'Cancelled',
};

export const AI_CALL_PURPOSE_LABELS: Record<string, string> = {
  lead_followup: 'Follow-up',
  lead_qualification: 'Qualification',
  property_inquiry: 'Property enquiry',
  site_visit_reminder: 'Site visit reminder',
  site_visit_scheduling: 'Site visit scheduling',
  general_faq: 'General questions',
  payment_reminder: 'Payment reminder',
};

/** The two purposes a user can start from the CRM. The rest are automation-only. */
export const AI_CALL_STARTABLE_PURPOSES: { value: AICallPurpose; label: string; description: string }[] = [
  {
    value: 'lead_qualification',
    label: 'Qualify this lead',
    description: 'Short call, up to 3 minutes. Scores the lead Hot, Warm or Cold.',
  },
  {
    value: 'lead_followup',
    label: 'Follow up',
    description: 'Full conversation. Answers questions, finds matching properties, books a site visit.',
  },
];
