import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/utils/davidSpeechDelivery.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { sanitizeForDavidSpeech } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('speech keeps question intonation and thought boundaries without stage directions', () => {
  assert.equal(sanitizeForDavidSpeech('[warmly] You got the job! What part worries you?'), 'You got the job! What part worries you?');
  assert.equal(sanitizeForDavidSpeech('Take your time... we can talk — whenever you’re ready.'), "Take your time... we can talk — whenever you're ready.");
});

test('speech preparation is stable across client and server cleanup', () => {
  const text = 'It is okay... [pause] What feels hardest?';
  const once = sanitizeForDavidSpeech(text);
  assert.equal(sanitizeForDavidSpeech(once), once);
});

test('intentional ellipses survive repeated speech cleanup', () => {
  for (const text of ['I wonder… what changed?', 'I wonder...... what changed?']) {
    const result = sanitizeForDavidSpeech(text);
    assert.equal(result, 'I wonder... what changed?');
    assert.equal(sanitizeForDavidSpeech(result), result);
  }
});

test('David introduction is spoken as one natural thought with a soft pause', () => {
  assert.equal(
    sanitizeForDavidSpeech("Hey. I'm David. What's on your mind?"),
    "Hey, I'm David... What's on your mind?",
  );
  assert.equal(
    sanitizeForDavidSpeech("Hi, I'm David. How are you today?"),
    "Hi, I'm David... How are you today?",
  );
  assert.equal(
    sanitizeForDavidSpeech("Hey there. I'm David. Take your time — where do you want to start?"),
    "Hey there, I'm David... Take your time — where do you want to start?",
  );
});

test('short conversational lead-ins get a softer spoken beat instead of a clipped stop', () => {
  assert.equal(sanitizeForDavidSpeech("Yeah. That's hard."), "Yeah... That's hard.");
  assert.equal(sanitizeForDavidSpeech("Okay. What happened?"), "Okay... What happened?");
});

test('chapter and verse references survive the pause rules intact', () => {
  // Colons and semicolons soften to commas so prose reads as speech. A colon
  // between two digits is not a pause, though -- unguarded, "Zephaniah 3:17"
  // reaches the voice as "Zephaniah 3, 17" and is spoken "Zephaniah three,
  // seventeen". Scripture references are the most common thing David says.
  assert.equal(
    sanitizeForDavidSpeech('There is a line in Zephaniah 3:17 that I love.'),
    'There is a line in Zephaniah 3:17 that I love.',
  );
  assert.equal(
    sanitizeForDavidSpeech('Philippians 4:6-7 says do not be anxious.'),
    'Philippians 4:6-7 says do not be anxious.',
  );
  assert.equal(sanitizeForDavidSpeech('John 11:35 is the shortest verse.'), 'John 11:35 is the shortest verse.');

  // Clock times and decimals ride on the same guard.
  assert.equal(sanitizeForDavidSpeech('We can talk at 3:30 if that works.'), 'We can talk at 3:30 if that works.');
  assert.equal(sanitizeForDavidSpeech('It costs 3.50 either way.'), 'It costs 3.50 either way.');

  // Prose colons and semicolons still soften, which is the behaviour we want.
  assert.equal(sanitizeForDavidSpeech('It says this: you are loved.'), 'It says this, you are loved.');
  assert.equal(sanitizeForDavidSpeech('I meant it; I really did.'), 'I meant it, I really did.');

  // Running it twice must not change the result -- both speech paths sanitize.
  const once = sanitizeForDavidSpeech('Psalm 23:1 is the one everyone knows.');
  assert.equal(sanitizeForDavidSpeech(once), once);
});
