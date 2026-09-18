// HP Insta Lead Reader: lets scripts/fetch_instagram_dms.py read DMs in the
// Chrome you already use and are logged in to.
//
// While a pipeline run is active it serves http://127.0.0.1:<port>. This worker
// polls that address and runs the commands it gets. Nothing here can type,
// send, react or accept: the only page actions are the named read helpers in
// page_lib.js (read the list, read a thread, scroll, click a tab or a thread
// row), and navigation is limited to instagram.com/direct. When no run is
// active the poll simply fails and the worker goes back to sleep.
importScripts("bridge-config.js");

const BASE = "http://127.0.0.1:" + self.HP_BRIDGE.port;
const HEADERS = { "X-HP-Token": self.HP_BRIDGE.token };
const VERSION = chrome.runtime.getManifest().version;
const ALLOWED_FNS = new Set([
  "hasAny", "location", "clickTab", "scrollList", "clickRow", "scrollHistory",
  "listRows", "extractThread",
]);
const ALLOWED_URL = /^https:\/\/www\.instagram\.com\/direct\//;

let running = false;
const session = { windowId: null, tabId: null };

chrome.alarms.create("hp-poll", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => loop());
chrome.runtime.onStartup.addListener(() => loop());
chrome.runtime.onInstalled.addListener(() => loop());

async function loop() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      let res;
      try {
        res = await fetch(BASE + "/next?v=" + VERSION, { headers: HEADERS, cache: "no-store" });
      } catch (e) {
        break; // no pipeline run right now
      }
      if (res.status === 204) {
        await chrome.runtime.getPlatformInfo(); // keeps the worker alive between long polls
        continue;
      }
      if (!res.ok) break;
      const cmd = await res.json();
      let out;
      try {
        out = { ok: true, value: await run(cmd) };
      } catch (e) {
        out = { ok: false, error: String((e && e.message) || e) };
      }
      try {
        await fetch(BASE + "/result", {
          method: "POST",
          headers: Object.assign({ "Content-Type": "application/json" }, HEADERS),
          body: JSON.stringify(Object.assign({ id: cmd.id }, out)),
        });
      } catch (e) {
        break;
      }
    }
  } finally {
    running = false;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitComplete(tabId, timeoutMs) {
  const end = Date.now() + (timeoutMs || 45000);
  while (Date.now() < end) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") return tab;
    await sleep(500);
  }
  throw new Error("page did not finish loading");
}

function requireTab() {
  if (session.tabId === null) throw new Error("no reader window open");
  return session.tabId;
}

async function run(cmd) {
  switch (cmd.type) {
    case "hello":
      return { version: VERSION };

    case "open": {
      if (!ALLOWED_URL.test(cmd.url)) throw new Error("url not allowed");
      await closeSession();
      const win = await chrome.windows.create({
        url: cmd.url, focused: false, state: cmd.windowState === "normal" ? "normal" : "minimized",
      });
      session.windowId = win.id;
      session.tabId = win.tabs[0].id;
      await waitComplete(session.tabId);
      return { tabId: session.tabId };
    }

    case "goto": {
      if (!ALLOWED_URL.test(cmd.url)) throw new Error("url not allowed");
      const tabId = requireTab();
      await chrome.tabs.update(tabId, { url: cmd.url });
      await sleep(300);
      await waitComplete(tabId);
      return true;
    }

    case "url":
      return (await chrome.tabs.get(requireTab())).url;

    case "call": {
      if (!ALLOWED_FNS.has(cmd.fn)) throw new Error("function not allowed: " + cmd.fn);
      const target = { tabId: requireTab() };
      const [probe] = await chrome.scripting.executeScript({ target, func: () => !!self.__hpLib });
      if (!probe.result) {
        await chrome.scripting.executeScript({ target, files: ["page_lib.js"] });
      }
      const [res] = await chrome.scripting.executeScript({
        target,
        func: (fn, arg) => self.__hpLib[fn](arg),
        args: [cmd.fn, cmd.arg === undefined ? null : cmd.arg],
      });
      return res.result === undefined ? null : res.result;
    }

    case "close":
      await closeSession();
      return true;

    default:
      throw new Error("unknown command " + cmd.type);
  }
}

async function closeSession() {
  if (session.windowId !== null) {
    try { await chrome.windows.remove(session.windowId); } catch (e) { /* already closed */ }
  }
  session.windowId = null;
  session.tabId = null;
}
