// AI Calling Service Constants

export const CALL_STATUS = {
  INITIATED: 'initiated',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  NO_ANSWER: 'no_answer',
  BUSY: 'busy',
  CANCELLED: 'cancelled',
};

export const CALL_PURPOSE = {
  LEAD_FOLLOWUP: 'lead_followup',
  PROPERTY_INQUIRY: 'property_inquiry',
  SITE_VISIT_REMINDER: 'site_visit_reminder',
  SITE_VISIT_SCHEDULING: 'site_visit_scheduling',
  GENERAL_FAQ: 'general_faq',
  PAYMENT_REMINDER: 'payment_reminder',
};

export const INTENT_TYPES = {
  PROPERTY_AVAILABILITY: 'PROPERTY_AVAILABILITY',
  PROPERTY_DETAILS: 'PROPERTY_DETAILS',
  SCHEDULE_SITE_VISIT: 'SCHEDULE_SITE_VISIT',
  FAQ_POLICY: 'FAQ_POLICY',
  AGENCY_INFO: 'AGENCY_INFO',
  PRICING_INFO: 'PRICING_INFO',
  SMALL_TALK: 'SMALL_TALK',
  HANDOFF_HUMAN: 'HANDOFF_HUMAN',
  CALL_END: 'CALL_END',
  UNKNOWN: 'UNKNOWN',
};

export const DATA_SOURCE = {
  CRM_API: 'CRM_API',
  VECTOR_DB: 'VECTOR_DB',
  HYBRID: 'HYBRID',
  STATIC: 'STATIC',
  NONE: 'NONE',
};

export const INTENT_CONFIG = {
  [INTENT_TYPES.PROPERTY_AVAILABILITY]: {
    source: DATA_SOURCE.CRM_API,
    endpoint: '/api/internal/properties/available',
    requiresParams: ['propertyType', 'location'],
  },
  [INTENT_TYPES.PROPERTY_DETAILS]: {
    source: DATA_SOURCE.CRM_API,
    endpoint: '/api/internal/properties/:propertyId/details',
    requiresParams: ['propertyId'],
  },
  [INTENT_TYPES.SCHEDULE_SITE_VISIT]: {
    source: DATA_SOURCE.CRM_API,
    endpoint: '/api/internal/site-visits',
    method: 'POST',
    requiresParams: ['leadId', 'propertyId', 'dateTime'],
  },
  [INTENT_TYPES.FAQ_POLICY]: {
    source: DATA_SOURCE.VECTOR_DB,
    category: 'faq',
  },
  [INTENT_TYPES.AGENCY_INFO]: {
    source: DATA_SOURCE.VECTOR_DB,
    category: 'agency_info',
  },
  [INTENT_TYPES.PRICING_INFO]: {
    source: DATA_SOURCE.HYBRID,
    crmEndpoint: '/api/internal/properties/pricing',
    vectorCategory: 'pricing_policies',
  },
  [INTENT_TYPES.SMALL_TALK]: {
    source: DATA_SOURCE.NONE,
  },
  [INTENT_TYPES.HANDOFF_HUMAN]: {
    source: DATA_SOURCE.NONE,
    action: 'escalate',
  },
  [INTENT_TYPES.CALL_END]: {
    source: DATA_SOURCE.NONE,
    action: 'terminate',
  },
};

export const KNOWLEDGE_CATEGORIES = {
  FAQ: 'faq',
  POLICIES: 'policies',
  AGENCY_INFO: 'agency_info',
  PRICING: 'pricing',
};

export const DOCUMENT_STATUS = {
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  INDEXED: 'indexed',
  FAILED: 'failed',
};

export const MAX_CALL_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const CALL_TIMEOUT_MS = 30 * 1000; // 30 seconds to answer
export const API_TIMEOUT_MS = 5000; // 5 seconds for API calls
