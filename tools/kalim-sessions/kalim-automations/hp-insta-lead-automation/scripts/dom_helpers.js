// Small page operations used by fetch_instagram_dms.py, next to dom_thread_list.js
// and dom_extract_thread.js. One object literal so both browser drivers can load
// it: the DevTools driver evaluates it, the Chrome extension bundles it.
// Read-only apart from scrolling and clicking an inbox tab or a thread row.
({
  // Is any of these selectors on the page right now?
  hasAny: (selectors) => selectors.some(s => !!document.querySelector(s)),

  location: () => location.href,

  // Click the Primary / General inbox tab. Never anything else.
  clickTab: (label) => {
    const tab = [...document.querySelectorAll('[role="tab"]')]
      .find(t => (t.innerText || "").trim().startsWith(label));
    if (!tab) return false;
    tab.click();
    return true;
  },

  // Scroll the thread list down by most of a screen. False when it cannot move.
  scrollList: () => {
    const list = document.querySelector('[aria-label="Thread list"]') || document.body;
    for (const e of [list, ...list.querySelectorAll("div")]) {
      const oy = getComputedStyle(e).overflowY;
      if ((oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight + 4 &&
          e.querySelector('[role="button"]')) {
        const before = e.scrollTop;
        e.scrollTop = before + e.clientHeight * 0.8;
        return e.scrollTop !== before;
      }
    }
    return false;
  },

  // Click the list row with this name and preview. Never anything else.
  clickRow: ([name, preview]) => {
    const list = document.querySelector('[aria-label="Thread list"]') || document.body;
    const rows = [...list.querySelectorAll('[role="button"]')].filter(b =>
      [...b.querySelectorAll("[aria-label]")].some(e => / ago$|^just now$/i.test(e.getAttribute("aria-label") || "")));
    const norm = s => (s || "").replace(/\s+/g, " ").trim();
    const row = rows.find(b => {
      const t = norm(b.innerText);
      return t.includes(norm(name)) && t.includes(norm(preview).slice(0, 40));
    });
    if (!row) return false;
    row.scrollIntoView({ block: "center" });
    row.click();
    return true;
  },

  // Scroll the open thread's message pane up (towards older messages).
  scrollHistory: () => {
    const r = document.querySelector('[aria-label^="React to message from"]');
    if (!r) return false;
    for (let e = r.parentElement; e; e = e.parentElement) {
      const oy = getComputedStyle(e).overflowY;
      if (oy === "scroll" || oy === "auto") {
        const before = e.scrollTop;
        e.scrollTop = before - 4000;
        return e.scrollTop !== before;
      }
    }
    return false;
  },
})
