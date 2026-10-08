# Shopee Live: simulated two-way sync

**Status 2026-10-08.** A rehearsal can now run a two-way sync with a **simulated** Shopee Live. Nothing talks to Shopee. No Shopee account, developer app or token exists for this project yet.

## What the demo shows

Open a rehearsal, start the simulated session, open the **Platform** tab on the Operate desk.

| Direction | What happens |
|---|---|
| LiveLift → platform | Show starts: LiveLift opens a live and loads the run of show's products. A hard-anchored promotion becomes a scheduled promotion. **Pin on Shopee** pins through `update_show_item`; the show records it as performed with the request id. |
| Platform → LiveLift | In **The host's Shopee app (simulated)** the host can go live, add or remove bag items, pin, unpin and end the live. LiveLift reads the platform and records each change as *Provider observed (SIMULATED)* against the planned cue, or as an unplanned action. |
| Never echoed | What LiveLift changed itself is re-read as the new baseline, so it is not reported back as "observed". |
| Honest gaps | Unpin has no known endpoint, so it stays with the operator. A live that ended on the platform is a notice; LiveLift never ends the show itself. Items LiveLift has no product for are offered, never imported silently. |
| Conditions | *Authorisation expired*, *Region not supported*, *Rate limited*, *Server error* return Shopee's own error text. LiveLift stops, says so once, and the operator continues by hand. |

Everything is deterministic: the same actions on the rehearsal's virtual clock give the same call log.

## How well each part is known

| Part | Basis |
|---|---|
| `update_show_item`: `POST /api/v2/livestream/update_show_item`, "Set the showing item", listed for TW, ID, TH, PH, MY, SG, VN; parameters `session_id`, `item_id`, `shop_id`; reply `{error, message, request_id, response}`; errors for a session that does not exist, is not ongoing, or does not belong to the caller; "not supported for current region"; permission group *Livestream Management* | **Read from Shopee's own reference page**, 2026-10-08 (screenshots). Page updated 2026-01-13. |
| `create_session`, `start_session`, `end_session`, `get_session_detail`, `add_item_list`, `delete_item_list`, `update_item_list`, `get_item_list` | **Names only**, from the same page's menu. Parameters and replies in the simulation are guesses and are shown as *shape inferred*. |
| Promotions | Shopee schedules promotions through separate modules (`shop_flash_sale`, discount, voucher). No endpoint that fires one inside a live was found. Names come from a third-party listing. |
| Comments, metrics | `get_latest_comment_list`, `get_session_metric`, `get_session_item_metric`: earlier project research (2026-09-17), not re-read. Not used by the simulation yet. |

The menu on the reference page scrolls; only 12 Livestream entries were seen. There may be more.

## Open questions the simulation does not answer

Shown on screen as switchable assumptions, never as silent behaviour.

1. **A1.** Can the API control a live the host started in the Shopee app? The "not belong to you" error suggests ownership matters.
2. **A2.** Does reading the session reveal which product is pinned? Without it, a pin made in the app can only be reported by hand.
3. Does `start_session` put video on air, or does the host still stream from the app or OBS? Is the "showing item" the same thing as the pin viewers see?
4. Can an individual without a business licence get an app with the Livestream permission?

No call that lists live sessions was found, so LiveLift cannot discover a live started in the app. The operator enters its session ID.

## When a developer account is approved

1. Authorise the app with a seller account that can go live. Tokens are per broadcaster (Shopee calls these "User" APIs); the access token lives about 4 hours.
2. In the console's **API Test Tools**, read the real reference for each Livestream endpoint and replace every *shape inferred* call.
3. Answer A1 and A2 with a real live. Record the result here, whichever way it falls.
4. Only then replace the simulation with a real adapter behind the same `syncCycle`. Real replies must be labelled provider observed, never platform confirmed.

## Code

- `next/src/lib/platform/shopeeLive.ts`: the simulation (pure, deterministic).
- `next/src/lib/platform/sync.ts`: the two-way bridge (`syncCycle`, `pinFromLiveLift`, `diffSnapshots`, `inboundActions`).
- `next/src/lib/platform/capabilities.ts`: what each platform allows, with the strength of the evidence. Shown on **Integrations**.
- `next/src/components/platform/`: the Platform tab.
- Tests: `next/src/__tests__/platform/`.

TikTok has no documented API to open a live, pin or fire a promotion. In that table those rows say *operator does it, then reports*. See `docs/tiktok/FEASIBILITY.md`.
