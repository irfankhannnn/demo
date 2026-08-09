/**
 * Shared constants for the Call Intelligence pipeline.
 *
 * The pipeline turns an uploaded call recording into a transcript, an AI
 * analysis and a set of proposed CRM actions that an agency owner reviews
 * before anything is written to the CRM.
 */

/** Processing states. Ordered roughly by pipeline progression. */
export const RECORDING_STATUS = {
  PENDING_UPLOAD: 'PENDING_UPLOAD',
  UPLOADED: 'UPLOADED',
  QUEUED: 'QUEUED',
  TRANSCRIBING: 'TRANSCRIBING',
  TRANSCRIBED: 'TRANSCRIBED',
  ANALYZING: 'ANALYZING',
  ANALYZED: 'ANALYZED',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

/** Pipeline stages used for per-stage idempotency and retry accounting. */
export const PIPELINE_STAGE = {
  TRANSCRIPTION: 'TRANSCRIPTION',
  ANALYSIS: 'ANALYSIS',
  CRM_UPDATE: 'CRM_UPDATE',
};

/** Status values from which a stage may still run (guards duplicate SQS deliveries). */
export const STAGE_ENTRY_STATUSES = {
  [PIPELINE_STAGE.TRANSCRIPTION]: [
    RECORDING_STATUS.UPLOADED,
    RECORDING_STATUS.QUEUED,
    RECORDING_STATUS.TRANSCRIBING,
    RECORDING_STATUS.FAILED,
  ],
  [PIPELINE_STAGE.ANALYSIS]: [
    RECORDING_STATUS.TRANSCRIBED,
    RECORDING_STATUS.ANALYZING,
    RECORDING_STATUS.FAILED,
  ],
};

/** Terminal states — the pipeline will not re-enter them automatically. */
export const TERMINAL_STATUSES = [
  RECORDING_STATUS.COMPLETED,
  RECORDING_STATUS.AWAITING_APPROVAL,
  RECORDING_STATUS.ANALYZED,
];

/** Proposed action lifecycle. */
export const ACTION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  APPLIED: 'applied',
  FAILED: 'failed',
};

/** Entity types a recording can be linked to. */
export const ENTITY_TYPE = {
  LEAD: 'lead',
  TENANT: 'tenant',
  OWNER: 'owner',
  BUYER: 'buyer',
  CONTACT: 'contact',
  UNMATCHED: 'unmatched',
};

/**
 * Tools the analysis agent is allowed to propose.
 *
 * This is intentionally a small subset of the 65 CRM tools: the LLM can never
 * propose a delete/destructive tool because it is not in this list, and the
 * executor rejects anything absent here before it reaches `invokeSkill`.
 */
export const PROPOSABLE_TOOLS = [
  'create_lead_note',
  'create_tenant_note',
  'create_owner_note',
  'create_buyer_note',
  'create_contact_note',
  'update_lead',
  'update_tenant',
  'update_owner',
  'update_buyer',
  'update_contact',
  'create_lead',
  'create_meeting',
];

/**
 * Tools that may be applied automatically without owner approval.
 *
 * Only note creation qualifies: notes are additive, reversible in practice and
 * the agency owner explicitly asked for every call to land as a note. Every
 * other tool (status changes, lead creation, meetings/site visits, maintenance
 * work) requires an explicit approval click.
 */
export const AUTO_APPLICABLE_TOOLS = [
  'create_lead_note',
  'create_tenant_note',
  'create_owner_note',
  'create_buyer_note',
  'create_contact_note',
];

/** Note tool per entity type — used to attach the call summary to the right record. */
export const NOTE_TOOL_BY_ENTITY = {
  [ENTITY_TYPE.LEAD]: 'create_lead_note',
  [ENTITY_TYPE.TENANT]: 'create_tenant_note',
  [ENTITY_TYPE.OWNER]: 'create_owner_note',
  [ENTITY_TYPE.BUYER]: 'create_buyer_note',
  [ENTITY_TYPE.CONTACT]: 'create_contact_note',
};

/** Id argument name per entity type, matching the CRM tool schemas. */
export const ID_ARG_BY_ENTITY = {
  [ENTITY_TYPE.LEAD]: 'leadId',
  [ENTITY_TYPE.TENANT]: 'tenantRecordId',
  [ENTITY_TYPE.OWNER]: 'ownerId',
  [ENTITY_TYPE.BUYER]: 'buyerId',
  [ENTITY_TYPE.CONTACT]: 'contactId',
};

/** Discussion topics the analysis prompt is asked to classify against. */
export const DISCUSSION_TOPICS = [
  'site_visit',
  'budget',
  'property_requirement',
  'rent',
  'rent_negotiation',
  'maintenance',
  'painting_whitewash',
  'repairs',
  'khata_payment',
  'documentation',
  'possession',
  'loan_finance',
  'brokerage',
  'complaint',
  'follow_up',
  'other',
];

/**
 * Topics that describe physical work on a property (painting, whitewashing,
 * repairs). When present, the analyzer proposes a maintenance visit that the
 * agency owner must approve before it is added to the calendar.
 */
export const MAINTENANCE_TOPICS = ['maintenance', 'painting_whitewash', 'repairs'];

/** Accepted audio MIME types for upload. */
export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/ogg',
  'audio/opus',
  'audio/flac',
  'audio/amr',
  'video/mp4',
];

/** Extension → Amazon Transcribe media format. */
export const MEDIA_FORMAT_BY_EXTENSION = {
  '.mp3': 'mp3',
  '.mp4': 'mp4',
  '.m4a': 'mp4',
  '.wav': 'wav',
  '.flac': 'flac',
  '.ogg': 'ogg',
  '.opus': 'ogg',
  '.webm': 'webm',
  '.amr': 'amr',
  '.aac': 'mp4',
};

export const DEFAULT_MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB
