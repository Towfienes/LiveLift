# SIMULATED Live Desk

Connect a platform → import products → start live → operate the desk. Home shows platform status, the imported product count and the next step, followed by the existing “What is real, and what is not” panel. `/legacy` links to the original screens at their original URLs.

From `next/`, use the supported Node version in `package.json`:

```sh
npm ci
npm run dev
# Open http://localhost:3130/start
```

Production verification:

```sh
npm run typecheck
npm run lint
npm test
npm run build
NODE_PATH=/path/to/external/browser-tools/node_modules \
AXE_PATH=/path/to/axe-core-4.13.0/axe.min.js \
node acceptance/livedesk-browser.mjs
```

The browser harness reuses the Lab’s disposable production runtime with local HTTPS, Playwright and axe-core **4.13.0**. It runs twice at 1920×1080, 1280×720 and 390×844, checks labels, focus, 44 px targets, zero axe violations, overflow and equal fingerprints. The second run requests reduced motion. Screenshots and `results.json` go to a temporary directory printed by the script; set `LIVEDESK_EVIDENCE_DIR` to select it. Browser tools are external; no application dependency is added. `--self-test` checks the harness assertions without launching a browser.

The four-step demo, once WP5a logic is integrated:

1. Open `/start` and click **Connect** for **SIMULATED Shopee Live**.
2. Click **Use sample pack**, or paste CSV/TSV and import. Read each product’s queued, synced (SIMULATED) or failed state. Failure text is preserved verbatim. Missing price or stock says **Not entered**. Start stays disabled for the reason supplied by the logic.
3. Click **Start live**. On the desk, click **Run**, then **Pause**; change speed or skip virtual time. Pin, unpin and pin again without confirmation or cooldown. Read comments, intent counters and the two charts. Markers show when you acted, not what caused a change.
4. Inspect a Copilot suggestion’s signals, sample size, confidence and **Rules** or **AI** source. **Accept** or **Dismiss**, then **End live**. Accepted is a choice; only the logic may mark a suggestion performed after simulated platform evidence. Reset is a separate clock action.

Everything on this desk is **SIMULATED**. Nothing talks to Shopee. Synthetic viewers, comments, carts and purchases are inventions, never real learning. The simulation assumptions supplied by the generator are listed on the desk: the fixture uses a seeded viewer curve and assumes a pinned product attracts more add-to-carts. These are assumptions, not findings about real customers. PII masking, intent detection, event generation, sync and suggestion lifecycle belong to WP5a; the screens display the supplied view model unchanged.

Only `update_show_item` copies Shopee’s published reference. Other platform calls are shape inferred. **Unpin is guessed, no Shopee page found.** The platform’s own failure wording is displayed without reinterpretation. Banners and suggestions are announced politely; the comment stream is not announced on every update. EN/VI uses the Lab’s persisted language preference; view-model text and the existing phone and honesty panel keep their supplied language.

The Copilot reads aggregated recent signals and stock. Confidence reflects sample size, not a prediction or probability. Rules remain available without an AI key. AI status and suggestion source are displayed independently; signals suggest, they do not establish cause.

## WP5b integration limits

On this branch `useStartFlow()` and `useLiveDesk(liveId)` still return fixtures. Connect starts already connected, imports do nothing, and `onStartLive()` returns `null`. `/desk/fixture` can render the fixture for visual inspection; desk actions do nothing. The harness reports **PARTIAL (fixture hooks)** and records the unavailable transitions explicitly. Equal fixture fingerprints prove only repeatable rendering. Run the full browser journey after integrating WP5a; do not treat a partial run as acceptance of the engine.

The fixed contract provides neither an active live id on Home, a wire log, host-side intent actions, platform item ids nor promotion state. Accordingly Desk navigation appears on a desk route, the wire toggle says its log is unavailable, and the reused phone is an inert, read-only audience preview. No session id or flash sale is invented. A contract extension is needed for a Home “return to Desk” link and an interactive host phone/wire log.

The new Home replaces the old planning Home. Existing Home tests outside `livedesk/ui` still assert the old onboarding, REAL-room priority cards and old work-loop links. WP5b cannot rewrite or weaken those tests under its ownership rules; their failures must be resolved by the operator with an explicit migration of the old Home expectations. The affected files are `ui.flow.test.tsx`, `onboarding/home.onboarding.test.tsx`, `phase3-ui/a11y.ui.test.tsx` and `phase3-ui/connection.ui.test.tsx`, under `next/src/__tests__/`. The legacy routes and their test ids remain untouched.

## WP5b verification, 2026-10-09

Typecheck and lint exit 0; the production build succeeds. All **29 Live Desk UI tests pass**, including server-rendered chart hydration. The full suite reports **4 failed files, 75 passed; 16 failed tests, 1,265 passed, 57 skipped**. The failures are the old Home expectations above; no existing test was changed.

The Live Desk browser run reports **PARTIAL (fixture hooks); 6 runs; 48 axe states; 0 failures**. Axe-core 4.13.0 reports zero violations and zero incomplete checks for these screens; all inspected states have no horizontal overflow. EN/VI persistence, visible keyboard focus, reduced motion and 44 px targets pass. All six fixture fingerprints are `e8d00fb0`; no live state transition is verified by that equality.

The existing Lab harness also passes: **357 passed, 0 failed; 84 axe states; 0 aborted**, with `9d723008` in all six journeys. Its source is unchanged; only its temporary execution copy redirects imports and evidence output away from the tracked historical screenshots. The Lab’s `color-contrast` checks remain incomplete, as in the baseline. No physical-device or manual screen-reader audit was performed.
