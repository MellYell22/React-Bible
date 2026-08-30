import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { launchChrome, connect, newPage, evaluate, sleep } from './cdp.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const FRAMES = join(DIR, 'frames');
const FPS = 30, DURATION = 15;
const TOTAL = FPS * DURATION;

const MIME = { '.html':'text/html', '.png':'image/png', '.css':'text/css' };
const server = createServer(async (req, res) => {
  const path = join(DIR, decodeURIComponent(req.url.split('?')[0]));
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

await rm(FRAMES, { recursive: true, force: true });
await mkdir(FRAMES, { recursive: true });

const chrome = launchChrome();
try {
  const client = await connect();
  const send = await newPage(client);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false,
  });

  await send('Page.navigate', { url: `http://127.0.0.1:${port}/frame.html?t=0` });
  // Wait for webfonts AND the two app screenshots to decode, or frame 1 renders
  // in a fallback serif and every later frame silently disagrees with it.
  for (let i = 0; i < 60; i++) {
    const ok = await evaluate(send, `(async () => {
      await document.fonts.ready;
      const imgs = [...document.images];
      return window.__ready === true && imgs.every(i => i.complete && i.naturalWidth > 0);
    })()`);
    if (ok) break;
    await sleep(250);
  }

  for (let f = 0; f < TOTAL; f++) {
    const t = f / FPS;
    await evaluate(send, `window.__render(${t}); true`);
    const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(join(FRAMES, `f${String(f).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
    if (f % 60 === 0) console.log(`frame ${f}/${TOTAL}  t=${t.toFixed(2)}s`);
  }
  console.log(`done: ${TOTAL} frames`);
  client.close();
} finally {
  chrome.kill();
  server.close();
}
