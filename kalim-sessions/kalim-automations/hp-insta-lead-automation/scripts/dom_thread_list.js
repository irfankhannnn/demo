// Reads the visible rows of the Instagram web inbox thread list.
// Evaluated in the page by fetch_instagram_dms.py. Read-only: it never clicks.
//
// Returns one entry per rendered row with the display name, the preview line,
// Instagram's own "N hours ago" label and every signal that could mean unread.
// Unread detection is deliberately generous: a false "unread" only delays a
// thread to the next run, a false "read" would mark the lead's message Seen.
() => {
  const list = document.querySelector('[aria-label="Thread list"]') || document.body;
  const rows = [...list.querySelectorAll('[role="button"]')].filter(b => {
    const labels = [...b.querySelectorAll("[aria-label]")].map(e => e.getAttribute("aria-label"));
    return labels.some(l => / ago$|^just now$/i.test(l || ""));
  });

  const out = rows.map((b, index) => {
    const ageLabel = [...b.querySelectorAll("[aria-label]")]
      .map(e => e.getAttribute("aria-label"))
      .find(l => / ago$|^just now$/i.test(l || "")) || "";
    const lines = (b.innerText || "").split("\n").map(s => s.trim())
      .filter(s => s && s !== "·" && !/^\d+\s*[smhdwy]$/.test(s) && !/^Active( now|\s.*ago)?$/.test(s));
    const name = lines[0] || "";
    const preview = lines.slice(1).join(" ");

    const leaves = [...b.querySelectorAll("span,div")]
      .filter(e => e.childElementCount === 0 && (e.textContent || "").trim());
    const boldLeaves = leaves.filter(e => parseInt(getComputedStyle(e).fontWeight, 10) >= 600)
      .map(e => e.textContent.trim().slice(0, 20));
    const unreadLabel = [...b.querySelectorAll("[aria-label]")]
      .some(e => /unread/i.test(e.getAttribute("aria-label") || ""));
    const dots = [...b.querySelectorAll("div,span")].filter(e => {
      if (e.childElementCount || (e.textContent || "").trim()) return false;
      const s = getComputedStyle(e);
      const w = parseFloat(s.width), h = parseFloat(s.height);
      const rgb = (s.backgroundColor.match(/\d+(\.\d+)?/g) || []).map(Number);
      // Instagram's unread dot is blue. The green "active now" dot on avatars is not unread.
      const blue = rgb.length >= 3 && (rgb[3] === undefined || rgb[3] > 0) &&
        rgb[2] > 150 && rgb[2] > rgb[0] + 60;
      return w >= 6 && w <= 14 && Math.abs(w - h) < 1 && s.borderRadius !== "0px" && blue;
    }).map(e => getComputedStyle(e).backgroundColor);

    return {
      index, name, preview, ageLabel,
      unread: boldLeaves.length > 0 || unreadLabel || dots.length > 0,
      unreadSignals: { boldLeaves, unreadLabel, dots },
    };
  });

  let scroller = null;
  for (const e of [list, ...list.querySelectorAll("div")]) {
    const oy = getComputedStyle(e).overflowY;
    if ((oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight + 4 &&
        e.querySelector('[role="button"]')) { scroller = e; break; }
  }
  const account = (document.querySelector('[aria-label="Thread list"] [role="button"]') || {}).innerText || "";
  return {
    url: location.href,
    account: account.split("\n")[0].trim(),
    rows: out,
    atEnd: scroller ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4 : true,
    hasScroller: !!scroller,
  };
}
