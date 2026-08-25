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
