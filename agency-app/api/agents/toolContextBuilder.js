/**
 * Tool Context Builder
 * Enriches tool invocations with conversation context, user info, and business rules
 * Ensures tools have all necessary context to make intelligent decisions
 */
import { getConversationState } from '../conversationStateService.js';
import { enrichContextWithLead } from '../skillInvoker.js';
import { logger } from '../logger.js';

/**
 * Build comprehensive context for tool execution
 * @param {string} tenantId
 * @param {object} context - Base context (userId, contactPhone, leadId, etc.)
 * @returns {Promise<object>} Enriched context for tool execution
 */
export async function buildToolContext(tenantId, context = {}) {
  const enrichedContext = {
    tenantId,
    timestamp: new Date().toISOString(),
    ...context,
  };

  // Load conversation state if contact phone provided
  if (context.contactPhone) {
    try {
      const convState = await getConversationState(tenantId, context.contactPhone);
      if (convState) {
        enrichedContext.conversationState = {
          status: convState.status,
          intent: convState.intent,
          topic: convState.topic,
          messageCount: convState.messageCount,
          context: convState.context,
        };
      }
    } catch (err) {
      logger.warn('toolContextBuilder.loadConversationState.failed', { tenantId, contactPhone: context.contactPhone, error: err.message });
    }
  }

  // Load lead context if leadId provided
  if (context.leadId) {
    try {
      const leadContext = await enrichContextWithLead(tenantId, context.leadId);
      if (Object.keys(leadContext).length > 0) {
        enrichedContext.leadContext = leadContext;
      }
    } catch (err) {
      logger.warn('toolContextBuilder.loadLeadContext.failed', { tenantId, leadId: context.leadId, error: err.message });
    }
  }

  return enrichedContext;
}

/**
 * Build context specifically for lead creation tool
 * Includes conversation history and user intent
 * @param {string} tenantId
 * @param {object} context
 * @returns {Promise<object>} Context for lead creation
 */
export async function buildLeadCreationContext(tenantId, context = {}) {
  const baseContext = await buildToolContext(tenantId, context);

  if (!context.contactPhone && !context.leadId) {
    logger.warn('toolContextBuilder.buildLeadCreationContext.missing_context', { tenantId });
  }

  return {
    ...baseContext,
    toolName: 'create_lead',
    guidelines: {
      // Lead creation guidelines based on conversation intent
      shouldAutoQualify: baseContext.conversationState?.intent === 'inquiry',
      defaultLeadType: context.contactPhone ? 'buyer' : 'inquiry',
      autoAssignToTeam: true,
      sendWelcomeMessage: true,
    },
  };
}

/**
 * Build context for lead search/query tool
 * Includes conversation topic and user intent
 * @param {string} tenantId
 * @param {object} context
 * @returns {Promise<object>} Context for lead search
 */
export async function buildLeadSearchContext(tenantId, context = {}) {
  const baseContext = await buildToolContext(tenantId, context);

  return {
    ...baseContext,
    toolName: 'search_leads',
    guidelines: {
      // Search guidelines based on conversation topic
      filterByStatus: baseContext.conversationState?.topic === 'follow_up' ? ['warm', 'hot'] : undefined,
      limitResults: 10,
      includeMetadata: true,
    },
  };
}

/**
 * Build context for lead update tool
 * Includes conversation state and user permissions
 * @param {string} tenantId
 * @param {object} context
 * @returns {Promise<object>} Context for lead update
 */
export async function buildLeadUpdateContext(tenantId, context = {}) {
  const baseContext = await buildToolContext(tenantId, context);

  if (!context.leadId) {
    logger.warn('toolContextBuilder.buildLeadUpdateContext.missing_leadId', { tenantId });
  }

  return {
    ...baseContext,
    toolName: 'update_lead',
    guidelines: {
      // Update guidelines
      allowedFields: [
        'status', 'score', 'assignedTo', 'notes', 'lastInteractionAt',
        'buyerRequirement', 'sellerProperty', 'ownerProperty', 'tenantRequirement',
      ],
      requireConfirmation: baseContext.conversationState?.status === 'active',
      logChanges: true,
      notifyAssignee: true,
    },
  };
}

/**
 * Build context for property search tool
 * Includes conversation preferences and lead requirements
 * @param {string} tenantId
 * @param {object} context
 * @returns {Promise<object>} Context for property search
 */
export async function buildPropertySearchContext(tenantId, context = {}) {
  const baseContext = await buildToolContext(tenantId, context);
  const leadContext = baseContext.leadContext || {};

  return {
    ...baseContext,
    toolName: 'search_properties',
    guidelines: {
      // Property search guidelines based on lead type
      filterByBudget: leadContext.leadScore ? true : false,
      filterByLocation: baseContext.conversationState?.context?.preferredLocation,
      filterByType: baseContext.conversationState?.context?.propertyType,
      limitResults: 5,
      sortBy: 'relevance',
    },
  };
}

/**
 * Build context for contact creation tool
 * Includes conversation metadata and user info
 * @param {string} tenantId
 * @param {object} context
 * @returns {Promise<object>} Context for contact creation
 */
export async function buildContactCreationContext(tenantId, context = {}) {
  const baseContext = await buildToolContext(tenantId, context);

  return {
    ...baseContext,
    toolName: 'create_contact',
    guidelines: {
      // Contact creation guidelines
      autoLinkToLead: !!baseContext.leadContext,
      sendIntroductionEmail: true,
      addToWhatsAppGroup: false,
      defaultRole: 'prospect',
    },
  };
}

/**
 * Build context for note creation tool
 * Includes conversation summary and context
 * @param {string} tenantId
 * @param {object} context
 * @returns {Promise<object>} Context for note creation
 */
export async function buildNoteCreationContext(tenantId, context = {}) {
  const baseContext = await buildToolContext(tenantId, context);

  return {
    ...baseContext,
    toolName: 'create_lead_note',
    guidelines: {
      // Note creation guidelines
      includeConversationSummary: true,
      includeUserIntent: baseContext.conversationState?.intent,
      includeTimestamp: true,
      autoTag: true,
    },
  };
}

/**
 * Inject context into tool input
 * Adds context metadata to tool parameters
 * @param {string} toolName
 * @param {object} toolInput
 * @param {object} enrichedContext
 * @returns {object} Tool input with injected context
 */
export function injectContextIntoTool(toolName, toolInput, enrichedContext) {
  return {
    ...toolInput,
    _context: {
      tenantId: enrichedContext.tenantId,
      userId: enrichedContext.userId,
      contactPhone: enrichedContext.contactPhone,
      leadId: enrichedContext.leadId,
      conversationState: enrichedContext.conversationState,
      leadContext: enrichedContext.leadContext,
      timestamp: enrichedContext.timestamp,
    },
  };
}

/**
 * Build context for a specific tool by name
 * @param {string} tenantId
 * @param {string} toolName
 * @param {object} context
 * @returns {Promise<object>} Tool-specific context
 */
export async function buildContextForTool(tenantId, toolName, context = {}) {
  switch (toolName) {
    case 'create_lead':
      return buildLeadCreationContext(tenantId, context);
    case 'search_leads':
      return buildLeadSearchContext(tenantId, context);
    case 'update_lead':
      return buildLeadUpdateContext(tenantId, context);
    case 'search_properties':
      return buildPropertySearchContext(tenantId, context);
    case 'create_contact':
      return buildContactCreationContext(tenantId, context);
    case 'create_lead_note':
      return buildNoteCreationContext(tenantId, context);
    default:
      return buildToolContext(tenantId, context);
  }
}
