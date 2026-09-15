// Everything the service does with a connected Instagram account.
//
//   connect      OAuth code -> long-lived token (encrypted) -> account row,
//                webhook subscription, registry pointers
//   ingest       DMs from webhooks and from polling land in the same thread,
//                idempotent on the message id
//   analyse      threads with new inbound messages get a lead analysis and,
//                when they qualify, an enquiry that is promoted to a CRM lead
//   reply        a human sends from the console; the window policy decides
//   rules        a matching comment gets its public reply and private reply once
//   sync         media, insights and profile snapshots for the dashboard
//   Meta         deauthorize and data-deletion callbacks
//
// Dependencies are injected so the test suite can run the whole flow against
// a fake Instagram and the local DynamoDB stand-in.

import crypto from 'node:crypto';
import { getConfig } from '../config/env.js';
import { logger } from '../logger.js';
import * as defaultDb from './dynamoService.js';
import * as defaultCrm from './crmBridge.js';
import { createInstagramApi } from './instagramApi.js';
import { analyseConversation } from './leadAnalyst.js';
import { encryptSecret, decryptSecret, signOAuthState, verifyOAuthState, parseSignedRequest } from './metaSecurity.js';
import { ERROR_KIND } from './metaErrors.js';
import { canSend, clampMessage, COMMENT_REPLY_WINDOW_MS } from './windowPolicy.js';
import { findRule } from './ruleMatcher.js';
import { toDateKey } from './normalise.js';

const log = logger.child({ module: 'services/instagramService' });

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_TOKEN_LIFETIME_S = 60 * 24 * 60 * 60;
const REFRESH_WHEN_EXPIRING_WITHIN_MS = 10 * DAY_MS;

/** A failure a route can hand straight to the client. */
export class ServiceError extends Error {
  constructor(status, error, details) {
    super(details || error);
    this.name = 'ServiceError';
    this.status = status;
    this.error = error;
    this.details = details;
  }
}

/** Thread ids are ours: one thread per (business account, other person). */
export function threadIdFor(igUserId, participantId) {
  return `${igUserId}_${participantId}`;
}

function selfIds(account) {
  return new Set([account.igUserId, account.appScopedId].filter(Boolean).map(String));
}

/** The only shape an account is ever serialised as. The token is absent by construction. */
export function publicAccount(account, now = Date.now()) {
  if (!account) return null;
  const expiresAt = account.tokenExpiresAt ? Date.parse(account.tokenExpiresAt) : null;
  return {
    igUserId: account.igUserId,
    username: account.username ?? null,
    name: account.name ?? null,
    accountType: account.accountType ?? null,
    profilePictureUrl: account.profilePictureUrl ?? null,
    followersCount: account.followersCount ?? null,
    followsCount: account.followsCount ?? null,
    mediaCount: account.mediaCount ?? null,
    status: account.status,
    tokenExpiresAt: account.tokenExpiresAt ?? null,
    tokenExpiringSoon: expiresAt ? expiresAt - now < REFRESH_WHEN_EXPIRING_WITHIN_MS : null,
    webhookSubscribed: Boolean(account.webhookSubscribed),
    webhookError: account.webhookError ?? null,
    connectedAt: account.connectedAt ?? null,
    lastConversationsSyncAt: account.lastConversationsSyncAt ?? null,
    lastMediaSyncAt: account.lastMediaSyncAt ?? null,
    lastProfileSyncAt: account.lastProfileSyncAt ?? null,
    lastWebhookAt: account.lastWebhookAt ?? null,
    lastError: account.lastError ?? null,
    lastErrorAt: account.lastErrorAt ?? null,
  };
}

function pickParticipant(conversation, account) {
  const mine = selfIds(account);
  const list = conversation?.participants?.data ?? [];
  const other =
    list.find((p) => !mine.has(String(p.id)) && p.username !== account.username) ?? list.find((p) => !mine.has(String(p.id))) ?? {};
  return { id: other.id ? String(other.id) : null, username: other.username ?? null };
}

export function createInstagramService({
  db = defaultDb,
  api = createInstagramApi(),
  crm = defaultCrm,
  analyst = { analyseConversation },
  clock = () => Date.now(),
} = {}) {
  const nowIso = () => new Date(clock()).toISOString();

  // -------------------------------------------------------------------------
  // Tokens and errors
  // -------------------------------------------------------------------------

  async function tokenFor(account) {
    if (!account || account.status !== 'connected' || !account.tokenCiphertext) {
      throw new ServiceError(409, 'Conflict', 'This Instagram account needs to be reconnected');
    }
    if (account.tokenExpiresAt && Date.parse(account.tokenExpiresAt) <= clock()) {
      await db.updateAccount(account.tenantId, account.igUserId, {
        status: 'reconnect_required',
        lastError: 'The Instagram access token expired. Reconnect the account.',
        lastErrorAt: nowIso(),
      });
      throw new ServiceError(409, 'Conflict', 'The Instagram access token expired. Reconnect the account.');
    }
    return decryptSecret(account.tokenCiphertext);
  }

  /** Records a job failure on the account. An auth failure means reconnect. */
  async function recordFailure(account, job, err) {
    const auth = err?.kind === ERROR_KIND.AUTH;
    const message = auth
      ? 'Instagram access was revoked or expired. Reconnect the account.'
      : `${job}: ${err?.details || err?.message || 'failed'}`;
    log.warn('instagram.job_failed', { tenantId: account.tenantId, igUserId: account.igUserId, job, kind: err?.kind, code: err?.code });
    await db.updateAccount(account.tenantId, account.igUserId, {
      ...(auth && { status: 'reconnect_required' }),
      lastError: message.slice(0, 300),
      lastErrorAt: nowIso(),
    });
    return message;
  }

  // -------------------------------------------------------------------------
  // Connect / disconnect
  // -------------------------------------------------------------------------

  function startConnect({ tenantId, userId }) {
    const cfg = getConfig();
    if (!cfg.instagramConfigured) {
      throw new ServiceError(503, 'Service Unavailable', 'The Instagram app is not configured on this environment yet');
    }
    const state = signOAuthState({ tenantId, userId });
    return { authorizeUrl: api.buildAuthorizeUrl(state), redirectUri: cfg.meta.redirectUri };
  }

  async function completeConnect({ code, state }) {
    const cfg = getConfig();
    if (!cfg.instagramConfigured) {
      throw new ServiceError(503, 'Service Unavailable', 'The Instagram app is not configured on this environment yet');
    }
    const { tenantId, userId } = verifyOAuthState(state, { now: clock() });

    const short = await api.exchangeCode(code);
    const long = await api.exchangeForLongLived(short.accessToken);
    const profile = await api.getProfile(long.accessToken);

    const igUserId = String(profile.user_id ?? short.userId ?? profile.id);
    const appScopedId = profile.id ? String(profile.id) : null;
    const ids = [...new Set([igUserId, appScopedId, short.userId].filter(Boolean).map(String))];

    // One Instagram account belongs to one workspace. Letting a second agency
    // connect it would route that account's DMs to whoever connected last.
    for (const id of ids) {
      const ref = await db.findAccountRefByIgId(id);
      if (ref && ref.tenantId !== tenantId) {
        const other = await db.getAccount(ref.tenantId, ref.igUserId);
        if (other && other.status !== 'disconnected') {
          throw new ServiceError(409, 'Conflict', `@${profile.username || igUserId} is already connected to another RealtyFlow workspace`);
        }
      }
    }

    const existing = await db.getAccount(tenantId, igUserId);
    const issued = clock();
    const account = {
      ...(existing || {}),
      igUserId,
      appScopedId,
      username: profile.username ?? null,
      name: profile.name ?? null,
      accountType: profile.account_type ?? null,
      profilePictureUrl: profile.profile_picture_url ?? null,
      followersCount: profile.followers_count ?? null,
      followsCount: profile.follows_count ?? null,
      mediaCount: profile.media_count ?? null,
      status: 'connected',
      tokenCiphertext: encryptSecret(long.accessToken),
      tokenIssuedAt: new Date(issued).toISOString(),
      tokenExpiresAt: new Date(issued + (long.expiresIn || DEFAULT_TOKEN_LIFETIME_S) * 1000).toISOString(),
      scopes: short.permissions?.length ? short.permissions : cfg.meta.scopes,
      connectedAt: existing?.connectedAt || nowIso(),
      connectedBy: userId,
      disconnectedAt: null,
      lastError: null,
      lastErrorAt: null,
      // Null the job clocks so the next worker run syncs this account at once.
      lastConversationsSyncAt: null,
      lastMediaSyncAt: null,
      lastProfileSyncAt: null,
      lastCommentsSyncAt: null,
    };

    // Webhooks only deliver once the Meta app is Live; subscribing now means
    // nothing needs doing on this account when that happens. Comments need
    // Advanced Access, so a refusal falls back to messages only.
    try {
      await api.subscribeWebhooks(long.accessToken, ['messages', 'comments']);
      account.webhookSubscribed = true;
      account.webhookError = null;
    } catch (err) {
      try {
        await api.subscribeWebhooks(long.accessToken, ['messages']);
        account.webhookSubscribed = true;
        account.webhookError = `Comment webhooks unavailable: ${err.message}`.slice(0, 300);
      } catch (err2) {
        account.webhookSubscribed = false;
        account.webhookError = `Webhook subscription failed, polling instead: ${err2.message}`.slice(0, 300);
      }
    }

    await db.putAccount(tenantId, account);
    await db.registerAccount(tenantId, igUserId, ids);
    await db.putAccountSnapshots(tenantId, [
      {
        igUserId,
        date: toDateKey(clock()),
        followersCount: account.followersCount,
        followsCount: account.followsCount,
        mediaCount: account.mediaCount,
      },
    ]);
    await db.putAuditEvent(tenantId, {
      action: existing ? 'instagram.reconnected' : 'instagram.connected',
      igUserId,
      username: account.username,
      userId,
    });
    log.info('instagram.connected', { tenantId, igUserId, webhookSubscribed: account.webhookSubscribed });

    return { tenantId, account: { ...account, tenantId } };
  }

  async function disconnect({ tenantId, igUserId, userId }) {
    const account = await db.getAccount(tenantId, igUserId);
    if (!account) throw new ServiceError(404, 'Not Found', 'Instagram account not found');

    // History stays, so reconnecting later picks up where it left off. Only
    // the token and the routing pointers go.
    const updated = await db.updateAccount(tenantId, igUserId, {
      status: 'disconnected',
      tokenCiphertext: null,
      disconnectedAt: nowIso(),
      disconnectedBy: userId ?? null,
    });
    await db.unregisterAccount(tenantId, igUserId, [account.appScopedId]);
    await db.putAuditEvent(tenantId, { action: 'instagram.disconnected', igUserId, userId });
    return updated;
  }

  async function refreshTokenIfDue(account) {
    const issuedAt = Date.parse(account.tokenIssuedAt || '') || 0;
    const expiresAt = Date.parse(account.tokenExpiresAt || '') || 0;
    const now = clock();
    if (now - issuedAt < DAY_MS) return { refreshed: false, reason: 'token younger than 24h' };
    if (expiresAt && expiresAt - now > REFRESH_WHEN_EXPIRING_WITHIN_MS) return { refreshed: false, reason: 'not due' };

    const token = await tokenFor(account);
    const res = await api.refreshLongLived(token);
    await db.updateAccount(account.tenantId, account.igUserId, {
      tokenCiphertext: encryptSecret(res.accessToken),
      tokenIssuedAt: new Date(now).toISOString(),
      tokenExpiresAt: new Date(now + (res.expiresIn || DEFAULT_TOKEN_LIFETIME_S) * 1000).toISOString(),
    });
    await db.putAuditEvent(account.tenantId, { action: 'instagram.token_refreshed', igUserId: account.igUserId });
    return { refreshed: true };
  }

  // -------------------------------------------------------------------------
  // Messages -> threads
  // -------------------------------------------------------------------------

  /**
   * Stores messages for one conversation and recomputes the thread from what
   * is stored. Returns how many were new and whether any new one is inbound,
   * which is what queues the thread for analysis.
   */
  async function ingestMessages(account, { participantId, participantUsername = null, conversationId = null, sourceMediaId = null }, rows) {
    const { tenantId, igUserId } = account;
    if (!participantId) return { threadId: null, inserted: 0, newInbound: false };
    const threadId = threadIdFor(igUserId, participantId);

    const inserted = await db.putMessagesIfAbsent(
      tenantId,
      rows
        .filter((r) => r.messageId)
        .map((r) => ({ ...r, threadId, igUserId, participantId, text: String(r.text ?? '').slice(0, 4000) }))
    );
    const newInbound = inserted.some((m) => m.direction === 'in');

    const existing = await db.getThread(tenantId, threadId);
    if (inserted.length === 0 && existing && (!participantUsername || existing.participantUsername)) {
      return { threadId, inserted: 0, newInbound: false };
    }

    const messages = await db.listMessages(tenantId, threadId);
    const latest = (direction) =>
      messages.filter((m) => !direction || m.direction === direction).at(-1)?.createdAt ?? null;
    const last = messages.at(-1);

    await db.putThread(tenantId, {
      ...(existing || {}),
      threadId,
      igUserId,
      participantId,
      participantUsername: participantUsername || existing?.participantUsername || null,
      conversationId: conversationId || existing?.conversationId || null,
      sourceMediaId: existing?.sourceMediaId || sourceMediaId || null,
      messageCount: messages.length,
      lastInboundAt: latest('in'),
      lastOutboundAt: latest('out'),
      lastMessageAt: last?.createdAt ?? null,
      lastMessageText: last ? String(last.text || '').slice(0, 200) : null,
      lastMessageDirection: last?.direction ?? null,
      unanswered: last?.direction === 'in',
      // A handle arriving after the enquiry was written (webhook first, poll
      // later) is worth a re-read: it is often the only name the lead has.
      needsAnalysis:
        Boolean(existing?.needsAnalysis) ||
        newInbound ||
        Boolean(participantUsername && existing?.enquiryId && !existing?.participantUsername),
    });

    return { threadId, inserted: inserted.length, newInbound };
  }

  async function syncConversations(account, { maxPages = 2 } = {}) {
    const token = await tokenFor(account);
    const mine = selfIds(account);
    let after;
    let conversations = 0;
    let messages = 0;

    for (let page = 0; page < maxPages; page += 1) {
      const res = await api.listConversations(token, { limit: 25, after });
      let reachedUnchanged = false;

      for (const conversation of res?.data ?? []) {
        const participant = pickParticipant(conversation, account);
        if (!participant.id) continue;
        const threadId = threadIdFor(account.igUserId, participant.id);
        const thread = await db.getThread(account.tenantId, threadId);

        // Conversations come back newest-first. Once one has not changed since
        // we last read it, every older one has not either.
        if (thread?.conversationUpdatedAt && conversation.updated_time && conversation.updated_time <= thread.conversationUpdatedAt) {
          reachedUnchanged = true;
          break;
        }

        const raw = await api.getConversationMessages(token, conversation.id);
        const rows = raw.map((m) => {
          const fromId = m?.from?.id ? String(m.from.id) : null;
          const outbound = (fromId && mine.has(fromId)) || (m?.from?.username && m.from.username === account.username);
          return {
            messageId: m.id,
            direction: outbound ? 'out' : 'in',
            text: m.message ?? '',
            createdAt: m.created_time ? new Date(m.created_time).toISOString() : nowIso(),
            senderId: fromId,
            source: 'poll',
          };
        });
        const result = await ingestMessages(
          account,
          { participantId: participant.id, participantUsername: participant.username, conversationId: conversation.id },
          rows
        );
        await db.updateThread(account.tenantId, threadId, { conversationUpdatedAt: conversation.updated_time ?? null });
        conversations += 1;
        messages += result.inserted;
      }

      after = res?.paging?.cursors?.after;
      if (reachedUnchanged || !res?.paging?.next || !after) break;
    }

    return { conversations, messages };
  }

  // -------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------

  // Webhooks carry only the sender's Instagram-scoped id. Looking the handle up
  // once per thread lets the inbox and the analysis use a name straight away;
  // the next poll would fill it in anyway, so a failure here is not an error.
  async function usernameFor(account, participantId) {
    const existing = await db.getThread(account.tenantId, threadIdFor(account.igUserId, participantId));
    if (existing?.participantUsername) return existing.participantUsername;
    try {
      const profile = await api.getMessagingUser(await tokenFor(account), participantId);
      return profile?.username ?? null;
    } catch {
      return null;
    }
  }

  async function ingestWebhook(payload) {
    const summary = { entries: 0, messages: 0, comments: 0, ignored: 0 };
    if (payload?.object && payload.object !== 'instagram') return summary;

    for (const entry of payload?.entry ?? []) {
      summary.entries += 1;
      const ref = await db.findAccountRefByIgId(entry?.id);
      const account = ref ? await db.getAccount(ref.tenantId, ref.igUserId) : null;
      if (!account || account.status === 'disconnected') {
        summary.ignored += 1;
        continue;
      }
      const mine = selfIds(account);
      mine.add(String(entry.id));

      for (const event of entry.messaging ?? []) {
        const message = event?.message;
        if (!message?.mid || message.is_deleted) {
          summary.ignored += 1;
          continue;
        }
        const senderId = event.sender?.id ? String(event.sender.id) : null;
        const recipientId = event.recipient?.id ? String(event.recipient.id) : null;
        const outbound = Boolean(message.is_echo) || (senderId && mine.has(senderId));
        const participantId = outbound ? recipientId : senderId;
        if (!participantId || mine.has(participantId)) {
          summary.ignored += 1;
          continue;
        }
        const text = message.text ?? (message.attachments?.length ? '[attachment]' : '');
        const participantUsername = await usernameFor(account, participantId);
        const { inserted } = await ingestMessages(account, { participantId, participantUsername }, [
          {
            messageId: message.mid,
            direction: outbound ? 'out' : 'in',
            text,
            createdAt: new Date(Number(event.timestamp) || clock()).toISOString(),
            senderId,
            source: 'webhook',
          },
        ]);
        summary.messages += inserted;
      }

      for (const change of entry.changes ?? []) {
        if (change?.field !== 'comments' || !change.value?.id) continue;
        const v = change.value;
        await handleComment(account, {
          commentId: String(v.id),
          text: v.text ?? '',
          fromId: v.from?.id ? String(v.from.id) : null,
          fromUsername: v.from?.username ?? null,
          mediaId: v.media?.id ? String(v.media.id) : null,
          createdAt: new Date((Number(entry.time) || clock() / 1000) * (Number(entry.time) > 1e12 ? 1 : 1000)).toISOString(),
        });
        summary.comments += 1;
      }

      await db.updateAccount(account.tenantId, account.igUserId, { lastWebhookAt: nowIso() });
    }
    return summary;
  }

  // -------------------------------------------------------------------------
  // Analysis -> enquiry -> CRM
  // -------------------------------------------------------------------------

  async function promoteEnquiry(tenantId, enquiry, { force = false } = {}) {
    const cfg = getConfig();
    const previous = enquiry.crmSync || null;
    let crmSync;

    if (!cfg.promoteEnquiriesToLeads) {
      crmSync = { status: 'disabled' };
    } else if (!enquiry.phone) {
      crmSync = { status: 'waiting_for_phone' };
    } else if (!enquiry.intent || enquiry.intent === 'unknown') {
      crmSync = { status: 'needs_intent' };
    } else if (!force && previous?.phone === enquiry.phone && ['created', 'updated', 'duplicate'].includes(previous.status)) {
      return previous;
    } else {
      // The CRM requires a name. A handle, or a plain label, beats losing a lead
      // who shared their number; the agent can correct it in the CRM.
      const named = { ...enquiry, name: enquiry.name || (enquiry.igUsername ? `@${enquiry.igUsername}` : 'Instagram lead') };
      const res = await crm.forwardEnquiriesToCrm(tenantId, [named]);
      const item = res.results?.[0] ?? {};
      crmSync = {
        status: res.reason === 'not_configured'
          ? 'not_configured'
          : !res.forwarded
            ? 'failed'
            : item.created
              ? 'created'
              : item.updated
                ? 'updated'
                : item.duplicate
                  ? 'duplicate'
                  : item.skipped || !res.results?.length
                    ? 'skipped'
                    : 'failed',
        leadId: item.leadId ?? null,
        reason: item.reason ?? res.reason ?? null,
        phone: enquiry.phone,
      };
    }

    const next = { ...crmSync, at: nowIso() };
    if (previous?.status !== next.status || previous?.leadId !== next.leadId || force) {
      await db.updateEnquiry(tenantId, enquiry.enquiryId, { crmSync: next });
    }
    return next;
  }

  async function analyseThread(account, thread) {
    const { tenantId } = account;
    const messages = await db.listMessages(tenantId, thread.threadId);
    const analysis = await analyst.analyseConversation({
      messages,
      participantUsername: thread.participantUsername,
      now: clock(),
    });

    if (!analysis) {
      await db.updateThread(tenantId, thread.threadId, { needsAnalysis: false });
      return { threadId: thread.threadId, enquiry: null };
    }

    await db.updateThread(tenantId, thread.threadId, {
      needsAnalysis: false,
      analysis: {
        analyser: analysis.analyser,
        leadScore: analysis.leadScore,
        leadType: analysis.leadType,
        temperature: analysis.temperature,
        summary: analysis.summary,
        nextAction: analysis.nextAction,
        suggestedReply: analysis.suggestedReply,
        needsReview: analysis.needsReview,
        isLead: analysis.isLead,
        analysedAt: analysis.analysedAt,
      },
    });

    if (!analysis.isLead) return { threadId: thread.threadId, enquiry: null };

    const enquiryId = `ig_${thread.threadId}`;
    const existing = await db.getEnquiry(tenantId, enquiryId);
    const enquiry = {
      enquiryId,
      igUserId: account.igUserId,
      threadId: thread.threadId,
      igSenderId: thread.participantId,
      igUsername: thread.participantUsername ?? null,
      name: analysis.name,
      // A number captured once is not forgotten because a later message lacks it.
      phone: analysis.phone || existing?.phone || null,
      intent: analysis.intent,
      temperature: analysis.temperature,
      leadScore: analysis.leadScore,
      leadType: analysis.leadType,
      dealType: analysis.dealType,
      propertyType: analysis.propertyType,
      preferredArea: analysis.locality || null,
      city: analysis.city || null,
      budgetText: analysis.budgetText,
      budgetBracket: analysis.budgetBracket,
      budgetRupees: analysis.budgetRupees ?? null,
      summary: analysis.summary,
      nextAction: analysis.nextAction,
      suggestedReply: analysis.suggestedReply,
      meetingSchedule: analysis.meetingSchedule,
      meetingDatetime: analysis.meetingDatetime,
      callRequested: analysis.callRequested,
      needsReview: analysis.needsReview,
      analyser: analysis.analyser,
      sourceMediaId: thread.sourceMediaId ?? null,
      // Human-owned fields survive re-analysis.
      status: existing?.status || 'new',
      notes: existing?.notes ?? null,
      crmSync: existing?.crmSync ?? null,
      createdAt: existing?.createdAt || thread.firstSeenAt || nowIso(),
    };
    await db.putEnquiry(tenantId, enquiry);
    await db.updateThread(tenantId, thread.threadId, { enquiryId });

    let crmSync = enquiry.crmSync;
    try {
      crmSync = await promoteEnquiry(tenantId, enquiry);
    } catch (err) {
      log.error('instagram.promote_failed', { tenantId, enquiryId, error: err.message });
    }
    return { threadId: thread.threadId, enquiry: { ...enquiry, crmSync } };
  }

  async function analysePendingThreads(account, { limit = getConfig().worker.analysisBatch } = {}) {
    const threads = await db.listThreads(account.tenantId, { igUserId: account.igUserId });
    const pending = threads.filter((t) => t.needsAnalysis).slice(0, limit);
    const results = [];
    for (const thread of pending) results.push(await analyseThread(account, thread));
    return { analysed: results.length, enquiries: results.filter((r) => r.enquiry).length };
  }

  // -------------------------------------------------------------------------
  // Replies from the console
  // -------------------------------------------------------------------------

  async function sendReply({ tenantId, userId, threadId, text }) {
    const cfg = getConfig();
    const body = clampMessage(text);
    if (!body) throw new ServiceError(400, 'Bad Request', 'Message text is required');
    if (cfg.killSwitch) throw new ServiceError(423, 'Locked', 'Sending is paused for this environment (kill switch)');

    const thread = await db.getThread(tenantId, threadId);
    if (!thread) throw new ServiceError(404, 'Not Found', 'Thread not found');
    const account = await db.getAccount(tenantId, thread.igUserId);
    if (!account || account.status !== 'connected') {
      throw new ServiceError(409, 'Conflict', 'This Instagram account is not connected');
    }

    const verdict = canSend({ kind: 'dm', thread }, clock());
    if (!verdict.allowed) {
      await db.putAuditEvent(tenantId, { action: 'message.blocked', threadId, windowState: verdict.state, userId });
      throw new ServiceError(409, 'Conflict', verdict.reason);
    }

    let messageId;
    let status = 'sent';
    if (cfg.sends.dryRun) {
      messageId = `dryrun_${crypto.randomUUID()}`;
      status = 'dry_run';
    } else {
      const token = await tokenFor(account);
      try {
        const res = await api.sendMessage(token, { recipientId: thread.participantId, text: body });
        messageId = res?.message_id || `sent_${crypto.randomUUID()}`;
      } catch (err) {
        if (err.kind === ERROR_KIND.WINDOW_BLOCKED) {
          // Meta is authoritative. Close the thread; never retry a blocked send.
          await db.updateThread(tenantId, threadId, { windowClosedAt: nowIso() });
          await db.putAuditEvent(tenantId, { action: 'message.blocked_by_meta', threadId, code: err.code, userId });
          throw new ServiceError(409, 'Conflict', 'Instagram says the messaging window for this person is closed');
        }
        await recordFailure(account, 'send', err);
        throw new ServiceError(502, 'Bad Gateway', `Instagram refused the message: ${err.message}`);
      }
    }

    await ingestMessages(account, { participantId: thread.participantId }, [
      { messageId, direction: 'out', text: body, createdAt: nowIso(), source: 'console', status, sentBy: userId ?? null },
    ]);
    await db.putAuditEvent(tenantId, { action: status === 'dry_run' ? 'message.dry_run' : 'message.sent', threadId, userId });

    return { messageId, status, thread: db.withWindow(await db.getThread(tenantId, threadId), clock()) };
  }

  // -------------------------------------------------------------------------
  // Comments + keyword rules
  // -------------------------------------------------------------------------

  async function autoReplyAllowance(account) {
    const cfg = getConfig();
    const fresh = await db.getAccount(account.tenantId, account.igUserId);
    const windowStart = Date.parse(fresh?.autoReplyWindowStart || '') || 0;
    const inWindow = clock() - windowStart < HOUR_MS;
    const count = inWindow ? Number(fresh?.autoReplyCount || 0) : 0;
    return {
      allowed: count < cfg.sends.maxAutoRepliesPerHour,
      record: () =>
        db.updateAccount(account.tenantId, account.igUserId, {
          autoReplyWindowStart: inWindow ? fresh.autoReplyWindowStart : nowIso(),
          autoReplyCount: count + 1,
        }),
    };
  }

  async function handleComment(account, comment, { rules } = {}) {
    const cfg = getConfig();
    const { tenantId, igUserId } = account;
    const mine = selfIds(account);

    // Our own comments never trigger anything.
    if ((comment.fromId && mine.has(comment.fromId)) || (comment.fromUsername && comment.fromUsername === account.username)) {
      return { status: 'own_comment' };
    }

    const claimed = await db.claimComment(tenantId, {
      commentId: comment.commentId,
      igUserId,
      mediaId: comment.mediaId,
      fromId: comment.fromId,
      fromUsername: comment.fromUsername,
      text: String(comment.text || '').slice(0, 500),
      commentCreatedAt: comment.createdAt,
      status: 'seen',
    });
    if (!claimed) return { status: 'already_seen' };

    // Remember who commented where, so a DM that follows is attributed to the reel.
    if (comment.fromId) {
      const threadId = threadIdFor(igUserId, comment.fromId);
      const thread = await db.getThread(tenantId, threadId);
      await db.putThread(tenantId, {
        messageCount: 0,
        unanswered: false,
        needsAnalysis: false,
        ...(thread || {}),
        threadId,
        igUserId,
        participantId: comment.fromId,
        participantUsername: thread?.participantUsername || comment.fromUsername || null,
        sourceMediaId: thread?.sourceMediaId || comment.mediaId || null,
        lastCommentAt: comment.createdAt,
      });
    }

    const activeRules = rules ?? (await db.listRules(tenantId));
    const rule = findRule(comment.text, comment.mediaId, activeRules);
    if (!rule) {
      await db.updateComment(tenantId, comment.commentId, { status: 'no_rule' });
      return { status: 'no_rule' };
    }
    if (!cfg.sends.autoRulesEnabled || cfg.killSwitch) {
      await db.updateComment(tenantId, comment.commentId, { status: 'paused', ruleId: rule.ruleId });
      return { status: 'paused' };
    }
    const allowance = await autoReplyAllowance(account);
    if (!allowance.allowed) {
      await db.updateComment(tenantId, comment.commentId, { status: 'rate_capped', ruleId: rule.ruleId });
      return { status: 'rate_capped' };
    }

    const outcome = { status: cfg.sends.dryRun ? 'dry_run' : 'replied', ruleId: rule.ruleId, privateReply: null, publicReply: null };
    const token = cfg.sends.dryRun ? null : await tokenFor(account);

    if (rule.dmMessage) {
      const verdict = canSend({ kind: 'private_reply', commentCreatedAt: comment.createdAt }, clock());
      if (!verdict.allowed) {
        outcome.privateReply = `skipped: ${verdict.reason}`;
      } else {
        try {
          const text = clampMessage(rule.dmMessage);
          const res = cfg.sends.dryRun ? { message_id: `dryrun_pr_${comment.commentId}` } : await api.sendMessage(token, { commentId: comment.commentId, text });
          outcome.privateReply = 'sent';
          if (comment.fromId) {
            await ingestMessages(account, { participantId: comment.fromId, participantUsername: comment.fromUsername, sourceMediaId: comment.mediaId }, [
              {
                messageId: res?.message_id || `pr_${comment.commentId}`,
                direction: 'out',
                text,
                createdAt: nowIso(),
                source: 'rule',
                status: cfg.sends.dryRun ? 'dry_run' : 'sent',
                ruleId: rule.ruleId,
              },
            ]);
          }
        } catch (err) {
          outcome.privateReply = `failed: ${err.message}`;
          outcome.status = 'failed';
        }
      }
    }

    if (rule.publicReply) {
      try {
        if (!cfg.sends.dryRun) await api.replyToComment(token, comment.commentId, clampMessage(rule.publicReply));
        outcome.publicReply = 'sent';
      } catch (err) {
        outcome.publicReply = `failed: ${err.message}`;
        outcome.status = 'failed';
      }
    }

    await allowance.record();
    await db.updateComment(tenantId, comment.commentId, { ...outcome, actedAt: nowIso() });
    await db.putAuditEvent(tenantId, { action: 'rule.fired', ruleId: rule.ruleId, commentId: comment.commentId, outcome: outcome.status });
    return outcome;
  }

  async function syncComments(account, { maxMedia = 10 } = {}) {
    const rules = (await db.listRules(account.tenantId)).filter((r) => r.enabled !== false);
    if (rules.length === 0) return { skipped: 'no_rules' };

    const token = await tokenFor(account);
    const media = (await db.listMedia(account.tenantId))
      .filter((m) => m.igUserId === account.igUserId)
      .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')))
      .slice(0, maxMedia);

    let seen = 0;
    let acted = 0;
    for (const m of media) {
      const res = await api.listComments(token, m.mediaId);
      for (const c of res?.data ?? []) {
        const createdAt = c.timestamp ? new Date(c.timestamp).toISOString() : nowIso();
        // Older than 7 days cannot be privately replied to; nothing to do.
        if (clock() - Date.parse(createdAt) > COMMENT_REPLY_WINDOW_MS) continue;
        seen += 1;
        const outcome = await handleComment(
          account,
          {
            commentId: String(c.id),
            text: c.text ?? '',
            fromId: c.from?.id ? String(c.from.id) : null,
            fromUsername: c.from?.username ?? c.username ?? null,
            mediaId: m.mediaId,
            createdAt,
          },
          { rules }
        );
        if (['replied', 'dry_run', 'failed'].includes(outcome.status)) acted += 1;
      }
    }
    return { media: media.length, seen, acted };
  }

  // -------------------------------------------------------------------------
  // Media, insights, profile
  // -------------------------------------------------------------------------

  async function syncMedia(account, { insightsLimit = 10, insightsDays = 30 } = {}) {
    const token = await tokenFor(account);
    const res = await api.listMedia(token, { limit: 25 });
    const items = res?.data ?? [];
    const date = toDateKey(clock());
    const existing = new Map((await db.listMedia(account.tenantId)).map((m) => [m.mediaId, m]));

    const rows = [];
    const snapshots = [];
    let measured = 0;

    for (const m of items) {
      const mediaId = String(m.id);
      const publishedAt = m.timestamp ? new Date(m.timestamp).toISOString() : null;
      const prior = existing.get(mediaId);
      const metrics = { ...(prior?.metrics || {}), likes: m.like_count ?? prior?.metrics?.likes, comments: m.comments_count ?? prior?.metrics?.comments };
      let metricsUpdatedAt = prior?.metricsUpdatedAt ?? null;

      const recent = publishedAt && clock() - Date.parse(publishedAt) < insightsDays * DAY_MS;
      if (recent && measured < insightsLimit) {
        try {
          const insights = await api.getMediaInsights(token, mediaId);
          const v = insights.values;
          Object.assign(metrics, {
            views: v.views ?? metrics.views,
            reach: v.reach ?? metrics.reach,
            likes: v.likes ?? metrics.likes,
            comments: v.comments ?? metrics.comments,
            saved: v.saved ?? metrics.saved,
            shares: v.shares ?? metrics.shares,
            totalInteractions: v.total_interactions ?? metrics.totalInteractions,
          });
          metricsUpdatedAt = nowIso();
          snapshots.push({ mediaId, igUserId: account.igUserId, date, ...metrics });
          measured += 1;
        } catch (err) {
          if (err.kind === ERROR_KIND.RATE_LIMIT || err.kind === ERROR_KIND.AUTH) throw err;
          log.warn('instagram.media_insights_failed', { mediaId, kind: err.kind });
        }
      }

      rows.push({
        mediaId,
        igUserId: account.igUserId,
        caption: m.caption ?? null,
        permalink: m.permalink ?? null,
        mediaType: m.media_type ?? null,
        mediaProductType: m.media_product_type ?? null,
        publishedAt,
        thumbnailUrl: m.thumbnail_url ?? (m.media_type === 'IMAGE' ? m.media_url : null) ?? null,
        metrics,
        commentCount: m.comments_count ?? prior?.commentCount ?? 0,
        metricsUpdatedAt,
      });
    }

    await db.putMediaItems(account.tenantId, rows);
    await db.putMediaSnapshots(account.tenantId, snapshots);
    return { media: rows.length, measured };
  }

  async function syncProfile(account) {
    const token = await tokenFor(account);
    const profile = await api.getProfile(token);
    let insights = { values: {} };
    try {
      insights = await api.getAccountInsights(token);
    } catch (err) {
      if (err.kind === ERROR_KIND.RATE_LIMIT || err.kind === ERROR_KIND.AUTH) throw err;
      log.warn('instagram.account_insights_failed', { igUserId: account.igUserId, kind: err.kind });
    }
    const v = insights.values;
    await db.putAccountSnapshots(account.tenantId, [
      {
        igUserId: account.igUserId,
        date: toDateKey(clock()),
        followersCount: profile.followers_count ?? null,
        followsCount: profile.follows_count ?? null,
        mediaCount: profile.media_count ?? null,
        reach: v.reach ?? null,
        views: v.views ?? null,
        accountsEngaged: v.accounts_engaged ?? null,
        totalInteractions: v.total_interactions ?? null,
        profileLinksTaps: v.profile_links_taps ?? null,
      },
    ]);
    await db.updateAccount(account.tenantId, account.igUserId, {
      username: profile.username ?? account.username,
      name: profile.name ?? account.name,
      profilePictureUrl: profile.profile_picture_url ?? account.profilePictureUrl,
      followersCount: profile.followers_count ?? account.followersCount,
      followsCount: profile.follows_count ?? account.followsCount,
      mediaCount: profile.media_count ?? account.mediaCount,
    });
    return { followers: profile.followers_count ?? null };
  }

  // -------------------------------------------------------------------------
  // Meta callbacks
  // -------------------------------------------------------------------------

  async function accountFromSignedRequest(signedRequest) {
    const payload = parseSignedRequest(signedRequest, getConfig().meta.appSecret);
    if (!payload?.user_id) throw new ServiceError(400, 'Bad Request', 'Invalid signed_request');
    const ref = await db.findAccountRefByIgId(String(payload.user_id));
    const account = ref ? await db.getAccount(ref.tenantId, ref.igUserId) : null;
    return { payload, ref, account };
  }

  async function deauthorize(signedRequest) {
    const { ref, account } = await accountFromSignedRequest(signedRequest);
    if (!ref || !account) return { found: false };
    await db.updateAccount(ref.tenantId, ref.igUserId, {
      status: 'disconnected',
      tokenCiphertext: null,
      disconnectedAt: nowIso(),
      deauthorizedAt: nowIso(),
    });
    await db.unregisterAccount(ref.tenantId, ref.igUserId, [account.appScopedId]);
    await db.putAuditEvent(ref.tenantId, { action: 'instagram.deauthorized', igUserId: ref.igUserId });
    return { found: true };
  }

  async function requestDataDeletion(signedRequest) {
    const cfg = getConfig();
    const { payload, ref, account } = await accountFromSignedRequest(signedRequest);
    const code = crypto.randomBytes(12).toString('hex');
    let deleted = 0;

    if (ref) {
      deleted = await db.deleteAccountData(ref.tenantId, ref.igUserId);
      await db.unregisterAccount(ref.tenantId, ref.igUserId, [account?.appScopedId]);
      await db.putAuditEvent(ref.tenantId, { action: 'instagram.data_deleted', igUserId: ref.igUserId, items: deleted, code });
    }
    await db.putDeletionRequest(code, {
      status: 'completed',
      found: Boolean(ref),
      itemsDeleted: deleted,
      metaUserId: String(payload.user_id),
      completedAt: nowIso(),
    });

    return {
      url: `${cfg.instaApiUrl || ''}/api/insta/meta/data-deletion/status?code=${code}`,
      confirmation_code: code,
    };
  }

  return {
    startConnect,
    completeConnect,
    disconnect,
    refreshTokenIfDue,
    recordFailure,
    ingestMessages,
    syncConversations,
    ingestWebhook,
    analyseThread,
    analysePendingThreads,
    promoteEnquiry,
    sendReply,
    handleComment,
    syncComments,
    syncMedia,
    syncProfile,
    deauthorize,
    requestDataDeletion,
  };
}

export default createInstagramService;
