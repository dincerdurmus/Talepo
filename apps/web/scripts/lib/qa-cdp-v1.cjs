/**
 * Minimal Chrome DevTools Protocol driver (no new dependencies).
 *
 * Node 24 ships a global WebSocket, and Chrome is already installed on this
 * machine, so the browser pass needs neither Playwright nor a repo change.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function chromePath() {
  const cands = [
    path.join(process.env["ProgramFiles"] || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["LOCALAPPDATA"] || "", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  throw new Error("no chromium browser found");
}

async function launch(port) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "talepo-qa-"));
  const proc = spawn(
    chromePath(),
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      "--lang=tr-TR",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const json = await res.json();
      return { proc, userDataDir, wsUrl: json.webSocketDebuggerUrl };
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error("chrome did not expose a debugging endpoint");
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
        return;
      }
      for (const l of this.listeners) l(msg);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 60000);
    });
  }
  once(predicate) {
    return new Promise((resolve) => {
      const l = (msg) => {
        if (predicate(msg)) {
          this.listeners = this.listeners.filter((x) => x !== l);
          resolve(msg);
        }
      };
      this.listeners.push(l);
    });
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  return new Cdp(ws);
}

module.exports = { launch, connect };
