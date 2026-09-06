import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (...parts) => fs.readFileSync(new URL(`../${parts.join('/')}`, import.meta.url), 'utf8');

const app = read('src', 'App.tsx');
const nav = read('src', 'components', 'AppNav.tsx');
const css = read('src', 'index.css');

test('approved seven-screen routes keep stable design shells', () => {
  for (const id of [
    'auth-design-shell',
    'mood-design-shell',
    'chat-design-shell',
    'voice-design-shell',
    'bible-design-shell',
    'profile-design-shell',
    'pricing-design-shell',
  ]) {
    assert.match(app, new RegExp(id));
  }
});

test('navigation matches the approved brand and tab treatments', () => {
  assert.match(nav, /BIBLE MOOD SEARCH/);
  assert.match(nav, /DISCOVER SCRIPTURE FOR EVERY FEELING/);
  assert.match(nav, /Home.*Mood.*Chat.*Voice.*Bible.*Profile/s);
  assert.doesNotMatch(nav, />PLANS</);
});

test('approved reference-specific visual locks remain present', () => {
  assert.match(css, /mood-design-shell/);
  assert.match(css, /lucide-mic/);
  assert.match(css, /bible-design-shell/);
  assert.match(css, /nth-child\(40\)/);
  assert.match(css, /profile-design-shell/);
  assert.match(css, /lucide-log-out/);
  assert.match(css, /voice-design-shell/);
  assert.match(css, /Start Conversation/);
  assert.match(css, /End Conversation/);
  assert.match(css, /Tap Start Conversation when you are ready to speak/);
});
