// Reads the currently open Instagram web DM thread straight from the DOM.
// Evaluated in the page by fetch_instagram_dms.py. Returns plain JSON.
//
// How the sender is known: every message bubble, attachments and contact cards
// included, carries hidden action buttons labelled
// "React to message from <username>". Walking the message pane in document
// order, everything seen since the previous such label belongs to the message
// that label closes. Nothing is inferred from bubble colour or position.
() => {
  const REACT = /^React to message from (.+)$/;
  const ACTION = /^(React to|Reply to|See more options for) message from /;
  const TS = [
    /^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{1,2}:\d{2}$/,   // 23 Aug 2026, 17:45
    /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}:\d{2}$/,    // Mon 18:50
    /^\d{1,2}:\d{2}$/,                                   // 05:48, today
    /^(Yesterday|Today),? (at )?\d{1,2}:\d{2}$/i,
  ];
  const NOISE = new Set([
    "seen", "new messages", "enter", "typing...", "active now", "edited",
    "whatsapp message", "whatsapp call", "view profile",
  ]);
  const PROFILE_LABEL = "Open the profile page of ";

  const header = document.querySelector('a[aria-label^="' + PROFILE_LABEL + '"]');
  const threadHandle = header
    ? header.getAttribute("aria-label").slice(PROFILE_LABEL.length).trim()
    : null;
  const requestBanner = [...document.querySelectorAll('[role="button"],button')]
    .some(b => /^(Accept|Delete|Block)$/.test((b.innerText || "").trim()));

  const firstReact = document.querySelector('[aria-label^="React to message from"]');
  let scroller = null;
  if (firstReact) {
    for (let e = firstReact.parentElement; e; e = e.parentElement) {
      const oy = getComputedStyle(e).overflowY;
      if (oy === "scroll" || oy === "auto") { scroller = e; break; }
    }
  }
  if (!scroller) {
    return { ok: false, reason: firstReact ? "no scroll container" : "no messages rendered",
             threadHandle, url: location.href, requestBanner, messages: [] };
  }

  const walker = document.createTreeWalker(
    scroller, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const messages = [];
  let currentTs = null;
  let parts = [];
  let reachedStart = false;
  let node;

  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      const inProfileLink = !!node.closest('a[aria-label^="' + PROFILE_LABEL + '"]');
      if (tag === "a" && !inProfileLink) {
        const href = (node.getAttribute("href") || "").split("?")[0];
        let m;
        if ((m = href.match(/^\/(reel|reels|p|stories)\/[^/]+/))) {
          parts.push({ kind: "media", text: "[shared " + (m[1] === "p" ? "post" : m[1].replace(/s$/, "")) + " https://www.instagram.com" + href + "]" });
        } else if ((m = href.match(/^\/([A-Za-z0-9._]{1,40})\/$/)) && !node.getAttribute("aria-label")) {
          parts.push({ kind: "share", user: m[1] });
        }
      } else if (tag === "video") {
        parts.push({ kind: "media", text: "[video]" });
      } else if (tag === "audio") {
        parts.push({ kind: "media", text: "[voice message]" });
      } else if (tag === "img" && !inProfileLink && node.closest('[role="presentation"]')) {
        parts.push({ kind: "media", text: "[image]" });
      }

      const label = node.getAttribute("aria-label");
      if (!label) continue;
      const m = label.match(REACT);
      if (!m || node.parentElement.closest('[aria-label^="React to message from"]')) continue;

      const shares = parts.filter(p => p.kind === "share").map(p => p.user);
      let lines = parts.filter(p => p.kind === "text").map(p => p.text)
        .filter(t => !shares.includes(t));
      const media = [...new Set(parts.filter(p => p.kind === "media").map(p => p.text))];
      if (shares.length) media.unshift("[shared post from @" + shares[0] + "]");
      // A shared reel already names its link; a bare [image] beside it is the thumbnail.
      const hasShare = media.some(t => t.startsWith("[shared"));
      const mediaOut = hasShare ? media.filter(t => t !== "[image]" && t !== "[video]") : media;
      if (!lines.length && !mediaOut.length) lines = ["[attachment]"];

      messages.push({
        sender: m[1].trim(),
        timestamp_label: currentTs,
        text: mediaOut.concat(lines).join("\n"),
        reply_context: parts.filter(p => p.kind === "reply_marker" || p.kind === "reply_context")
          .map(p => p.text).join(" / "),
      });
      parts = [];
      continue;
    }

    const raw = (node.textContent || "").trim();
    if (!raw) continue;
    const el = node.parentElement;
    if (!el || el.closest("svg")) continue;
    if (ACTION.test(raw)) continue;
    if (raw === "View Profile" || / · Instagram$/.test(raw)) {
      // Profile card that Instagram renders above the first message of a thread.
      parts = [];
      reachedStart = true;
      continue;
    }
    if (NOISE.has(raw.toLowerCase())) continue;
    if (TS.some(r => r.test(raw))) { currentTs = raw; continue; }
    if (/ replied to /i.test(raw)) { parts.push({ kind: "reply_marker", text: raw }); continue; }
    const inBubble = !!el.closest('[role="presentation"]');
    if (!inBubble && parts.some(p => p.kind === "reply_marker")) {
      parts.push({ kind: "reply_context", text: raw });
      continue;
    }
    parts.push({ kind: "text", text: raw });
  }

  return {
    ok: true,
    url: location.href,
    threadHandle,
    requestBanner,
    reachedStart,
    scrollTop: scroller.scrollTop,
    scrollHeight: scroller.scrollHeight,
    clientHeight: scroller.clientHeight,
    messages,
  };
}
