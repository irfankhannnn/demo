/**
 * A6 - AI reply drafting.
 *
 * Drafts are STORED, never sent. Sending is always a separate, window-checked
 * step through engine/sender.js.
 *
 * The default drafter is deterministic and template-based, so the agent is
 * useful with no API key, no network beyond Meta, and no per-reply cost. An LLM
 * drafter can be plugged in through the same interface when the owner wants
 * richer answers - `setDrafter()` swaps it, and everything downstream is
 * unchanged.
 */
import {
  insertDraft, supersedePendingDrafts, listMessages, getConversation, audit,
} from '../store/repos.js';
import { classifyWindow, WINDOW } from './windowClassifier.js';
import { logger } from '../util/logger.js';

const log = logger('engine/drafter');

/**
 * Categories the template drafter recognises. Order matters - the first match
 * wins, and the more specific intents are listed before the general ones.
 */
export const CATEGORIES = [
  // Negotiation and loan come FIRST, before `price`. "last price kya hai" and
  // "home loan pe kitna" both contain price words but are not price questions -
  // they commit the broker to something, so they must not be auto-sendable.
  // Ordering is the whole mechanism here; moving these below `price` silently
  // turns them into auto-send answers.
  { name: 'negotiation', re: /\b(negotiable|negotiate|discount|last price|final price|kam ho|kam karo)\b/i, autoSendEligible: false },
  { name: 'loan', re: /\b(loan|emi|finance|bank|home loan|pre ?approval)\b/i, autoSendEligible: false },
  {
    name: 'price',
    re: /\b(price|rate|kitne|kitna|cost|budget|paisa|daam|kimat)\b/i,
    autoSendEligible: true,
  },
  {
    name: 'availability',
    re: /\b(available|avail|khali|vacant|ready|possession|kab milega)\b/i,
    autoSendEligible: true,
  },
  { name: 'location', re: /\b(location|address|kahan|where|area|pin|map)\b/i, autoSendEligible: true },
  { name: 'area_size', re: /\b(carpet|built ?up|sqft|sq ft|square feet|area kitna|size)\b/i, autoSendEligible: true },
  { name: 'parking', re: /\b(parking|car park|garage)\b/i, autoSendEligible: true },
  { name: 'floor', re: /\b(floor|manzil|which floor)\b/i, autoSendEligible: true },
  // Deliberately NOT auto-send: loan and negotiation answers commit the broker
  // to something. A human should see these before they go out.
  { name: 'site_visit', re: /\b(site visit|visit|dekhna|dekhne|viewing|showing)\b/i, autoSendEligible: false },
];

export function categorise(text) {
  if (!text) return { name: 'general', autoSendEligible: false };
  for (const c of CATEGORIES) {
    if (c.re.test(text)) return c;
  }
  return { name: 'general', autoSendEligible: false };
}

/**
 * Which language to answer in. We mirror what they wrote: replying in English to
 * someone who wrote Hindi reads as a bot, and this audience notices.
 */
export function detectLanguage(text) {
  if (!text) return 'en';
  if (/[ऀ-ॿ]/.test(text)) return 'hi';        // Devanagari
  const hinglish = /\b(hai|hain|kya|kitne|kitna|chahiye|karo|kar|mujhe|aap|bhai|nahi|acha|theek|batao|dena|milega)\b/i;
  return hinglish.test(text) ? 'hinglish' : 'en';
}

const TEMPLATES = {
  price: {
    hinglish: 'Ji haan! Is property ka price {price} hai. Aapka budget kitna hai? Main uske hisaab se 2-3 aur options bhej deta hoon.',
    en: 'Hi! This one is priced at {price}. What budget range are you looking at? I can share a couple of matching options.',
    hi: 'जी हाँ! इस property की कीमत {price} है। आपका बजट क्या है? मैं उसी हिसाब से options भेज देता हूँ।',
  },
  availability: {
    hinglish: 'Haan ji, abhi available hai. Aap kab tak shift karna chahte ho?',
    en: 'Yes, it is available right now. When are you looking to move in?',
    hi: 'जी हाँ, अभी available है। आप कब तक shift करना चाहते हैं?',
  },
  location: {
    hinglish: 'Property {area} me hai. Aap kis area me dekh rahe ho?',
    en: 'This one is in {area}. Which areas are you considering?',
    hi: 'यह property {area} में है। आप किस area में देख रहे हैं?',
  },
  area_size: {
    hinglish: 'Carpet area {carpet} hai. Aapko kitna chahiye - 1BHK, 2BHK ya 3BHK?',
    en: 'The carpet area is {carpet}. What configuration are you after - 1BHK, 2BHK or 3BHK?',
    hi: 'Carpet area {carpet} है। आपको कितना चाहिए - 1BHK, 2BHK या 3BHK?',
  },
  parking: {
    hinglish: 'Ji haan, parking included hai. Aur koi requirement ho toh batao.',
    en: 'Yes, parking is included. Let me know if you have any other requirements.',
    hi: 'जी हाँ, parking included है। और कोई requirement हो तो बताइए।',
  },
  floor: {
    hinglish: 'Ye {floor} floor pe hai, lift available hai. Aapko konsa floor prefer hai?',
    en: 'It is on the {floor} floor with lift access. Any floor preference?',
    hi: 'यह {floor} floor पर है, lift available है। आपको कौन सा floor पसंद है?',
  },
  loan: {
    hinglish: 'Haan ji, loan me poori help karenge - humara tie-up hai major banks ke saath. Aapka budget aur area bata dijiye, main details bhejta hoon.',
    en: 'Yes, we help with the loan process end to end and work with the major banks. Share your budget and preferred area and I will send the details.',
    hi: 'जी हाँ, loan में पूरी help करेंगे। आपका बजट और area बताइए, मैं details भेजता हूँ।',
  },
  negotiation: {
    hinglish: 'Price pe baat ho sakti hai. Aap ek baar property dekh lijiye, phir owner se discuss karte hain. Kab visit karna chahenge?',
    en: 'There is some room to discuss on price. Let us get you a viewing first, then take it up with the owner. When would suit you?',
    hi: 'Price पर बात हो सकती है। पहले एक बार property देख लीजिए, फिर owner से discuss करते हैं।',
  },
  site_visit: {
    hinglish: 'Bilkul! Site visit arrange kar dete hain. Weekday ya weekend - aapko kab convenient rahega?',
    en: 'Absolutely, I can arrange a site visit. Would a weekday or the weekend suit you better?',
    hi: 'बिल्कुल! Site visit arrange कर देते हैं। Weekday या weekend - कब convenient रहेगा?',
  },
  general: {
    hinglish: 'Thank you for reaching out! Aap kya dhundh rahe ho - buy ya rent? Aur kis area me? Main options bhej deta hoon.',
    en: 'Thanks for getting in touch! Are you looking to buy or rent, and in which area? I will send across some options.',
    hi: 'संपर्क करने के लिए धन्यवाद! आप buy कर रहे हैं या rent? और किस area में?',
  },
};

function fill(template, facts) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    const v = facts?.[key];
    // An unfilled placeholder would be embarrassing in a customer-facing reply,
    // so fall back to vaguer but correct wording.
    if (v == null || v === '') {
      return { price: 'is range me', area: 'is area', carpet: 'good size', floor: 'a mid' }[key] ?? '';
    }
    return String(v);
  });
}

/** The default drafter. Pure - same inputs give the same output, so it is testable. */
export function templateDrafter({ text, facts = {} }) {
  const category = categorise(text);
  const language = detectLanguage(text);
  const bundle = TEMPLATES[category.name] ?? TEMPLATES.general;
  const body = fill(bundle[language] ?? bundle.hinglish, facts);

  return {
    body,
    category: category.name,
    language,
    drafter: 'template',
    model: null,
    confidence: category.name === 'general' ? 0.4 : 0.75,
    autoSendEligible: category.autoSendEligible,
    rationale: `matched category "${category.name}", language "${language}"`,
  };
}

let activeDrafter = templateDrafter;

/** Swap in an LLM-backed drafter. Must return the same shape as templateDrafter. */
export function setDrafter(fn) {
  activeDrafter = typeof fn === 'function' ? fn : templateDrafter;
}
export function getDrafter() {
  return activeDrafter;
}

/**
 * Draft a reply for one conversation.
 *
 * A draft is only produced for a thread we could actually reply to. Drafting for
 * a CLOSED thread would put a Send button in front of the owner that can never
 * work - the honest answer there is the Story CTA (F25), not a dead draft.
 */
export async function draftForConversation(ctx, conversationId, { facts = {}, force = false } = {}) {
  const conversation = getConversation(conversationId, ctx.db);
  if (!conversation) return null;

  const w = classifyWindow(conversation);
  if (w.state === WINDOW.CLOSED && !force) {
    log.debug('skipping draft for CLOSED thread', { conversationId });
    return null;
  }

  const messages = listMessages(conversationId, 50, ctx.db);
  const lastInbound = [...messages].reverse().find((m) => m.direction === 'in');
  if (!lastInbound) return null;

  // Their last message is already answered - nothing to draft.
  if (conversation.last_outbound_at && conversation.last_outbound_at > lastInbound.created_at) return null;

  const draftBody = await activeDrafter({
    text: lastInbound.text,
    facts,
    history: messages,
    conversation,
  });

  // One live draft per thread: a new inbound message makes the previous draft
  // stale, and showing the owner two answers to pick between is worse than one.
  supersedePendingDrafts(conversationId, ctx.db);

  const row = insertDraft({
    conversationId,
    igUserId: conversation.ig_user_id,
    triggerMessageId: lastInbound.message_id,
    body: draftBody.body,
    language: draftBody.language,
    category: draftBody.category,
    drafter: draftBody.drafter,
    model: draftBody.model,
    rationale: draftBody.rationale,
    confidence: draftBody.confidence,
    // Auto-send needs BOTH a safe category and an open standard window.
    autoSendEligible: draftBody.autoSendEligible && w.state === WINDOW.STANDARD,
  }, ctx.db);

  audit({
    scope: 'drafter', action: 'draft', targetId: row.draft_id, outcome: 'ok',
    detail: `${draftBody.category}/${draftBody.language}`,
  }, ctx.db);

  return row;
}

/** Draft for every unanswered, still-open thread. */
export async function draftAll(ctx, { limit = 50, facts = {} } = {}) {
  const rows = ctx.db
    .prepare("SELECT conversation_id FROM conversations WHERE unanswered = 1 AND window_state != 'CLOSED' LIMIT ?")
    .all(limit);

  const drafts = [];
  for (const r of rows) {
    const d = await draftForConversation(ctx, r.conversation_id, { facts });
    if (d) drafts.push(d);
  }
  return { candidates: rows.length, drafted: drafts.length, drafts };
}

export default {
  templateDrafter, setDrafter, getDrafter, draftForConversation, draftAll,
  categorise, detectLanguage, CATEGORIES,
};
