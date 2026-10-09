# LiveLift logo

**Idea.** A product card lifted off a stack and pinned with kraft tape, with a small LIVE dot on its photo. It is the
product itself: LiveLift helps a seller lift the right product on screen at the right moment. Only the front card and
the tape tilt, as on the Live Desk. Not an "L" and not a person: the first drafts looked like a learner-driver "L" plate and
an ID badge, so they were dropped.

**Colours** (the Calm Studio tokens): ink `#2A2522`, brick `#9E3B2B`, kraft `#C9B48A`, paper `#FBF9F5`, cream `#F6F3EE`.
Dark background: line `#F3ECE1`, brick `#D4624A`, card `#2A2522`.
**Type**: Be Vietnam Pro Medium, converted to outlines (no font needed). "Live" in ink, "Lift" in brick.

| File | Use |
|---|---|
| `logo-lockup.svg` / `.png` | Default: mark + name on cream or white (slides, poster, documents) |
| `logo-lockup-dark.svg` / `.png` | On dark backgrounds |
| `logo-lockup-mono.svg` / `.png` | One colour: print, stamps, fax-style documents |
| `logo-mark.svg` / `-dark` / `-mono` (+ `.png`, 1024 px) | The mark alone: avatars, QR corners, social |
| `favicon.svg`, `favicon-32/180/512.png` | Browser tab and app icon (heavier strokes, readable at 16 px) |

**Rules.** Keep clear space of half the card width around it. Minimum size: lockup 120 px wide, mark 16 px (use `favicon.svg`
below 24 px). Do not recolour the brick, rotate the whole logo, add shadows or gradients, or put it on photos without a
cream or ink panel. Never place it so that it looks like a Shopee or platform mark: LiveLift is its own product.

In the app the mark is drawn inline in the header (`next/src/components/livedesk/Shell.tsx`, `LogoMark`) with the theme tokens, and
`next/src/app/icon.svg` is the favicon. Regenerate the files with `python3 source/build_logo.py` (needs `fonttools` and `brotli`).
