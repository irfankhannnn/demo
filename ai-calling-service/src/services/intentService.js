// Intent Detection & Routing Service

import { INTENT_TYPES, INTENT_CONFIG, DATA_SOURCE } from '../config/constants.js';
import { logger } from '../utils/logger.js';
import * as crmApi from './crmApiService.js';
import * as ragService from './ragService.js';
import * as responseNormalizer from '../utils/responseNormalizer.js';

/**
 * Detect intent from transcript text
 * @param {string} transcript - The user's spoken text
 * @param {object} context - Conversation context
 * @returns {Promise<{intent: string, confidence: number, entities: object}>}
 */
export async function classifyIntent(transcript, context = {}) {
  const lowerTranscript = transcript.toLowerCase();
  
  // Intent detection patterns (ordered by priority)
  const intentPatterns = [
    {
      intent: INTENT_TYPES.HANDOFF_HUMAN,
      patterns: [
        /speak.*(?:to|with).*(?:agent|human|person|someone)/i,
        /connect.*(?:me|to).*(?:agent|human)/i,
        /(?:real|actual).*person/i,
        /transfer.*(?:call|me)/i,
      ],
      confidence: 0.95,
    },
    {
      intent: INTENT_TYPES.CALL_END,
      patterns: [
        /(?:good)?bye/i,
        /thank\s*(?:you|s).*(?:bye|that'?s?\s*all)/i,
        /no.*(?:more|else|other)/i,
        /that'?s?\s*(?:all|it|enough)/i,
        /i'?m?\s*done/i,
      ],
      confidence: 0.9,
    },
    {
      intent: INTENT_TYPES.SCHEDULE_SITE_VISIT,
      patterns: [
        /(?:schedule|book|arrange).*(?:visit|viewing|appointment)/i,
        /(?:want|would\s*like).*(?:to\s*)?(?:see|visit|view).*property/i,
        /(?:can|could).*(?:i|we).*(?:come|visit|see)/i,
        /site.*visit/i,
      ],
      confidence: 0.9,
    },
    {
      intent: INTENT_TYPES.PROPERTY_DETAILS,
      patterns: [
        /(?:tell|more).*(?:about|details)/i,
        /(?:what|how).*(?:about|is).*(?:this|that|the).*property/i,
        /details.*(?:of|about|for)/i,
        /describe.*property/i,
        /(?:amenities|facilities|features)/i,
      ],
      confidence: 0.85,
    },
    {
      intent: INTENT_TYPES.PROPERTY_AVAILABILITY,
      patterns: [
        /(?:any|what|which).*(?:properties|flats|apartments).*(?:available|have)/i,
        /(?:show|find|search|looking).*(?:properties|flats|apartments)/i,
        /(?:available|vacant).*(?:for\s*)?(?:rent|lease)/i,
        /(?:do\s*you|have\s*you).*(?:have|got)/i,
        /(\d)\s*bhk/i,
      ],
      confidence: 0.85,
    },
    {
      intent: INTENT_TYPES.PRICING_INFO,
      patterns: [
        /(?:how\s*much|what).*(?:rent|price|cost|budget)/i,
        /(?:rent|price).*(?:of|for)/i,
        /(?:deposit|security)/i,
        /(?:monthly|annual).*(?:rent|payment)/i,
      ],
      confidence: 0.85,
    },
    {
      intent: INTENT_TYPES.FAQ_POLICY,
      patterns: [
        /(?:do\s*you|are).*(?:allow|accept).*(?:bachelor|pet|non.?veg)/i,
        /(?:policy|rules).*(?:about|for|on)/i,
        /(?:agreement|contract|lease).*(?:period|term|duration)/i,
        /(?:maintenance|charges|fee)/i,
        /(?:can|allowed|permitted)/i,
      ],
      confidence: 0.8,
    },
    {
      intent: INTENT_TYPES.AGENCY_INFO,
      patterns: [
        /(?:about|who).*(?:you|agency|company)/i,
        /(?:your|agency).*(?:name|location|office)/i,
        /(?:how|where).*(?:contact|reach|find)/i,
      ],
      confidence: 0.75,
    },
  ];
  
  // Check each pattern
  for (const { intent, patterns, confidence } of intentPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(lowerTranscript)) {
        const entities = extractEntities(transcript);
        
        logger.debug('Intent classified', { 
          intent, 
          confidence, 
          transcript: transcript.slice(0, 100),
          entities,
        });
        
        return { intent, confidence, entities };
      }
    }
  }
  
  // Default to small talk
  return {
    intent: INTENT_TYPES.SMALL_TALK,
    confidence: 0.5,
    entities: {},
  };
}

/**
 * Extract entities from transcript
 */
function extractEntities(transcript) {
  const entities = {};
  
  // BHK type
  const bhkMatch = transcript.match(/(\d)\s*bhk/i);
  if (bhkMatch) {
    entities.bedrooms = parseInt(bhkMatch[1], 10);
    entities.propertyType = `${bhkMatch[1]} BHK`;
  }
  
  // Budget/rent
  const budgetPatterns = [
    /(\d+)\s*(?:lakh|lac)/i,
    /(\d+)\s*(?:thousand|k)/i,
    /(\d+),?(\d{3})/,
  ];
  
  for (const pattern of budgetPatterns) {
    const match = transcript.match(pattern);
    if (match) {
      let amount = parseInt(match[1], 10);
      if (/lakh|lac/i.test(match[0])) amount *= 100000;
      else if (/thousand|k/i.test(match[0])) amount *= 1000;
      else if (match[2]) amount = parseInt(match[1] + match[2], 10);
      entities.budget = amount;
      break;
    }
  }
  
  // Location
  const locationPatterns = [
    /(?:in|at|near|around)\s+([a-zA-Z\s]+?)(?:\s*(?:area|locality|sector|phase|road|street|$))/i,
    /(?:location|area|place).*?([a-zA-Z\s]{3,})/i,
  ];
  
  for (const pattern of locationPatterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      entities.location = match[1].trim();
      break;
    }
  }
  
  // Date/time for scheduling
  const datePatterns = [
    /(?:today|tomorrow|day\s*after)/i,
    /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    /(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:of\s*)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))?/i,
  ];
  
  for (const pattern of datePatterns) {
    const match = transcript.match(pattern);
    if (match) {
      entities.preferredDate = match[0];
      break;
    }
  }
  
  const timePatterns = [
    /(\d{1,2})(?::(\d{2}))?\s*(?:am|pm)/i,
    /(?:morning|afternoon|evening)/i,
  ];
  
  for (const pattern of timePatterns) {
    const match = transcript.match(pattern);
    if (match) {
      entities.preferredTime = match[0];
      break;
    }
  }
  
  return entities;
}

/**
 * Route intent to appropriate data source and fetch data
 * @param {string} tenantId - Tenant identifier
 * @param {string} intent - Detected intent
 * @param {object} entities - Extracted entities
 * @param {object} context - Conversation context (leadId, etc.)
 * @returns {Promise<{text: string, data: any, source: string}>}
 */
export async function routeAndFetchData(tenantId, intent, entities, context = {}) {
  const config = INTENT_CONFIG[intent];
  
  if (!config || config.source === DATA_SOURCE.NONE) {
    return {
      text: null,
      data: null,
      source: DATA_SOURCE.NONE,
    };
  }
  
  try {
    logger.info('Routing intent', { tenantId, intent, source: config.source });
    
    switch (config.source) {
      case DATA_SOURCE.CRM_API:
        return await fetchFromCRM(tenantId, intent, entities, context);
      
      case DATA_SOURCE.VECTOR_DB:
        return await fetchFromVectorDB(tenantId, intent, entities, context);
      
      case DATA_SOURCE.HYBRID:
        return await fetchHybrid(tenantId, intent, entities, context);
      
      default:
        return {
          text: null,
          data: null,
          source: DATA_SOURCE.NONE,
        };
    }
  } catch (error) {
    logger.error('Data fetch failed', error, { tenantId, intent });
    return {
      text: responseNormalizer.normalizeAPIError(),
      data: null,
      source: 'ERROR',
    };
  }
}

/**
 * Fetch data from CRM API
 */
async function fetchFromCRM(tenantId, intent, entities, context) {
  switch (intent) {
    case INTENT_TYPES.PROPERTY_AVAILABILITY: {
      const filters = {
        propertyType: entities.propertyType,
        location: entities.location,
        maxPrice: entities.budget,
        bedrooms: entities.bedrooms,
      };
      const properties = await crmApi.getAvailableProperties(tenantId, filters);
      return {
        text: responseNormalizer.normalizePropertyList(properties, entities),
        data: properties,
        source: DATA_SOURCE.CRM_API,
      };
    }
    
    case INTENT_TYPES.PROPERTY_DETAILS: {
      const propertyId = entities.propertyId || context.lastMentionedPropertyId;
      if (!propertyId) {
        return {
          text: "Which property would you like to know more about? Could you specify the location or type?",
          data: null,
          source: DATA_SOURCE.CRM_API,
        };
      }
      const property = await crmApi.getPropertyDetails(tenantId, propertyId);
      return {
        text: responseNormalizer.normalizePropertyDetails(property),
        data: property,
        source: DATA_SOURCE.CRM_API,
      };
    }
    
    case INTENT_TYPES.SCHEDULE_SITE_VISIT: {
      const visitData = {
        leadId: context.leadId,
        propertyId: entities.propertyId || context.lastMentionedPropertyId,
        preferredDate: entities.preferredDate,
        preferredTime: entities.preferredTime,
        source: 'ai_call',
      };
      
      if (!visitData.propertyId) {
        return {
          text: "I'd be happy to schedule a visit for you. Which property would you like to see?",
          data: null,
          source: DATA_SOURCE.CRM_API,
        };
      }
      
      if (!visitData.preferredDate) {
        return {
          text: "When would you like to schedule the visit? Please let me know your preferred date and time.",
          data: null,
          source: DATA_SOURCE.CRM_API,
        };
      }
      
      const visit = await crmApi.scheduleSiteVisit(tenantId, visitData);
      return {
        text: responseNormalizer.normalizeSiteVisitConfirmation(visit),
        data: visit,
        source: DATA_SOURCE.CRM_API,
      };
    }
    
    case INTENT_TYPES.PRICING_INFO: {
      const propertyId = entities.propertyId || context.lastMentionedPropertyId;
      if (propertyId) {
        const property = await crmApi.getPropertyDetails(tenantId, propertyId);
        if (property) {
          const rent = property.rent || property.price;
          const deposit = property.deposit || property.securityDeposit;
          let text = `The rent for this property is rupees ${rent} per month.`;
          if (deposit) {
            text += ` The security deposit is rupees ${deposit}.`;
          }
          return { text, data: property, source: DATA_SOURCE.CRM_API };
        }
      }
      // Fall through to vector DB for general pricing info
      return fetchFromVectorDB(tenantId, intent, entities, context);
    }
    
    default:
      return { text: null, data: null, source: DATA_SOURCE.NONE };
  }
}

/**
 * Fetch data from Vector DB (RAG)
 */
async function fetchFromVectorDB(tenantId, intent, entities, context) {
  const config = INTENT_CONFIG[intent];
  const category = config?.category || null;
  
  // Build query from context
  let query = context.lastTranscript || '';
  if (entities.location) query += ` ${entities.location}`;
  if (entities.propertyType) query += ` ${entities.propertyType}`;
  
  const result = await ragService.queryKnowledgeBase(tenantId, query, category);
  
  if (result.answer) {
    return {
      text: responseNormalizer.normalizeFAQResponse(result.answer, result.sources),
      data: result,
      source: DATA_SOURCE.VECTOR_DB,
    };
  }
  
  return {
    text: "I don't have specific information about that. Would you like me to connect you with one of our agents?",
    data: null,
    source: DATA_SOURCE.VECTOR_DB,
  };
}

/**
 * Fetch from both CRM and Vector DB
 */
async function fetchHybrid(tenantId, intent, entities, context) {
  const [crmResult, vectorResult] = await Promise.all([
    fetchFromCRM(tenantId, intent, entities, context),
    fetchFromVectorDB(tenantId, intent, entities, context),
  ]);
  
  // Combine results, preferring CRM for specific data
  if (crmResult.data) {
    let text = crmResult.text;
    if (vectorResult.text && vectorResult.data?.confidence > 0.7) {
      text += ` ${vectorResult.text}`;
    }
    return { text, data: { crm: crmResult.data, vector: vectorResult.data }, source: DATA_SOURCE.HYBRID };
  }
  
  return vectorResult;
}

/**
 * Check if intent requires data fetching
 */
export function shouldFetchData(intent) {
  const config = INTENT_CONFIG[intent];
  return config && config.source !== DATA_SOURCE.NONE;
}

export default {
  classifyIntent,
  routeAndFetchData,
  shouldFetchData,
};
