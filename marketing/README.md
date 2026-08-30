# Marketing assets

## Share card / end card

One design, two crops:

| File | Size | Used for |
| --- | --- | --- |
| `../public/og-image.png` | 1200×630 | Link preview on Facebook, iMessage, WhatsApp, X. Served at `/og-image.png`, referenced from `index.html`. |
| `endcard-1080x1920.png` | 1080×1920 | Closing frame for TikTok / Reels / Shorts clips. |

Content mass sits above centre on the vertical crop so the platform's own UI
(caption, buttons) does not cover the call to action.

### Regenerating after a copy change

Edit `cards/og.html` / `cards/endcard.html`, then:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=6000 --window-size=1200,630 \
  --screenshot=public/og-image.png "file://$PWD/marketing/cards/og.html"
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=6000 --window-size=1080,1920 \
  --screenshot=marketing/endcard-1080x1920.png "file://$PWD/marketing/cards/endcard.html"
```

The cards pull Cinzel and Playfair Display from Google Fonts at render time, so
the machine doing the render needs network access. Colours are the `src/theme.ts`
tokens; keep them in sync by hand if the theme moves.

After changing `og-image.png`, re-scrape the URL in the
[Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) —
platforms cache preview images aggressively.

## Tagged links

`src/services/analytics.ts` records the **first** touch and attaches it to every
later event, so a signup days after the click still reports which clip caused it.
That only works if the link carries the tags. Use one link per clip:

```
https://www.mybibleaicompanion.com/?utm_source=tiktok&utm_medium=organic&utm_campaign=launch&utm_content=script1_giving_up
https://www.mybibleaicompanion.com/?utm_source=ig&utm_medium=organic&utm_campaign=launch&utm_content=script1_giving_up
https://www.mybibleaicompanion.com/?utm_source=yt&utm_medium=organic&utm_campaign=launch&utm_content=script1_giving_up
https://www.mybibleaicompanion.com/?utm_source=fb&utm_medium=organic&utm_campaign=launch&utm_content=script1_giving_up
```

Change `utm_content` per script (`script2_mood`, `script3_cant_say_out_loud`) and
`utm_medium` to `paid` once you start boosting. Keep `utm_campaign=launch` for
the whole 30-day sprint so the sprint can be read as one cohort.

## Funnel events

| Event | Fires when |
| --- | --- |
| `signup` | Account created. `confirmed` distinguishes instant sign-in from awaiting-email. |
| `chat_limit_reached` | Free daily message limit hit — the paywall moment. |
| `checkout_started` | Upgrade tapped, before the Stripe redirect. Carries `plan` and `from`. |
| `checkout_completed` | Stripe returned successfully. |

Read as a funnel: `signup → chat_limit_reached → checkout_started →
checkout_completed`, split by `utm_content`. The clip with the best
signup→paid rate is the one to boost — not the one with the most views.

## Promo video — `david-promo-15s.mp4`

15.000s · 1080×1920 · 30fps · H.264 · ~10 Mbps · audio from 1.30s.
Ready to upload as-is to TikTok, Reels, Shorts, and Facebook Reels.

**Everything in it is real.** The app frames were captured from the live
production site (guest session, anxious mood), and the voice is David's actual
ElevenLabs output — `voice-samples/david-reassuring-anxiety.mp3`, not a
stand-in. Captions are timed to the measured speech envelope, so they track the
audio rather than being evenly spaced.

### Beat sheet

| Time | Beat |
| --- | --- |
| 0.0–1.3s | Hook on navy — "I told it I was anxious." |
| 1.3s | David's voice starts; app card fades up on the mood grid |
| 2.9–4.1s | Gold pulse on the ANXIOUS tile |
| 6.6s | Cut to the Bible reader on **Psalms 46:1** |
| 10.9s | Cut to David's reflection, with CHAT FREE / VOICE PRO |
| 13.4–15.0s | End card — "Talk to David free · MyBibleAiCompanion.com" |

The Psalm 46 beat is deliberate: David's voice names Psalm 46, so the screen
behind him shows Psalms 46:1 rather than a different passage. An earlier cut had
him say "Psalm 46" over a Philippians screen — in a scripture app that
contradiction is the kind of detail the audience notices.

### Suggested caption

> I told it I was anxious. It didn't give me a pep talk — it gave me Psalm 46. 🤍
> Free at MyBibleAiCompanion.com
> #christiantiktok #bibleverse #faith #anxiety #prayer

Put the tagged link from the section above in your bio, one `utm_content` per
clip, so the funnel can attribute a signup back to this video.

### Regenerating

Sources live in the session scratchpad (`video/frame.html`, `render.mjs`,
`encode.swift`). To change copy, edit the `CAPS` array and the hook text in
`frame.html`, re-run `node render.mjs`, then
`./encode frames <voice.mp3> 1.30 out.mp4`.

### Worth knowing

This is a motion-graphics promo built from still captures with a slow push and
crossfade — not a screen recording. It is a strong week-one asset, but the
scripts in `VIDEO_SCRIPTS.md` still want real footage of a finger tapping and
text streaming in. Shoot those when you can; this covers you until then.
