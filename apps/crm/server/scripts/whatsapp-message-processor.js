import { normalizeWhatsAppPhone, buildWhatsAppPrincipal } from '../utils/whatsapp.js';
import { logger } from '../logger.js';
import { sendWhatsAppMessageChunks, chunkWhatsAppText, isBaileyEnabled } from '../bailey.js';
import { logMessage, claimMessageProcessing, markMessageProcessingComplete, markMessageProcessingFailed } from '../whatsappConversationService.js';
import { getTenantIdByConnectedWhatsAppPhone } from '../agencyConfigService.js';
import { prepareConversationalTurn, runConversationalTurn } from '../agents/agentRuntime.js';

export { normalizeWhatsAppPhone };

/**
 * Lambda handler for WhatsApp message processing (EventBridge trigger).
 *
 * Thin channel adapter (Phase 2 Slice 2b): event parsing, dedup claim
 * lifecycle, self-chat auth, and delivery only. Business-hours/pause policy,
 * category-based access control, category resolution, conversation-state
 * bootstrap, agent invocation, and entity persistence all live in
 * apps/crm/server/agents/agentRuntime.js's prepareConversationalTurn()/
 * runConversationalTurn() — see docs/proposals/agent-channel-architecture/
 * phase2-imp/02-slice2b-processor-extraction.md for why and what moved.
 */
export async function handler(event) {
  console.log('whatsapp.processor.invoked', JSON.stringify({ records: event.Records?.length || 0 }));

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
        try {
          tenantId = await getTenantIdByConnectedWhatsAppPhone(to);
        } catch (err) {
          logger.warn('whatsapp.processor.tenant_lookup.failed', { error: err.message, to });
          tenantId = null;
        }
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
      // Principal for conversationStateService (Phase 2a re-key) -- distinct
      // from normalizedFrom, which whatsappConversationService.js (the
      // message log, not re-keyed in this slice) still expects as a raw phone.
      const principal = buildWhatsAppPrincipal(normalizedFrom);

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

      // Business-hours/pause policy, category-based access control, category
      // resolution, and conversation-state bootstrap all happen inside
      // prepareConversationalTurn() now (apps/crm/server/agents/agentRuntime.js).
      const prep = await prepareConversationalTurn({ tenantId, principal, contactPhone: normalizedFrom });
      if (prep.outcome === 'access_denied') {
        // We will not process this message, so release the claim to avoid
        // blocking retries for the full TTL duration. Matches the pre-Slice-2b
        // behavior: a denied message is never logged to message history.
        try {
          await markMessageProcessingComplete(tenantId, normalizedFrom, messageId);
        } catch (err) {
          logger.error('whatsapp.processor.mark_complete.failed', { tenantId, messageId, error: err.message });
        }
        logger.info('whatsapp.processor.access_denied', { tenantId, messageId, from: normalizedFrom, reason: prep.reason });
        details.push({ messageId, tenantId, success: false, action: 'access_denied', reason: prep.reason });
        continue;
      }
      const { isAgentPaused, isAutoReplyBlocked, autoReply, category } = prep;
      logger.debug('whatsapp.processor.category_resolved', { tenantId, from: normalizedFrom, category });

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

      const turnResult = await runConversationalTurn({
        tenantId, principal, contactPhone: normalizedFrom, text, messageId,
        isAgentPaused, isAutoReplyBlocked, autoReply, category,
      });

      if (turnResult.outcome === 'empty_message') {
        action = 'empty_message';
        replyText = '⚠️ I could not read your message. Please try sending it again.';
        // Still log and continue to send the reply
      } else if (turnResult.outcome === 'agent_result') {
        action = 'agent_router';
        aiGenerated = true;
        console.log('whatsapp.processor.agent_result', JSON.stringify({ ok: turnResult.ok, error: turnResult.error, hasText: !!turnResult.text, textLength: turnResult.text?.length }));
        if (turnResult.ok) {
          success = true;
          replyText = turnResult.text || '✅ Processed your request.';
          toolCalls = turnResult.toolCalls || [];
        } else if (turnResult.error === 'insufficient_credits') {
          replyText = '⚠️ Credits khatam ho gaye. Please top up karein.';
        } else if (turnResult.error === 'ai_employee_not_provisioned') {
          replyText = '🤖 AI assistant is not enabled for this account. Please contact your admin or use the CRM dashboard.';
        } else if (turnResult.error === 'ai_employee_disabled_by_tenant') {
          replyText = '🤖 AI assistant is turned off for this agency. Enable it in CRM settings or contact your admin.';
        } else {
          logger.warn('whatsapp.processor.agent_error', { tenantId, messageId, error: turnResult.error });
          if (turnResult.error === 'agents_disabled') {
            replyText = '🤖 AI agent temporarily disabled. Admin se contact karein.';
          } else if (turnResult.error === 'tenant_not_in_rollout') {
            replyText = '🤖 AI feature abhi aapke tenant ke liye enable nahi hai.';
          } else if (turnResult.error === 'credit_deduction_failed') {
            replyText = '⚠️ Credit deduction failed. Please try again later.';
          } else {
            replyText = '❌ Message process nahi ho saka. Please try again.';
          }
        }
      } else if (turnResult.outcome === 'agent_invocation_failed') {
        action = 'agent_router';
        aiGenerated = true;
        replyText = '❌ Something went wrong. Please try again.';
      } else if (turnResult.outcome === 'agent_paused') {
        if (turnResult.isAutoReplyBlocked) {
          replyText = '🤖 AI auto-reply is not available for this number. Your message has been saved.';
        } else if (!turnResult.autoReply) {
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
