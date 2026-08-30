import { readFileSync } from 'node:fs';
const buf = readFileSync(new URL('./david.wav', import.meta.url));

// Walk RIFF chunks rather than assuming a 44-byte header.
let off = 12, dataOff = 0, dataLen = 0, rate = 22050;
while (off < buf.length - 8) {
  const id = buf.toString('ascii', off, off + 4);
  const size = buf.readUInt32LE(off + 4);
  if (id === 'fmt ') rate = buf.readUInt32LE(off + 12);
  if (id === 'data') { dataOff = off + 8; dataLen = size; break; }
  off += 8 + size + (size % 2);
}

const samples = dataLen / 2;
const WIN = Math.round(rate * 0.02);          // 20 ms
const frames = [];
for (let i = 0; i + WIN <= samples; i += WIN) {
  let sum = 0;
  for (let j = 0; j < WIN; j++) {
    const s = buf.readInt16LE(dataOff + (i + j) * 2) / 32768;
    sum += s * s;
  }
  frames.push(Math.sqrt(sum / WIN));
}

const peak = Math.max(...frames);
const floor = peak * 0.06;                     // anything under 6% of peak == silence
const dur = samples / rate;

// Collect silence runs of at least 220 ms — these are the sentence seams.
const gaps = [];
let run = null;
frames.forEach((v, i) => {
  const t = (i * WIN) / rate;
  if (v < floor) { run ??= t; }
  else if (run !== null) {
    if (t - run >= 0.22) gaps.push({ start: +run.toFixed(2), end: +t.toFixed(2) });
    run = null;
  }
});

const speechStart = frames.findIndex(v => v >= floor) * WIN / rate;
let lastLoud = 0;
frames.forEach((v, i) => { if (v >= floor) lastLoud = (i * WIN) / rate; });

console.log(JSON.stringify({
  duration: +dur.toFixed(2),
  speechStart: +speechStart.toFixed(2),
  speechEnd: +lastLoud.toFixed(2),
  internalGaps: gaps.filter(g => g.start > speechStart && g.end < lastLoud),
}, null, 1));
