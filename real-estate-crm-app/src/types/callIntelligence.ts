/** Types for the Call Intelligence feature (call recording → AI analysis → CRM actions). */

export type CallRecordingStatus =
  | 'PENDING_UPLOAD'
  | 'UPLOADED'
  | 'QUEUED'
  | 'TRANSCRIBING'
  | 'TRANSCRIBED'
  | 'ANALYZING'
  | 'ANALYZED'
  | 'AWAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED';

export type CallActionStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';

export type CallEntityType = 'lead' | 'tenant' | 'owner' | 'buyer' | 'contact' | 'unmatched';

export interface CallMatchCandidate {
  entityType: CallEntityType;
  entityId: string;
  name: string;
  phone: string;
  status?: string;
  updatedAt?: string;
}

export interface CallProposedAction {
  actionId: string;
  tool: string;
  title: string;
  description: string;
  reason: string;
  arguments: Record<string, unknown>;
  requiresApproval: boolean;
  status: CallActionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  executedAt: string | null;
  executionError: string | null;
  rejectionReason: string | null;
}

export interface CallExtractedData {
  language?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  intentLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  customer?: { name: string | null; phone: string | null };
  counterpartyRole?: string;
  requirements?: {
    propertyType: string | null;
    bhk: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
    locations: string[];
    purpose: string | null;
    furnishing: string | null;
    timeline: string | null;
  };
  objections?: string[];
  questions?: string[];
  siteVisit?: {
    requested: boolean;
    preferredDate: string | null;
    preferredTime: string | null;
    propertyOrProject: string | null;
  };
  maintenance?: {
    required: boolean;
    workType: string | null;
    description: string | null;
    preferredDate: string | null;
    estimatedCost: number | null;
  };
  payment?: {
    discussed: boolean;
    direction: string | null;
    amount: number | null;
    dueDate: string | null;
    description: string | null;
  };
  followUp?: { required: boolean; date: string | null; time: string | null; reason: string | null };
  suggestedLeadStatus?: string | null;
  isNewLead?: boolean;
  confidence?: number | null;
}

export interface CallRecordingSummary {
  recordingId: string;
  filename: string;
  status: CallRecordingStatus;
  phone: string | null;
  phoneConfidence: string | null;
  matchedEntityType: CallEntityType;
  matchedEntityId: string | null;
  matchedEntityName: string;
  summary: string;
  topics: string[];
  audioDurationSeconds: number | null;
  asrLanguage: string | null;
  pendingActions: number;
  appliedActions: number;
  /** CRM writes that were attempted and failed. A recording can be COMPLETED with these > 0. */
  failedActions: number;
  failureStage: string | null;
  failureReason: string | null;
  possibleDuplicateOf: string | null;
  callDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallRecordingDetail extends CallRecordingSummary {
  keyPoints: string[];
  extracted: CallExtractedData | null;
  financialHints: string[];
  transcriptPreview: string;
  hasTranscript: boolean;
  matchCandidates: CallMatchCandidate[];
  matchSource: string;
  proposedActions: CallProposedAction[];
  asrProvider: string | null;
  analysisModel: string | null;
  analysisPromptVersion: string | null;
  sizeBytes: number | null;
  uploadedBy: string;
}

export interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface CallTranscript {
  recordingId: string;
  provider: string;
  language: string;
  durationSeconds: number;
  transcript: string;
  segments: TranscriptSegment[];
  confidence: number | null;
}

export interface UploadUrlResponse {
  recordingId: string;
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
  phone: string | null;
  phoneConfidence: string | null;
  match: CallMatchCandidate | null;
  matchCandidates: CallMatchCandidate[];
  possibleDuplicateOf: string | null;
  recording: CallRecordingSummary;
}

/** Statuses where the pipeline is still working and the UI should keep polling. */
export const IN_FLIGHT_STATUSES: CallRecordingStatus[] = [
  'UPLOADED',
  'QUEUED',
  'TRANSCRIBING',
  'TRANSCRIBED',
  'ANALYZING',
];

export const STATUS_LABELS: Record<CallRecordingStatus, string> = {
  PENDING_UPLOAD: 'Waiting for upload',
  UPLOADED: 'Uploaded',
  QUEUED: 'Queued',
  TRANSCRIBING: 'Transcribing',
  TRANSCRIBED: 'Transcribed',
  ANALYZING: 'Analysing',
  ANALYZED: 'Analysed',
  AWAITING_APPROVAL: 'Needs your approval',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};
