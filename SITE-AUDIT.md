# Live site audit — mybibleaicompanion.com

Audited 2026-08-25 against the deployed production site (not the local working
tree). Mobile viewport, since effectively all planned traffic arrives from
TikTok / Reels / Shorts.

Ordered by what costs you signups today.

**All ten findings were fixed on 2026-08-25, then hardened in a second pass.**
Second pass: added `favicon.ico` (the catch-all fix had turned it from HTML
into a 404), extended headings and `aria-label`s to every screen in the guest
flow, retoned the emerald palette app-wide behind a new `success` theme token,
and repaired `npm run lint` — it now exits 0, so `npm run check` is a real
pre-deploy gate for the first time. Testing found and fixed one further bug:
the guidance-expansion reset sat after an early return, so every mood tile
skipped it. Each carries its resolution
below. Changes are verified locally against the production build; they take
effect for real visitors on the next deploy.

---

## Critical

### 1. Every unknown path returns `200 text/html`

**Fixed** — `server.ts` now 404s any path with a file extension, and `vercel.json`'s
catch-all rewrite excludes them so a missing asset never resolves to the SPA
shell. Real `robots.txt`, `sitemap.xml` and favicons added in `public/`.
Verified against the production build: `robots.txt` → `text/plain`,
`sitemap.xml` → `application/xml`, `og-image.png` → `image/png`, a bogus
`.png` → 404, and SPA routes still → HTML.


`server.ts:999` falls back to `res.sendFile(dist/index.html)` for all unmatched
routes, with no extension check. Measured on production:

| Request | Status | Content-Type |
| --- | --- | --- |
| `/robots.txt` | 200 | `text/html` |
| `/sitemap.xml` | 200 | `text/html` |
| `/favicon.ico` | 200 | `text/html` |
| `/definitely-not-real-xyz.png` | 200 | `text/html` |

Consequences:

- **Crawlers get HTML where they expect directives.** `robots.txt` and
  `sitemap.xml` are not "missing" — they return a webpage with status 200, which
  is worse than a 404, because Google treats it as a real (malformed) file.
- **Broken asset paths never surface.** A typo'd image URL returns 200 and an
  HTML body. Social scrapers fetching `og:image` would receive HTML and render
  no preview, with nothing in any log to explain it.
- **Unbounded indexable surface.** Any URL anyone links returns 200 HTML, so
  search engines can index infinite duplicates of the same page.

**Fix:** in the catch-all, 404 anything with a file extension, and serve real
`robots.txt` / `sitemap.xml` / `favicon.ico` from `public/`.

### 2. No link preview metadata

**Fixed** — metadata shipped earlier; favicon and apple-touch-icon added here.


Live `<head>` has no `description`, no `og:*`, no `twitter:*`, and no favicon
link. Shared to Facebook, iMessage, WhatsApp, or a TikTok bio tap, the link
renders as a bare grey card.

**Status:** fixed in the working tree (`index.html` + `public/og-image.png`),
**not yet deployed.** Ships with your next deploy. Note this interacts with
item 1 — verify `/og-image.png` returns `image/png` after deploying, not HTML.

### 3. Mobile header is broken

**Fixed** — below 700px the brand moves to its own row beneath the controls, in
both `AuthScreen` and `Layout`. The translation picker was absolutely pinned to
the top-right and only cleared SIGN UP because the broken header was three
lines tall; it now sits in the header row and cannot overlap.


At 375px wide, "BIBLE MOOD SEARCH" wraps to three lines, the tagline "DISCOVER
SCRIPTURE FOR EVERY FEELING" wraps to four, and the gold **SIGN UP** button
overlaps the tagline. This is the first thing every visitor from a video sees.

**Fix:** at mobile widths, drop the tagline and let the brand mark sit on one
line, or move SIGN UP into the hamburger.

---

## High

### 4. No headings anywhere

**Fixed** — the brand renders as `<h1>` and section titles as `<h2>` via
`role="heading"` / `aria-level`, which react-native-web emits as real heading
elements.


`document.querySelectorAll('h1,h2')` returns **zero** elements. "ENTER
SANCTUARY", "VERSE OF THE DAY" and every other title are styled `div`s. There
is nothing on the page for a search engine to read as a topic.

This is inherent to rendering through `react-native-web` (`<Text>` becomes
`<div>`), so it needs deliberate work: use `role="heading"` / `aria-level`, or
render real heading tags on the marketing surfaces.

### 5. No semantic controls

**Fixed** — 57 controls across 11 files now carry `role="button"`, and every
icon-only control has an `aria-label`. Verified: 10 labelled buttons on the
sign-in page, zero unlabelled, and automated clicks that previously timed out
now succeed.


The full interactive tree on the sign-in page is 13 nodes, of which 11 are
`generic`. SIGN IN, CREATE FREE ACCOUNT, and CONTINUE AS GUEST are unlabelled
`div`s — not reachable by keyboard, and announced as nothing by a screen reader.
Beyond the accessibility problem, automated clicks on them time out, which is
also why they resist testing tools.

### 6. Apex redirect is temporary

**Fixed in config** — `vercel.json` now declares a permanent (308) apex → www
redirect. If a redirect is also configured in the Vercel dashboard it may take
precedence, so confirm the response is 308 after deploying.


`mybibleaicompanion.com` → `www.` returns **307**. Use **301** so search engines
consolidate ranking signals onto the canonical host.

---

## Medium

### 7. Dead space above the fold

**Fixed** — the top offset was `viewportHeight * 0.2`. Phones now get ~5%
(capped at 56px) while desktop keeps the airy framing. The mood grid and the
verse of the day are both above the fold on a 375×812 screen.


The home screen opens with roughly 230px of empty navy before "TEXT CHAT WITH
DAVID · FREE". On a phone that is a meaningful share of the first screen spent
on nothing. Pulling the content up puts the mood grid — the thing that makes
people stay — above the fold.

### 8. David's guidance overflows its card

**Fixed** — replies over 420 characters open clamped to 9 lines with a
"CONTINUE READING" toggle, so the CHAT / VOICE actions stay reachable. Resets
to collapsed on each new reflection.


The anxious reflection returned ~560 characters and ran past the bottom of the
viewport, with the reader landing mid-sentence. Consider a clamp with a
"continue" affordance, or tighter response-length guidance for the mood surface.

### 9. The chapter view renders no scripture

**Fixed** — the chapter text was already fetched into `chapterVerses` and
discarded. `renderVerses` now renders continuous scripture with gold verse
numbers, each row tappable to open that verse.


Bible → Psalms → 46 shows the heading "Psalms 46", a grid of verse numbers
1–11, and **no verse text at all** — the rest of the screen is empty navy. The
text only appears after tapping an individual verse number, which then shows
that one verse alone.

Readers arriving expecting a chapter see what looks like a broken page. Render
the full chapter as continuous text, with the numbers as jump links.

### 10. Off-palette control in the reader

**Fixed** — the five emerald `#10B981` references are now brand gold.


The verse view's **SAVE TO MY LIST** button is teal/green, inside an otherwise
strict navy-and-gold system. It reads as borrowed from another design.

---

## What is working

- **Fast.** TTFB 104ms, 1.6KB HTML shell.
- **Guest mode works.** "CONTINUE AS GUEST" drops straight into the full app with
  no signup wall. This is exactly right for paid traffic — do not remove it.
- **The core loop delivers.** Tapping ANXIOUS returned genuine, well-written
  guidance grounded in Philippians 4:6-7, with `CHAT WITH DAVID · FREE` and
  `VOICE WITH DAVID · PRO` upsells correctly placed underneath. The product
  earns the traffic; the wrapper around it is what needs work.

---

## Suggested order

1. Item 1 (catch-all) and item 2 (metadata) — same deploy; item 1 protects item 2.
2. Item 3 (mobile header) — before any clip goes out.
3. Item 6 (301) — one config change.
4. Items 4, 5, 7, 8 — as capacity allows.
