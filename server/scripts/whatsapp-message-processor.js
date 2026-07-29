import { normalizeWhatsAppPhone } from '../utils/whatsapp.js';

export { normalizeWhatsAppPhone };

/**
 * Lambda handler for WhatsApp message processing (EventBridge trigger).
 */
function minutesFromTime(timeStr) {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(String(timeStr))) return null;
  const [h, m] = String(timeStr).split(':').map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

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
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value, 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value, 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return true;

    const current = hour * 60 + minute;
    const startMinutes = minutesFromTime(start);
    const endMinutes = minutesFromTime(end);
    if (startMinutes === null || endMinutes === null) return true;

    // Handle cross-midnight ranges like 22:00-02:00.
    if (endMinutes < startMinutes) {
      return current >= startMinutes || current <= endMinutes;
    }
    return current >= startMinutes && current <= endMinutes;
  } catch {
    return true;
  }
}

export async function handler(event) {
  console.log('whatsapp.processor.invoked', JSON.stringify({ records: event.Records?.length || 0 }));
  const { logger } = await import('../logger.js');
  console.log('whatsapp.processor.logger_loaded');
  const { sendWhatsAppMessageChunks, chunkWhatsAppText, isBaileyEnabled } = await import('../bailey.js');
  const { logMessage, claimMessageProcessing, markMessageProcessingComplete, markMessageProcessingFailed } = await import('../whatsappConversationService.js');
  const { getAgencyConfig } = await import('../agencyConfigService.js');
  const { canReceiveMessage, canAutoReply } = await import('../whatsappAccessControl.js');
  const { resolveCategory } = await import('../userCategoryService.js');
  const { getConversationState, initializeConversationState, recordMessageInConversation, extractEntitiesFromToolResults, extractListAndFocusFromToolResults, updateLastDiscussedEntities, resetConversationStateIfStale } = await import('../conversationStateService.js');

  // Resolve tenantId from the destination WhatsApp number by looking up the Subscriptions table
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-south-1' }));
  const AGENCY_CONFIG_TABLE = process.env.AGENCY_CONFIG_DYNAMODB_TABLE_NAME || 'cloudberry-dev-real-estate-agencies';

  async function resolveTenantByWhatsAppNumber(toNumber) {
    if (!toNumber) return null;
    const normalized = normalizeWhatsAppPhone(toNumber);
    try {
      // Look up in agency config table by connectedWhatsAppPhone
      const result = await docClient.send(new ScanCommand({
        TableName: AGENCY_CONFIG_TABLE,
        ProjectionExpression: 'TenantId, connectedWhatsAppPhone',
        FilterExpression: 'connectedWhatsAppPhone = :phone',
        ExpressionAttributeValues: { ':phone': normalized },
      }));
      console.log('whatsapp.processor.tenant_scan', JSON.stringify({ table: AGENCY_CONFIG_TABLE, normalized, scannedCount: result.ScannedCount, count: result.Count, items: result.Items?.length }));
      return result.Items?.[0]?.TenantId || null;
    } catch (err) {
      console.log('whatsapp.processor.tenant_lookup_failed', JSON.stringify({ error: err.message, toNumber: normalized, table: AGENCY_CONFIG_TABLE }));
      logger.warn('whatsapp.processor.tenant_lookup.failed', { error: err.message, toNumber: normalized });
      return null;
    }
  }

  const details = [];
  const seenMessageIds = new Set(); // In-memory dedup for duplicate messages in the same batch
  // Support both EventBridge (event.detail) and SQS (event.Records[].detail) formats
  const records = event.Records || [{ detail: event.detail }];
  for (const record of records) {
    try {
      const detail = typeof record.detail === 'string'
        ? JSON.parse(record.detail)
        : record.detail;

      let { messageId, from, to, text, tenantId, fromJid } = detail;
      console.log('whatsapp.processor.detail', JSON.stringify({ messageId, from, to, text: text?.slice(0,50), tenantId, fromJid }));
      // If tenantId is not in the event (WhatsApp Platform doesn't send it), resolve from the `to` number
      if (!tenantId && to) {
        tenantId = await resolveTenantByWhatsAppNumber(to);
        console.log('whatsapp.processor.tenant_resolved', JSON.stringify({ to, tenantId }));
        logger.info('whatsapp.processor.tenant_resolved', { to, tenantId });
      }
      if (!tenantId || !messageId) {
        console.log('whatsapp.processor.skip_missing_tenant', JSON.stringify({ messageId, from, to, hasTenantId: !!tenantId }));
        logger.warn('whatsapp.processor.skip_missing_tenant', { messageId, from, to, hasTenantId: !!tenantId });
        continue;
      }

      const normalizedFrom = normalizeWhatsAppPhone(from);
      const normalizedTo = normalizeWhatsAppPhone(to);

      // Self-chat check: only allow messages from the connected WhatsApp number itself
      // This ensures defense-in-depth - the webhook also checks this, but we verify again here
      const isSelfChat = normalizedFrom && normalizedTo && normalizedFrom === normalizedTo;
      if (!isSelfChat) {
        logger.info('whatsapp.processor.self_chat_check_failed', { tenantId, messageId, from: normalizedFrom, to: normalizedTo, reason: 'not_self_chat' });
        // Skip processing for non-self-chat messages
        details.push({ messageId, tenantId, success: true, action: 'self_chat_check_failed', reason: 'not_self_chat' });
        continue;
      }

      // Deduplicate: skip if this message was already processed (Baileys retries/offline)
      // Check in-memory first (same Lambda batch) then DynamoDB (previous invocations)
      const dedupKey = `${tenantId}#${normalizedFrom}#${messageId}`;
      if (seenMessageIds.has(dedupKey)) {
        logger.info('whatsapp.processor.duplicate_skip', { tenantId, messageId, from: normalizedFrom, reason: 'in_memory' });
        details.push({ messageId, tenantId, success: true, action: 'duplicate_skip' });
        continue;
      }

      // Atomic dedup: only one Lambda invocation may process this message.
      // The claim is a DynamoDB row with a conditional write. If a previous
      // invocation crashed mid-process, the claim becomes stale after 5 min
      // and can be stolen by a retry.
      let claimResult;
      try {
        claimResult = await claimMessageProcessing(tenantId, normalizedFrom, messageId);
      } catch (err) {
        logger.warn('whatsapp.processor.claim.failed', { tenantId, messageId, from: normalizedFrom, error: err.message });
        claimResult = { claimed: false, reason: 'error' };
      }
      if (!claimResult.claimed) {
        logger.info('whatsapp.processor.duplicate_skip', { tenantId, messageId, from: normalizedFrom, reason: claimResult.reason || 'claim_failed' });
        details.push({ messageId, tenantId, success: true, action: 'duplicate_skip', reason: claimResult.reason });
        continue;
      }

      // NOTE: We no longer fall back to hasMessage() to skip processing. If the
      // claim was acquired, the message must be processed. Falling back to the
      // logged message table would prevent legitimate retries after a failed
      // reply delivery (the inbound message is logged but the reply never went
      // out). The atomic claim is the single source of truth for dedup.
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
        // We will not process this message, so release the claim to avoid
        // blocking retries for the full TTL duration.
        try {
          await markMessageProcessingComplete(tenantId, normalizedFrom, messageId);
        } catch (err) {
          logger.error('whatsapp.processor.mark_complete.failed', { tenantId, messageId, error: err.message });
        }
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

      // Ensure conversation state exists for this contact. Reset stale state so
      // old intent/topic/entities don't leak into a new conversation after a gap.
      try {
        await resetConversationStateIfStale(tenantId, normalizedFrom, 2, { source: 'whatsapp', category });
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
          isGroup: detail.isGroup ?? false,
          createdAt: detail.receivedAt,
        });
      } catch (err) {
        logger.error('whatsapp.processor.log_inbound.failed', { tenantId, messageId, error: err.message });
      }

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
      } else if (process.env.AGENTS_ENABLED === 'true' && !isAgentPaused && !isAutoReplyBlocked) {
        action = 'agent_router';
        aiGenerated = true;
        try {
          const { invokeAgent } = await import('../agents/agentRuntime.js');
          console.log('whatsapp.processor.invoking_agent', JSON.stringify({ tenantId, text: text?.slice(0,50), from: normalizedFrom }));
          const agentResult = await invokeAgent(tenantId, 'whatsapp', text, { source: 'whatsapp', from: normalizedFrom, contactPhone: normalizedFrom, messageId, category });
          console.log('whatsapp.processor.agent_result', JSON.stringify({ ok: agentResult.ok, error: agentResult.error, hasText: !!agentResult.result?.text, textLength: agentResult.result?.text?.length }));
          if (agentResult.ok) {
            success = true;
            replyText = agentResult.result?.text || '✅ Processed your request.';
            toolCalls = agentResult.result?.toolResults || agentResult.toolResults || [];

            // Extract and persist entities from tool results so next turn has context
            try {
              const currentState = await getConversationState(tenantId, normalizedFrom);
              if (currentState) {
                const entities = extractEntitiesFromToolResults(toolCalls);
                const { lastListResults, currentEntity } = extractListAndFocusFromToolResults(toolCalls);
                if (entities.length > 0 || lastListResults || currentEntity) {
                  await updateLastDiscussedEntities(tenantId, normalizedFrom, entities, 'crm_query', {
                    lastListResults,
                    currentEntity,
                  });
                  logger.info('whatsapp.processor.entities_persisted', {
                    tenantId,
                    from: normalizedFrom,
                    count: entities.length,
                    listCount: lastListResults?.length || 0,
                    currentEntity: currentEntity?.name || null,
                    entities: entities.map(e => e.name),
                  });
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
            replyText = '🤖 AI assistant is not enabled for this account. Please contact your admin or use the CRM dashboard.';
          } else if (agentResult.error === 'ai_employee_disabled_by_tenant') {
            replyText = '🤖 AI assistant is turned off for this agency. Enable it in CRM settings or contact your admin.';
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
        replyText = '🤖 AI assistant is not available. Enable agents in settings or contact your admin.';
      }

      if (aiGenerated && replyText && !replyText.startsWith('🤖 ')) {
        replyText = '🤖 ' + replyText;
      }

      console.log('whatsapp.processor.before_final_reply', JSON.stringify({ messageId, replyTextLength: replyText?.length, isBaileyEnabled: isBaileyEnabled() }));

      if (isBaileyEnabled()) {
        try {
          // Reply from the tenant's business number (the `to` number of the inbound message)
          // Use fromJid (original JID, e.g. 10076144300114@lid) when available so the
          // whatsapp-platform sends to the correct JID type (LID vs @s.whatsapp.net).
          // Fall back to normalizedFrom for classic phone-number senders.
          const replyTo = fromJid || normalizedFrom;
          console.log('whatsapp.processor.sending_reply', JSON.stringify({ replyTo, from: to, textLength: replyText?.length }));

          // Connectivity test: try fetching google.com with 5s timeout
          try {
            const testController = new AbortController();
            const testTimeoutId = setTimeout(() => testController.abort(), 5000);
            const testResp = await fetch('https://www.google.com', { signal: testController.signal });
            clearTimeout(testTimeoutId);
            console.log('whatsapp.processor.connectivity_test', JSON.stringify({ status: testResp.status, ok: testResp.ok }));
          } catch (testErr) {
            console.log('whatsapp.processor.connectivity_test_failed', JSON.stringify({ error: testErr.message, name: testErr.name }));
          }

          // Connectivity test: try fetching ALB health with 5s timeout
          try {
            const albController = new AbortController();
            const albTimeoutId = setTimeout(() => albController.abort(), 5000);
            const albResp = await fetch(`${process.env.BAILEY_API_ENDPOINT}/health`, { signal: albController.signal });
            clearTimeout(albTimeoutId);
            console.log('whatsapp.processor.alb_health_check', JSON.stringify({ status: albResp.status, ok: albResp.ok }));
          } catch (albErr) {
            console.log('whatsapp.processor.alb_health_check_failed', JSON.stringify({ error: albErr.message, name: albErr.name }));
          }

          const chunkResult = await sendWhatsAppMessageChunks(replyTo, replyText, null, to);
          console.log('whatsapp.processor.reply_sent', JSON.stringify({ sent: chunkResult.sent, queued: chunkResult.queued, messageIds: chunkResult.messageIds }));
          const sentCount = chunkResult.messageIds?.length || 0;
          const totalChunks = chunkResult.totalChunks || sentCount;
          creditsCharged += sentCount || 1;
          if (sentCount < totalChunks) {
            logger.warn('whatsapp.processor.partial_chunk_delivery', { tenantId, messageId, sentCount, totalChunks });
          }
          // Mark the atomic processing claim as completed only after all chunks are
          // sent so EventBridge/Lambda retries do not trigger another AI response.
          try {
            await markMessageProcessingComplete(tenantId, normalizedFrom, messageId);
          } catch (err) {
            logger.error('whatsapp.processor.mark_complete.failed', { tenantId, messageId, error: err.message });
          }
          // Log each sent chunk as a separate outbound message for accurate conversation history.
          const chunks = chunkWhatsAppText(replyText);
          for (let i = 0; i < sentCount; i++) {
            try {
              await logMessage(tenantId, normalizedFrom, {
                messageId: chunkResult.messageIds?.[i] || `${messageId}-reply-${i}`,
                direction: 'outbound',
                from: to,
                to: from,
                text: chunks[i],
                fromMe: true,
                aiGenerated,
                toolCalls: i === 0 ? toolCalls : [],
                creditsCharged: i === 0 ? 1 : 0,
                status: 'sent',
                createdAt: new Date().toISOString(),
              });
            } catch (err) {
              logger.error('whatsapp.processor.log_outbound.failed', { tenantId, messageId, chunkIndex: i, error: err.message });
            }
          }
        } catch (err) {
          logger.error('whatsapp.processor.reply_failed', { error: err.message, tenantId });
          // Release the dedup claim so a Lambda/EventBridge retry can reclaim
          // and re-send the message once the Baileys connection is healthy.
          try {
            await markMessageProcessingFailed(tenantId, normalizedFrom, messageId);
          } catch (releaseErr) {
            logger.error('whatsapp.processor.mark_failed.failed', { tenantId, messageId, error: releaseErr.message });
          }
          // Propagate the failure so the webhook/Lambda invocation is considered
          // failed and can be retried. The dedup claim has been released above.
          throw err;
        }
      } else {
        // Bailey is disabled; we still consumed the message, so mark the claim
        // complete to avoid unnecessary retries.
        try {
          await markMessageProcessingComplete(tenantId, normalizedFrom, messageId);
        } catch (err) {
          logger.error('whatsapp.processor.mark_complete.failed', { tenantId, messageId, error: err.message });
        }
      }
      details.push({ messageId, tenantId, success, action });
    } catch (err) {
      logger.error('whatsapp.processor.record_failed', { error: err.message });
      // Propagate the first critical failure (e.g., reply could not be sent)
      // so the webhook/Lambda invocation can be retried.
      throw err;
    }
  }

  return { processed: details.length, details };
}
