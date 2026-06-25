import { normalizeWhatsAppPhone } from '../utils/whatsapp.js';

export { normalizeWhatsAppPhone };

/**
 * Parse deterministic WhatsApp command grammar.
 * Returns { action, input } or null for free-text fallback.
 */
export function parseWhatsAppCommand(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  const leadMatch = trimmed.match(/^lead:\s*(.+?),\s*(\+?\d[\d\s-]{8,14}),\s*(\w+)/i);
  if (leadMatch) {
    return {
      action: 'create_lead',
      input: {
        name: leadMatch[1].trim(),
        phone: leadMatch[2].replace(/\s/g, ''),
        leadType: leadMatch[3].trim().toLowerCase(),
      },
    };
  }

  const searchMatch = trimmed.match(/^search\s+leads?\s+(.+)/i);
  if (searchMatch) {
    return {
      action: 'search_leads',
      input: { query: searchMatch[1].trim() },
    };
  }

  return null;
}

/**
 * Lambda handler for WhatsApp message processing (EventBridge trigger).
 */
function isWithinBusinessHours(start, end, timezone = 'Asia/Kolkata') {
  if (!start || !end) return true;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const minute = parts.find((p) => p.type === 'minute')?.value;
    const current = `${hour}:${minute}`;
    return current >= start && current <= end;
  } catch {
    return true;
  }
}

export async function handler(event) {
  const { logger } = await import('../logger.js');
  const { sendWhatsAppMessage, isBaileyEnabled } = await import('../bailey.js');
  const { logMessage, hasMessage } = await import('../whatsappConversationService.js');
  const { getAgencyConfig } = await import('../agencyConfigService.js');
  const { canReceiveMessage, canAutoReply } = await import('../whatsappAccessControl.js');
  const { resolveCategory } = await import('../userCategoryService.js');
  const { getConversationState, initializeConversationState, recordMessageInConversation, extractEntitiesFromToolResults, updateLastDiscussedEntities } = await import('../conversationStateService.js');

  const details = [];
  const seenMessageIds = new Set(); // In-memory dedup for duplicate messages in the same batch
  for (const record of event.Records || []) {
    try {
      const detail = typeof record.detail === 'string'
        ? JSON.parse(record.detail)
        : record.detail;

      const { messageId, from, to, text, tenantId, fromJid } = detail;
      if (!tenantId || !messageId) continue;

      const normalizedFrom = normalizeWhatsAppPhone(from);

      // Deduplicate: skip if this message was already processed (Baileys retries/offline)
      // Check in-memory first (same Lambda batch) then DynamoDB (previous invocations)
      const dedupKey = `${tenantId}#${normalizedFrom}#${messageId}`;
      if (seenMessageIds.has(dedupKey)) {
        logger.info('whatsapp.processor.duplicate_skip', { tenantId, messageId, from: normalizedFrom, reason: 'in_memory' });
        details.push({ messageId, tenantId, success: true, action: 'duplicate_skip' });
        continue;
      }

      try {
        const alreadyProcessed = await hasMessage(tenantId, normalizedFrom, messageId);
        if (alreadyProcessed) {
          logger.info('whatsapp.processor.duplicate_skip', { tenantId, messageId, from: normalizedFrom, reason: 'dynamodb' });
          details.push({ messageId, tenantId, success: true, action: 'duplicate_skip' });
          continue;
        }
      } catch (err) {
        logger.warn('whatsapp.processor.dedup_check.failed', { tenantId, messageId, from: normalizedFrom, error: err.message });
      }
      seenMessageIds.add(dedupKey);
      const agencyConfig = await getAgencyConfig(tenantId).catch(() => ({}));
      const autoReply = agencyConfig?.autoReply !== false;
      const businessHoursStart = agencyConfig?.businessHoursStart;
      const businessHoursEnd = agencyConfig?.businessHoursEnd;
      const timezone = agencyConfig?.timezone || 'Asia/Kolkata';
      const inBusinessHours = isWithinBusinessHours(businessHoursStart, businessHoursEnd, timezone);
      const isAgentPaused = !autoReply || !inBusinessHours;

      // Category-based access control
      const aiEmployeeConfig = agencyConfig?.aiEmployee || {};
      const accessCheck = await canReceiveMessage(normalizedFrom, tenantId, aiEmployeeConfig);
      if (!accessCheck.allowed) {
        logger.info('whatsapp.processor.access_denied', { tenantId, messageId, from: normalizedFrom, reason: accessCheck.reason });
        details.push({ messageId, tenantId, success: false, action: 'access_denied', reason: accessCheck.reason });
        continue;
      }

      // Auto-reply access control
      const autoReplyCheck = await canAutoReply(normalizedFrom, tenantId, aiEmployeeConfig);
      const isAutoReplyBlocked = !autoReplyCheck.allowed;

      // Resolve category (auto-categorize if unknown)
      const category = await resolveCategory(normalizedFrom, tenantId, {
        messageCount: 1,
        lastInteractionAt: new Date().toISOString(),
        hasLeadCreated: false,
      });
      logger.debug('whatsapp.processor.category_resolved', { tenantId, from: normalizedFrom, category });

      // Ensure conversation state exists for this contact
      try {
        let convState = await getConversationState(tenantId, normalizedFrom);
        if (!convState) {
          convState = await initializeConversationState(tenantId, normalizedFrom, { source: 'whatsapp', category });
        }
        await recordMessageInConversation(tenantId, normalizedFrom);
      } catch (err) {
        logger.warn('whatsapp.processor.conversation_state.failed', { tenantId, from: normalizedFrom, error: err.message });
      }

      try {
        await logMessage(tenantId, normalizedFrom, {
          messageId,
          direction: 'inbound',
          from,
          to,
          text,
          fromMe: false,
          aiGenerated: false,
          status: 'received',
          createdAt: detail.receivedAt,
        });
      } catch (err) {
        logger.error('whatsapp.processor.log_inbound.failed', { tenantId, messageId, error: err.message });
      }

      const parsed = parseWhatsAppCommand(text);
      let replyText = 'Sorry, I could not process that message.';
      let success = false;
      let action = 'unknown';
      let creditsCharged = 0;
      let aiGenerated = false;
      let toolCalls = [];

      // Guard: do not invoke AI for empty/whitespace-only text.
      const hasText = text && typeof text === 'string' && text.trim().length > 0;
      if (!hasText) {
        action = 'empty_message';
        replyText = '⚠️ I could not read your message. Please try sending it again.';
        // Still log and continue to send the reply
      } else if (parsed) {
        action = parsed.action;
        try {
          const { invokeSkill } = await import('../skillInvoker.js');
          const result = await invokeSkill(tenantId, parsed.action, parsed.input, { userId: 'whatsapp' });

          if (result.ok) {
            success = true;
            if (parsed.action === 'create_lead') {
              replyText = `✅ Lead created: ${parsed.input.name}`;
            } else if (parsed.action === 'search_leads') {
              const count = result.data?.items?.length ?? result.data?.length ?? 0;
              replyText = `Found ${count} lead(s) matching your search.`;
            } else {
              replyText = '✅ Done.';
            }
          } else {
            replyText = `❌ ${result.error || 'Action failed'}`;
          }
        } catch (err) {
          logger.error('whatsapp.processor.skill_failed', { error: err.message, tenantId, action });
          replyText = '❌ Something went wrong. Please try again.';
        }
      } else if (process.env.AGENTS_ENABLED === 'true' && !isAgentPaused && !isAutoReplyBlocked) {
        action = 'agent_router';
        aiGenerated = true;
        try {
          const { invokeAgent } = await import('../agents/agentRuntime.js');
          const agentResult = await invokeAgent(tenantId, 'whatsapp', text, { source: 'whatsapp', from: normalizedFrom, contactPhone: normalizedFrom, messageId, category });
          if (agentResult.ok) {
            success = true;
            replyText = agentResult.result?.text || '✅ Processed your request.';
            toolCalls = agentResult.toolResults || [];

            // Extract and persist entities from tool results so next turn has context
            try {
              const currentState = await getConversationState(tenantId, normalizedFrom);
              if (currentState) {
                const entities = extractEntitiesFromToolResults(toolCalls);
                if (entities.length > 0) {
                  await updateLastDiscussedEntities(tenantId, normalizedFrom, entities, 'crm_query');
                  logger.info('whatsapp.processor.entities_persisted', { tenantId, from: normalizedFrom, count: entities.length, entities: entities.map(e => e.name) });
                }
              } else {
                logger.debug('whatsapp.processor.entity_extraction.skipped_no_state', { tenantId, from: normalizedFrom });
              }
            } catch (err) {
              logger.warn('whatsapp.processor.entity_extraction.failed', { tenantId, from: normalizedFrom, error: err.message });
            }
          } else if (agentResult.error === 'insufficient_credits') {
            replyText = '⚠️ Credits khatam ho gaye. Please top up karein.';
          } else if (agentResult.error === 'ai_employee_not_provisioned') {
            replyText = 'Send "lead: Name, Phone, Type" to create a lead.';
          } else if (agentResult.error === 'ai_employee_disabled_by_tenant') {
            replyText = 'Send "lead: Name, Phone, Type" to create a lead.';
          } else {
            logger.warn('whatsapp.processor.agent_error', { tenantId, messageId, error: agentResult.error });
            if (agentResult.error === 'agents_disabled') {
              replyText = '🤖 AI agent temporarily disabled. Admin se contact karein.';
            } else if (agentResult.error === 'tenant_not_in_rollout') {
              replyText = '🤖 AI feature abhi aapke tenant ke liye enable nahi hai.';
            } else if (agentResult.error === 'credit_deduction_failed') {
              replyText = '⚠️ Credit deduction failed. Please try again later.';
            } else {
              replyText = '❌ Message process nahi ho saka. Please try again.';
            }
          }
        } catch (err) {
          logger.error('whatsapp.processor.agent_failed', { error: err.message, tenantId, stack: err.stack });
          replyText = '❌ Something went wrong. Please try again.';
        }
      } else if (isAgentPaused || isAutoReplyBlocked) {
        if (isAutoReplyBlocked) {
          replyText = '🤖 AI auto-reply is not available for this number. Your message has been saved.';
        } else if (!autoReply) {
          replyText = '🤖 AI auto-reply is currently paused. Your message has been saved.';
        } else {
          replyText = '🤖 AI is currently outside business hours. We will respond during working hours.';
        }
      } else {
        replyText = 'Send "lead: Name, Phone, Type" to create a lead. Example: lead: Rahul, 9876543210, buyer';
      }

      if (aiGenerated && replyText && !replyText.startsWith('🤖 ')) {
        replyText = '🤖 ' + replyText;
      }

      logger.info('whatsapp.processor.final_reply', { messageId, replyTextLength: replyText?.length, replyText });

      if (isBaileyEnabled()) {
        try {
          // Reply from the tenant's business number (the `to` number of the inbound message)
          // Use fromJid (original JID, e.g. 10076144300114@lid) when available so the
          // baileys-service sends to the correct JID type (LID vs @s.whatsapp.net).
          // Fall back to normalizedFrom for classic phone-number senders.
          const replyTo = fromJid || normalizedFrom;
          await sendWhatsAppMessage(replyTo, replyText, null, to);
          creditsCharged += 1;
          try {
            await logMessage(tenantId, normalizedFrom, {
              messageId: `${messageId}-reply`,
              direction: 'outbound',
              from: to,
              to: from,
              text: replyText,
              fromMe: true,
              aiGenerated,
              toolCalls,
              creditsCharged: 1,
              status: 'sent',
              createdAt: new Date().toISOString(),
            });
          } catch (err) {
            logger.error('whatsapp.processor.log_outbound.failed', { tenantId, messageId, error: err.message });
          }
        } catch (err) {
          logger.error('whatsapp.processor.reply_failed', { error: err.message, tenantId });
        }
      }
      details.push({ messageId, tenantId, success, action });
    } catch (err) {
      logger.error('whatsapp.processor.record_failed', { error: err.message });
    }
  }

  return { processed: details.length, details };
}
