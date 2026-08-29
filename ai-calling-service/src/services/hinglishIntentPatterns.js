/**
 * Hinglish intent patterns for the Exotel voice agent (Phase 5c).
 *
 * THE PROBLEM: `intentService.classifyIntent` matched English regexes only.
 * A caller saying "kiraya kitna hai?" or "flat dekhna hai" matched nothing and
 * fell through to SMALL_TALK — the agent answered a pricing question with
 * chit-chat. For a product whose ICP is Indian real-estate agents and whose
 * every other surface is explicitly Hinglish, that is the majority case, not
 * an edge case.
 *
 * WHY REGEX AND NOT A MODEL: this is the realtime voice path (Mode C in
 * flows/05-voice-exotel.md). Its latency budget is a caller waiting in silence
 * on a phone call, so an LLM round-trip per turn is a real cost, not a
 * rounding error. The plan calls for regex first — "cheap, may be sufficient"
 * — with a small-model fallback only if it is not. These patterns are that
 * first step. See the note at the foot of this file on the fallback.
 *
 * ORDERING: these merge into the existing priority-ordered array, so an
 * earlier intent wins a tie. That ordering is load-bearing — see the
 * collision notes on individual patterns below.
 *
 * SCRIPT: romanised Hinglish is matched primarily, because that is what
 * Indian-English ASR usually emits. High-value Devanagari forms are included
 * where a transcriber is configured for Hindi output.
 */

/**
 * Extra patterns per intent, keyed by INTENT_TYPES value.
 * @type {Record<string, RegExp[]>}
 */
export const HINGLISH_PATTERNS = {
  HANDOFF_HUMAN: [
    // "kisi insaan se baat karao", "agent se baat karni hai", "manager se baat"
    /(?:kisi|koi|insaan|aadmi|banda|agent|manager|sir|madam)\s*se\s*baat/i,
    /baat\s*kara(?:o|do|dijiye|iye)/i,
    /(?:transfer|connect)\s*kar(?:o|do|iye)/i,
    /असली\s*(?:आदमी|व्यक्ति)|किसी\s*से\s*बात/i,
  ],

  CALL_END: [
    // COLLISION NOTE: "chahiye" alone means "I want" (PROPERTY_AVAILABILITY).
    // Only the negated forms end the call, so these all require the negation.
    /(?:nahi|nahin|nai)\s*(?:chahiye|chahie|karna|karni)/i,
    // "bas", "bas itna hi", "theek hai bas", "ho gaya". Anchored to the end of
    // the utterance and bounded to a few filler words, so "bas station ke paas
    // flat chahiye" (a location, not a sign-off) cannot match.
    /\b(?:bas|ho\s*gaya|theek\s*hai)\b(?:\s+(?:itna|hi|bas|thanks?|shukriya|dhanyavaad|theek|thik)){0,3}\s*[.!]*$/i,
    /(?:rakhta|rakhti)\s*(?:hoon|hu|hun)/i,
    /(?:phone|call)\s*(?:band|rakh|kaat)/i,
    /(?:shukriya|dhanyavaad|dhanyawad)/i,
    /(?:अलविदा|धन्यवाद|बस\s*इतना)/i,
  ],

  SCHEDULE_SITE_VISIT: [
    // COLLISION NOTE: must be checked BEFORE PROPERTY_DETAILS, because
    // "dekhna hai" (want to view) and "dekhna" inside "detail dekhna" overlap.
    // The existing array already orders site-visit above details.
    /(?:dekhne|dekhna|dekhne\s*ke\s*liye)\s*(?:aa|aana|aaunga|aaungi|chahta|chahti|hai|hoga)/i,
    /(?:visit|site\s*visit)\s*(?:karna|karni|karenge|kar\s*sakte)/i,
    /(?:kab|kab\s*tak)\s*(?:dekh|aa)\s*sakte/i,
    /(?:ghar|flat|property|makaan|makan)\s*dekhna/i,
    /(?:aa\s*sakte\s*hain|aa\s*jaun|aa\s*jaunga)/i,
    /(?:देखने|विजिट)\s*(?:आना|करना)/i,
  ],

  PROPERTY_DETAILS: [
    /(?:detail|details|jaankari|jankari)\s*(?:batao|bataiye|do|dijiye|chahiye)/i,
    /(?:iske|uske|is|us)\s*(?:baare|bare)\s*mein\s*bat/i,
    /kaisa\s*(?:hai|ह)/i,
    /kitn[ae]\s*(?:bedroom|bathroom|kamre|kamra|bada|badi|square|sqft)/i,
    /(?:amenities|suvidha|facility|facilities)\s*(?:kya|kaun)/i,
    /(?:बताओ|जानकारी)/i,
  ],

  PROPERTY_AVAILABILITY: [
    // COLLISION NOTE: "chahiye" here is the affirmative want. The negated form
    // is caught by CALL_END above, which is checked first.
    /(?:flat|ghar|makaan|makan|property|plot|shop|office|room)\s*(?:hai\s*kya|chahiye|chaahiye|milega|mil\s*sakta)/i,
    /(?:koi|kuch|kya)\s*(?:flat|ghar|property|makaan)/i,
    /(?:khali|khaali|available|vacant)\s*(?:hai|h)/i,
    /(?:dhoondh|dhundh|dhoond|khoj)\s*rah[ae]/i,
    /(?:kiraye|kiraaye|rent)\s*(?:pe|par|ke\s*liye)/i,
    /(\d)\s*(?:bhk|b\.h\.k)/i,
    /(?:फ्लैट|घर|मकान)\s*(?:चाहिए|है)/i,
  ],

  PRICING_INFO: [
    /(?:kiraya|kiraaya|kira[yi]a|rent|price|rate|daam|keemat|kimat)\s*(?:kitna|kitne|kya|batao)/i,
    /kitne\s*(?:ka|ki|k[ae])\s*(?:hai|h|padega|hoga)/i,
    /(?:deposit|security|advance)\s*(?:kitna|kitne|kya)/i,
    /(?:budget|bajat)\s*(?:mein|me|kya)/i,
    /(?:mahine|maheene|monthly)\s*(?:ka|ki)\s*(?:kitna|kiraya)/i,
    /(?:कीमत|किराया|दाम)\s*(?:क्या|कितना)/i,
  ],

  FAQ_POLICY: [
    /(?:bachelor|bachelors|family|pet|non.?veg|veg)\s*(?:allowed|chalega|chalta|ho\s*sakta)/i,
    /(?:allowed|permission|ijazat)\s*(?:hai|h)\s*kya/i,
    /(?:agreement|contract|lease)\s*kitn[ae]\s*(?:saal|mahine|month|year)/i,
    /(?:maintenance|charges|charge)\s*(?:kitna|kitne|alag)/i,
    /(?:niyam|rules|policy)\s*(?:kya|kaun)/i,
  ],

  AGENCY_INFO: [
    /(?:aap|tum)\s*kaun\s*(?:hai|ho|h)/i,
    /(?:office|dukan|dukaan)\s*kahan/i,
    /(?:company|agency)\s*(?:ka|ki)\s*naam/i,
    /(?:kahan|kaha)\s*(?:pe|par)\s*(?:ho|hai|situated)/i,
  ],
};

/**
 * Merge the Hinglish patterns into an existing priority-ordered pattern list.
 *
 * Appends within each intent rather than reordering, so English matching and
 * the relative priority between intents are both byte-for-byte unchanged. A
 * transcript that classified correctly before still takes the same branch.
 *
 * @param {Array<{intent: string, patterns: RegExp[], confidence: number}>} intentPatterns
 * @returns {Array<{intent: string, patterns: RegExp[], confidence: number}>}
 */
export function withHinglishPatterns(intentPatterns) {
  return intentPatterns.map((entry) => {
    const extra = HINGLISH_PATTERNS[entry.intent];
    if (!extra || extra.length === 0) return entry;
    return { ...entry, patterns: [...entry.patterns, ...extra] };
  });
}

/*
 * ON THE SMALL-MODEL FALLBACK (deliberately not implemented here)
 *
 * The plan pairs these patterns with "a small-model structured-output fallback
 * with a hard timeout falling through to the existing SMALL_TALK default".
 * That is not in this change, for two reasons worth stating rather than
 * leaving implicit:
 *
 *   1. It cannot be verified here. There is no way to measure, in this
 *      environment, how often the regex path now misses — and a fallback whose
 *      trigger rate is unknown is an unbounded latency cost added to a live
 *      phone call.
 *   2. The plan itself says regex "may be sufficient". Shipping the cheap half
 *      first and measuring the SMALL_TALK rate in CloudWatch is the sequence
 *      it asks for, in that order.
 *
 * `withHinglishPatterns` is the seam: if the measured SMALL_TALK rate stays
 * high after this, the fallback slots in after the loop in classifyIntent
 * without touching the fast path.
 */
