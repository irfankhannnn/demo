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
export async function handler(event) {
  const { logger } = await import('../logger.js');
  const { sendWhatsAppMessage, isBaileyEnabled } = await import('../bailey.js');
  // TODO: WhatsApp audit table not created yet - re-enable after table is provisioned
  // const { logMessage, logOutcome } = await import('../whatsappAuditService.js');

  const details = [];
  for (const record of event.Records || []) {
    try {
      const detail = typeof record.detail === 'string'
        ? JSON.parse(record.detail)
        : record.detail;

      const { messageId, from, to, text, tenantId } = detail;
      if (!tenantId || !messageId) continue;

      // await logMessage(tenantId, messageId, { from, to, text, direction: 'inbound' });

      const parsed = parseWhatsAppCommand(text);
      let replyText = 'Sorry, I could not process that message.';
      let success = false;
      let action = 'unknown';
      let creditsCharged = 0;

      if (parsed) {
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
      } else if (process.env.AGENTS_ENABLED === 'true') {
        action = 'agent_router';
        try {
          const { invokeAgent } = await import('../agents/agentRuntime.js');
          const agentResult = await invokeAgent(tenantId, 'whatsapp', text, { source: 'whatsapp', from, messageId });
          if (agentResult.ok) {
            success = true;
            replyText = agentResult.result?.text || '✅ Processed your request.';
          } else if (agentResult.error === 'insufficient_credits') {
            replyText = '⚠️ Credits khatam ho gaye. Please top up karein.';
          } else if (agentResult.error === 'ai_employee_not_provisioned') {
            replyText = 'Send "lead: Name, Phone, Type" to create a lead.';
          } else if (agentResult.error === 'ai_employee_disabled_by_tenant') {
            replyText = 'Send "lead: Name, Phone, Type" to create a lead.';
          } else {
            replyText = '❌ Message process nahi ho saka. Please try again.';
          }
        } catch (err) {
          logger.error('whatsapp.processor.agent_failed', { error: err.message, tenantId });
          replyText = '❌ Something went wrong. Please try again.';
        }
      } else {
        replyText = 'Send "lead: Name, Phone, Type" to create a lead. Example: lead: Rahul, 9876543210, buyer';
      }

      if (isBaileyEnabled()) {
        try {
          await sendWhatsAppMessage(from, replyText);
          creditsCharged += 1;
        } catch (err) {
          logger.error('whatsapp.processor.reply_failed', { error: err.message, tenantId });
        }
      }

      // await logOutcome(tenantId, messageId, { success, action, result: replyText, creditsCharged });
      details.push({ messageId, tenantId, success, action });
    } catch (err) {
      logger.error('whatsapp.processor.record_failed', { error: err.message });
    }
  }

  return { processed: details.length, details };
}
