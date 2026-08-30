// Minimal zero-dependency CDP client. Node 24 has a global WebSocket, so we can
// drive Chrome without puppeteer.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

export function launchChrome(extra = []) {
  const proc = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/cdp-profile-bms',
    ...extra,
    'about:blank',
  ], { stdio: 'ignore' });
  return proc;
}

export async function connect(retries = 40) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const { webSocketDebuggerUrl } = await res.json();
      return await open(webSocketDebuggerUrl);
    } catch {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  throw new Error('Chrome did not expose a debugging endpoint');
}

function open(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = [];

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r, reject: j } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? j(new Error(msg.error.message)) : r(msg.result);
      } else if (msg.method) {
        listeners.forEach(fn => fn(msg));
      }
    };
    ws.onerror = reject;
    ws.onopen = () => resolve({
      send(method, params = {}, sessionId) {
        return new Promise((r, j) => {
          const mid = ++id;
          pending.set(mid, { resolve: r, reject: j });
          ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
        });
      },
      on(fn) { listeners.push(fn); },
      close() { ws.close(); },
    });
  });
}

/** Attach to a fresh tab and return a session-scoped send(). */
export async function newPage(client) {
  const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => client.send(method, params, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');
  return send;
}

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function evaluate(send, expression) {
  const { result } = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  return result.value;
}

export async function shoot(send, path) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  writeFileSync(path, Buffer.from(data, 'base64'));
  return path;
}
