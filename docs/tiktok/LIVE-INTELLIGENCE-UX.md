# LiveLift V7: LIVE intelligence experience (UX)

Branch `orca/v7-live-intelligence-ui`. This document describes the user-facing half of V7. The provider/server half
(TikTok Shop transport, signing, credentials, reconciliation) belongs to the provider-core lane and is **not** in this branch.

V7 adds a second layer to LiveLift's loop. Operate records what the operator did and reported while the LIVE ran. Review
can then show, beside it, what a provider observed **afterwards**. The one idea the interface protects:

> Later evidence must never appear as if the operator knew it during the LIVE.

## 1. Experience model

| Surface | What V7 adds | Where |
|---|---|---|
| Operate | **Quick report**: five one-tap *operator reported* cues, recorded as ordinary notes | `components/ops/QuickReports.tsx` |
| Review | **As known then / With later evidence** perspective control; replay timeline; later-evidence view | `app/live/[sessionId]/review/page.tsx`, `components/intelligence/*` |
| Insights | Two labelled bands: *LiveLift operations* (unchanged analytics) and *Platform evidence* | `app/insights/page.tsx`, `components/intelligence/PlatformEvidencePanel.tsx` |
| Integrations | **Provider evidence access** ledger: what TikTok does and does not offer | `app/integrations/page.tsx`, `components/intelligence/CapabilityLedger.tsx` |
| AI Copilot (Review) | Operations evidence / provider evidence / interpretation / recommendation kept apart | `components/ai/ReviewCopilot.tsx`, `CopilotParts.tsx` |
| Home | One sentence in the Review step: later evidence "stays separate" | `components/onboarding/loop.ts` |

No new top-level navigation was added. V7 lives inside Review and Insights.

## 2. Semantics the UI will not blur

```
Missing != zero                 Planned != actual
Recommendation != acceptance    Acceptance != attempt          Attempt != performed
Operator reported != provider observed != platform confirmed
Unknown != failed               REAL != SIMULATED
Observation != causation        Later evidence != evidence known during the LIVE
```

Colour roles are kept apart: **lime** = what LiveLift recorded/did and the one live action; **provider ink** (a cool,
quiet off-white `#B4C6DD`) = what a provider observed later; **cyan** = AI; **violet** = SIMULATED / fixture; **amber** = look
at this. Every state is also carried by words and an icon, never by colour alone.

## 3. As known then

The default perspective. It shows the existing Review (plan vs actual, segments, cues, history) and adds a **replay**,
"What you knew, in order":

- strictly the records written up to and including `session_ended`; notes and corrections appended afterwards are
  *counted* ("N notes recorded after the LIVE ended… not replayed") but never placed on the timeline;
- lanes: Plan, Actual, Decision (lime), Operator report; each decision/report shows **what the plan expected and what was
  actually running at that moment**, which answers "why did I decide that, then?";
- a standing line: *Provider evidence available then: none recorded in LiveLift.* LiveLift cannot see what TikTok's own
  screens showed the operator, so it says exactly that and no more;
- progressive disclosure: decisions and reports first; "Show every recorded step (N more)" reveals segment starts/ends.

The AI Copilot, in this perspective, hides provider facts and any AI statement that rests on one, and counts what it hid.

## 4. With later evidence

Selecting it **never mutates the session** (view state only; `?perspective=later` can be shared). The first thing on screen
is one sentence: **"This data was not available to the operator during the LIVE."**, with provenance beneath it (tier, fetched
time, source). Then:

1. **Provider evidence on the recorded show**: one bar per provider minute, aligned to the segments the operator recorded.
   A metric picker (Clicks, Orders, GMV, Viewers, Impressions, Comments) shows one series at a time. Every bar starts at
   zero; a direct label gives the peak; a table twin ("Minute-by-minute table") carries every value.
2. **Segment attribution**: per segment: recorded duration (operator's record) with overrun/underrun in words, headline
   Clicks/Orders/GMV, attribution coverage, and a per-row **Details** disclosure with all metrics, boundary minutes and
   limitations. Segments that never ran are one quiet line, not a row of dashes.
3. **Observed patterns**: association statements only ("higher during", "rose from … to …", "overran while … stayed at or
   above"), each with the provider minutes it rests on.
4. **Product performance**: per-product provider figures for the whole LIVE.
5. Aside (desktop) / below (tablet, phone): **Where this came from** and **What this cannot tell you**.

Layout: phone stacks everything; tablet pairs duration beside evidence; the two-column split (content + provenance) and the
five-column attribution grid only appear on wide desktops.

## 5. Provider evidence semantics

- `LiveIntelligenceSnapshot.perspective` is always `later_evidence`. A snapshot that is not, that names another show, or that
  identifies itself as fixture/SIMULATED for a REAL show is **refused** and shown as "LiveLift could not trust the evidence".
- A provider metric that is not `available` carries no value. `available` without a number is read as *missing*.
- Absent states are their own screens, each stating that the figure is *unknown, not zero*:
  not configured · access not granted · authorization expired · rate limited (with retry hint) · unsupported by the official
  API · still settling · unavailable/untrusted · signed out · local archive (not in the room).
- Evidence is fetched only when the operator opens it (Review → "With later evidence", Insights → "Check provider evidence").

## 6. Missing and zero

| Value | Number/table | Chart | Words |
|---|---|---|---|
| Recorded 0 | `0` (`data-state="zero"`) | a 2px tick on the baseline | "Recorded as 0" in the key; "all 0" on the metric picker |
| Not recorded | *Not recorded* (italic) | a hollow ring at the baseline; **no bar** | "Not recorded (N)"; "not recorded" on the picker |
| Unsupported | *Not offered by the provider* | no chart; a note | "This is not zero." |
| Unknown | *Unknown* | none | |
| Sum with holes | `≥ 1,234` | n/a | "N min not recorded" |

CTOR is only ever the provider's figure. With 0 clicks and no CTOR it reads *Not defined (0 clicks)*, never `0%`. A GMV
amount always names its currency, is never added across currencies, and with no stated currency is a bare number labelled
"currency not stated".

## 7. Ambiguous attribution

A one-minute provider bucket can straddle two segments. That is intentional, not an error. The minute is **not assigned to
either segment**: it is drawn as a **hollow, dashed bar** on the chart, counted in the key ("Boundary minute: overlaps two
segments, not assigned to either"), listed in the segment's Details ("Attribution ambiguous at this boundary… overlaps this
segment and "X". Not assigned to either."), and labelled `Boundary: A | B` in the minute table. Segment totals contain only
minutes that lie fully inside the recorded window; observed patterns also leave boundary minutes out.

## 8. Operator quick cues

TikTok exposes no raw LIVE comment text and no pin events, so the operator is the only observer. **Quick report** (Operate
toolbar, beside **Note**) offers: *Price questions rising · CTA delivered · Product pin changed · Audience reaction spike ·
Unexpected issue*.

- Header: **OPERATOR REPORTED**. Footer: "LiveLift cannot read TikTok comments; this is what you saw, not a platform confirmation."
- Recorded through the **existing `add_note` command** as `"<label> (operator-reported quick cue)"`. The authority stamps the
  time. No new event type, no authority/schema change, no provider state, no effect on segments, cues or the plan.
- Review recognises the fixed suffix and labels the entry **Operator reported** in the operator lane of the replay.
- Keyboard: trigger opens and focuses the first cue; Up/Down wrap; Enter/Space record; Escape closes and returns focus. On a
  phone it is a bottom sheet (thumb reach); from `sm` it is a compact two-column popover under the toolbar.
- The toolbar is a `fieldset`: a read-only viewer or an unreachable room disables it with everything else.

## 9. Fixture presentation

Fixture provider evidence exists **only for SIMULATED rehearsals**, never for REAL (enforced in `fixtureResultFor`, and again
by the client adapter, which rejects fixture-labelled data for a REAL show).

- Banner: **FIXTURE PROVIDER EVIDENCE · SIMULATED. Not TikTok data, and never shown for a REAL show.** with a **Fixture state**
  picker: Rich · Ambiguous boundary · Repeated product mapping · Zero clicks · Missing clicks · Zero GMV · Missing GMV ·
  Unsupported comments · Not configured · Access not granted · Authorization expired · Rate limited · Unavailable.
- Deterministic: generated from the show's own recorded times, no randomness, parsed through the same parser as real data.
- Deep link: `/live/<id>/review?perspective=later&evidence=<state>`.
- Insights shows no fixture by default (it states "Unavailable: no provider-observed…"); fixture evidence needs an explicit,
  labelled opt-in.

## 10. Competition / demo flow

1. **Home**: the loop; Review step now notes later evidence "stays separate".
2. **Simulator → Prepare → Operate** (`sim-buffered`): apply two scripted steps, tap **Quick report → CTA delivered**
   (keyboard works), finish the rehearsal.
3. **Review → As known then**: the replay shows the quick cue as *Operator reported*, with the plan-versus-actual context.
4. **Review → With later evidence**: read the disclosure first, then the chart (try Orders, then Clicks), open a segment's
   **Details**; switch **Fixture state** to *Ambiguous minute boundary*, *Missing clicks*, *Zero clicks*, *Rate limited*.
5. **Insights**: *LiveLift operations* above, *Platform evidence* below; opt into the fixture and read Product performance.
6. **AI Copilot** (Review): operations evidence vs provider evidence vs interpretation vs "Recommended, not applied".
7. **Integrations**: **Provider evidence access**: CONNECTED / ACCESS NOT CONFIGURED / PARTNER ACCESS REQUIRED / UNSUPPORTED BY
   OFFICIAL API.

## 11. Impeccable design principles used (Operate mode)

- **Operate, not Persuade.** A professional livestream desk: scannable, calm, dense where useful, truthful. No hero metrics.
- **Evidence beside the show it describes.** One timeline-aligned chart and a table beat a dashboard of tiles.
- **Thin marks, one axis, honest zero.** Bars start at zero, capped width, 2px gaps; no dual axes, no gauges, no pies.
- **Every chart has its table.** The minute table and the attribution table carry the same facts as words.
- **Progressive disclosure over density.** Headline metrics inline; the rest behind per-row **Details**; the minute table
  behind a disclosure; "every recorded step" behind a toggle.
- **Uncertainty looks deliberate.** Hollow dashed bars and a sentence, not an error banner.
- **No decoration.** No gradients, glows, glass, nested cards, kickers or pill ladders. Cards only where a surface is a region.
- **Restrained colour with fixed roles** (section 2); states are words first.
- **Mobile is designed, not collapsed.** Stacked rows, a bottom-docked quick-report sheet, one metric column in the minute
  table, labels that disappear rather than truncate to a letter. All V7 targets ≥ 44px.
- **Native semantics.** Tabs with arrow/Home/End, a radio group for metrics, `details`/`summary`, real tables, `aria-expanded`.

## 12. File map

```
next/src/lib/intelligence/        client-local types, parser, HTTP client, formatting, fixtures, derivations (no server code)
next/src/components/intelligence/ PerspectiveTabs, EvidenceTimeline, SegmentAttributionTable, ProductPerformanceTable,
                                  ReplayTimeline, LaterEvidenceView, PlatformEvidencePanel, CapabilityLedger, ProviderState,
                                  EvidenceParts, useLiveIntelligence
next/src/components/ops/QuickReports.tsx
next/src/__tests__/v7/            intelligence.lib, review.perspective, quickreports, evidence.components
next/acceptance/live-intelligence-browser.mjs   browser acceptance for the V7 surfaces
```

## 13. Integration notes for the provider-core lane

The client assumes this seam and nothing more. Everything is in `lib/intelligence/types.ts` (types) and `client.ts` (routes
and envelope); swapping in the shared contract should be a one-file change each.

- `GET /api/v3/live-intelligence/sessions/{sessionId}` → either the snapshot itself, or
  `{ status: "available", snapshot }`, or `{ status: "not_configured" | "access_not_granted" | "auth_expired" | "unsupported" |
  "rate_limited" (retryAfterSec) | "unavailable" (message) | "pending" }`. HTTP 401 → signed out; 403 → forbidden; 429 (+
  `Retry-After`) → rate limited; 501 or an empty 404 → "not set up"; a JSON 404 with an error code → "no evidence on file".
- `POST …/sessions/{id}/refresh` → same answer; operators only.
- `GET /api/v3/live-intelligence/capabilities` → `{ capabilities: [{ key, state, note?, checkedAtMs? }] }` for keys
  `shop_analytics`, `creator_realtime` (states: available · connected · not_connected · not_configured · access_not_granted ·
  partner_access_required · rate_limited · auth_expired · unavailable · unsupported · unknown). `raw_chat` and `pin_control` are fixed
  facts and cannot be overridden.
- Snapshot: timestamps may be epoch ms or ISO; `fetchedAt`/`fetchedAtMs` both work; numbers may be numeric strings; absent
  numbers are *missing*. Metric keys `product_clicks`, `product_impressions`, `comment_count`, … are normalised.
  Optional: `currency` (snapshot or product row), `matchedProductId` on a product row (the server's own mapping to a LiveLift
  product wins over id/code/name matching), `ambiguousBuckets` as numbers or `{startMs,endMs,otherSegmentId}`.
- **The UI treats `provider` containing "fixture", `fixture: true` or `mode: "SIMULATED"` as fixture data and refuses it for a REAL
  show.** Do not label real data that way.
- AI: to feed provider evidence to Review AI, tag those facts `kind: "provider_observed"` (or topic `provider_*`). The UI
  groups, labels and (in *As known then*) withholds them. `contracts/ai.ts` was not modified.
- Until the routes exist the UI shows "No provider evidence is set up on this server" (a 404 on `/api/v3/live-intelligence/*`
  is therefore *expected*). The final-competition harness accepts exactly that 404 (see `acceptance/final-competition.mjs`).
