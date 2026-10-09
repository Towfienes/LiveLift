# LiveLift mockup v2: design notes

Clickable mockup for AISC'26 round 2 (22/10/2026). Scripted sample data, no backend, SIMULATED platform.
Open `dist/index.html` (or `npx serve dist`). Source in `app/`, key states in `screens/`.
The direction was chosen from `dist/style-tiles.html` (`screens/00-style-tiles.png`).

## 1. Direction: Soft Commerce (light), with Control Room as the dark theme

Three tiles were built with the same content (the suggestion card, its reasons, confidence, a SIMULATED tag):
Calm Studio (warm paper, editorial), Control Room (graphite, one bright accent), Soft Commerce (cool light, rounded, one red).

**Chosen: Soft Commerce.** Why, in five lines:
1. The judge's taste is "thân thiện, sạch, đẹp ngon"; Soft Commerce is the only tile that reads friendly without reading childish.
2. Light, cool-tinted neutrals survive a hall projector and print well on slides and the poster; graphite and paper do not.
3. One red signal colour ("đang phát") is reserved for LIVE and the primary action, so the eye goes straight to the answer and the pin button.
4. Rounded radii (10/14/20) and soft chips fit Vietnamese live-commerce vernacular; Calm Studio looks like a magazine, not a tool.
5. Control Room is kept as the dark theme, because operators who sell at night do want a dark desk.

## 2. Design plan, and what I changed after checking it against the brief

| | Plan | Revised after review |
|---|---|---|
| Colour | Cool neutral ramp, red signal `#D61F45`, violet `#5A3FC4` for SIMULATED, green, amber, red for status | Product **Ghim** buttons started solid ink (too heavy: four black buttons beside the hero), so they became outline buttons. The recap bands for pinned products started red and violet, which would have broken "violet = SIMULATED", so they became neutral shades. |
| Type | Be Vietnam Pro (designed in Vietnam, complete tone marks), 400/500/600 | One family only. The headline is never split into an accent word; size and weight carry the hierarchy. |
| Layout | 3 columns: products + phone, the answer + chart, comments | First cut put three boxed "why" tiles inside the answer card, which is cards inside cards. They became one row split by hairlines. |
| Principle | One dominant answer; everything else is evidence | Kept. The answer card is the only element with a shadow on the desk. |

Live Desk at 1920×1080. At most five focal elements: the answer, products, chart, comments, phone.

```
┌ LiveLift  [Quan sát | Đề xuất | Thí nghiệm (khoá)]          ● LIVE 04:00 | 182 người xem  Đã lưu  [Hành trình dữ liệu] [Kết thúc live] ┐
├────────────────┬──────────────────────────────────────────────┬──────────────────┤
│ Sản phẩm  4     │  Trợ lý đọc 2 phút gần nhất        dữ liệu SIM │ Bình luận    SIM │
│ ┆Trợ lý gợi ý┆   │  Nên ghim tiếp: Áo hoodie zip   (40 px)       │ [Hỏi giá 7][size]│
│ Áo hoodie [Ghim]│  7 hỏi giá │ 8 thêm giỏ (trước 3) │ 24 kho    │ [Chốt][Khác]     │
│ Quần cargo      │  ▬▬▭ Độ tin cậy trung bình, 12 bình luận       │ viewer_8608 …    │
│ …               │  [Ghim Áo hoodie zip]  Bỏ qua                  │ viewer_5168 đã che│
│ SIMULATED phone │  Flash sale: chưa đủ tín hiệu 6/10           │ …                │
│  ┌──────┐       ├──────────────────────────────────────────────┤                  │
│  │ LIVE │       │  Người xem (line) / thêm giỏ mỗi phút (bars)   │ che số điện thoại │
│  │ pin  │       │  pin markers, hatched gap = no data            │   thoại, đã che 3 │
├────────────────┴──────────────────────────────────────────────┴──────────────────┤
│ Dữ liệu mẫu  SIMULATED · ‹ 6/16 Thêm tín hiệu › Tự chạy · ▶ 15× 60× +1 phút · Về dữ liệu này · Giao diện tối · Phím tắt │
└───────────────────────────────────────────────────────────────────────────────────┘
```

Content is left-aligned throughout. Only the empty states and modals are centred.

## 3. Tokens (`app/src/tokens.css`)

Every colour, type, space, radius and motion value is a CSS custom property. Light is the default; dark is set with `data-theme="dark"` (key `T`).

| Group | Values |
|---|---|
| Type | Be Vietnam Pro, self-hosted as inlined woff2 (Latin, Latin-ext and Vietnamese subsets; weights 400/500/600). Scale 12/13/14/16/20/28/40/56. Tabular lining figures everywhere (`font-variant-numeric`). Display tracking −0.025em. |
| Space | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 on an 8 px grid. |
| Radius | 10 (buttons, small), 14 (chips, popovers), 20 (panels). |
| Neutrals (light) | bg `#F3F4F7`, surface `#FCFCFD`, surface-2 `#EEF0F4`, line `#E1E4EA`, ink `#171A21`, ink-2 `#4A5060`, ink-3 `#5F6676`. Never pure black or white. |
| Neutrals (dark) | bg `#15181E`, surface `#1C2028`, ink `#EEF0F4`, ink-2 `#B9BFCA`, ink-3 `#959DAB`. |
| Signal (LIVE + primary only) | `#D61F45` light, `#FF5470` dark. |
| SIMULATED | violet `#5A3FC4` / `#B9A8FF` with soft fill; used for nothing else. |
| Status | ok `#136C3E`, warn `#8F5200`, bad `#B42323` (dark: `#5FD39A`, `#F2B65A`, `#FF8A80`). |
| Elevation | Hairline borders; one shadow level, used only on the answer card, the active setup step and overlays. |
| Motion | 120 / 200 / 320 ms, `cubic-bezier(.2,.8,.2,1)`. |

## 4. Motion rules

- Only `transform` and `opacity` animate (plus colour on hover and press).
- New comments slide in 8 px; numbers tick in 320 ms; the answer enters with a lift and a 0.985→1 scale when its meaning changes.
- The product list reorders with FLIP; pin markers drop 10 px onto the chart; the recap line draws in; screens crossfade with an 8 px shift; buttons press to 0.97.
- **The LIVE dot pulse is the only looping animation.** Skeletons are deliberately static (no shimmer) to keep it that way.
- `prefers-reduced-motion` (or `?motion=reduce`) removes every animation and the pulse. Story replays (`←`, `1/2/3`, URL jumps) render instantly with no entrance animation.

## 5. Honesty rules, and where each one shows

| Rule | In the UI |
|---|---|
| SIMULATED platform | Violet tag on the products panel (pin state), comments, chart, answer ("dữ liệu SIMULATED"), the phone caption, setup step 1, the setup table status, the banner, and the dock. Nothing says "kết nối Shopee", "đồng bộ với Shopee" or "confirmed by Shopee"; `verify.mjs` scans the build for these. |
| Missing ≠ zero | Tote shows "Giá, tồn kho chưa nhập" and "Chưa nhập", never 0. Viewers during the platform condition show "chưa rõ". The chart draws a hatched "Không có dữ liệu" gap, not zeros; the recap lists that gap under "Điều chưa biết". Orders are "Chưa biết". |
| Recommendation ≠ acceptance ≠ performed | Product row: dashed "Trợ lý gợi ý, chưa ghim" chip (proposal), then "Đang gửi lệnh ghim…" (attempt), then solid "ĐANG GHIM · SIMULATED" once the simulated platform shows it (performed). Recap table: Nhận / Bỏ qua / Tự làm / Không phản hồi. |
| Operator reported ≠ platform observed | During "Hết hạn quyền truy cập" the pin button becomes "Ghi tay", and the pinned row says "bạn ghi tay", not SIMULATED. |
| Observation ≠ causation | The answer says "Tín hiệu … cho thấy". Under the chart: "Vạch dọc … cho biết khi nào, không chứng minh vì sao". The first "Điều chưa biết" item is exactly that question. |
| Confidence from sample size only | Thấp < 8, trung bình 8–19, cao ≥ 20 comments about the product in 2 minutes. Shown as a 3-segment meter plus the count; no percentages. The rule is in "Về dữ liệu này". |
| Sample data labelled | "Dữ liệu mẫu" in the dock and on the recap; setup states it in words. |
| Personal data masked | Phone numbers become `••••••••••` with a green "đã che" chip; the comments footer counts them. |
| Experiment locked | "Thí nghiệm" carries a lock; the popover says "Cần phiên từ 90 phút và đủ người xem" and nothing pretends to run. |

Platform facts: the mockup invents none beyond the SIMULATED platform's own behaviour. It does not claim Shopee has any particular API, limit or error. "Hết hạn quyền truy cập" is presented as a condition the SIMULATED platform reports.

## 6. Design intent versus what this mockup actually does

| Element | In the mockup | Intent for the real product (November) |
|---|---|---|
| "Đã lưu" in the header | **Design intent only.** Nothing is saved; there is no server. The drawer says so in plain words. | Every action and every signal is written to the database (round 4 requires a demo connected to a DB). |
| The assistant | Real rules in `app/src/engine.ts` (2-minute window, thresholds, cooldowns), run on scripted data. | Same rules, real or SIMULATED feeds. |
| Platform | SIMULATED Shopee Live, in the page. | Real platform where permitted; SIMULATED otherwise, still labelled. |
| CSV import | Always loads the sample pack, and says so if you paste something else. | Parse the seller's CSV, with row-level errors. |
| Experiment mode | Locked. | Switchback experiment once sessions are 90+ minutes. |

## 7. Accessibility

- WCAG AA contrast in both themes; axe-core reports 0 violations on 18 states × 2 themes × 2 viewports (`npm run verify`).
- Visible 2 px focus ring on every control; skip link; landmarks (`header`, `main`, `footer`, `nav`); one `h1` per screen.
- Full keyboard: every control is reachable by Tab; dialogs trap focus, close on Esc and return focus; the story runs on `→`.
- 44 px targets for buttons, mode switch and dock controls.
- Charts are `role="img"` with a full-sentence summary; the recap table and intent counts carry the same numbers as text.
- `aria-live` only on the answer, the flash-sale row and the platform banner (`role="alert"`); never on the comment stream.
- `prefers-reduced-motion` honoured fully.

## 8. Decisions made without asking

- **Stack:** Preact + TypeScript, bundled by esbuild into one inlined `index.html`. That makes it work from `file://`, where module scripts and cross-file fonts are blocked. Size is about 320 KB. A strict CSP (`connect-src 'none'`) makes "no network" a guarantee, not a promise.
- **One pinned product at a time.** The story's unpin followed by a pin reads as "đổi ghim".
- **A suggestion counts as "Nhận"** only if it had been on screen at least 5 s before the operator acted. Otherwise the action is "Tự làm" (the cargo switch in the story).
- **Flash sale rule:** pinned ≥ 1 min, ≥ 10 add-to-cart in 2 min and rising, stock ≥ 10. The brief's "chưa đủ tín hiệu" shows the count, e.g. 6/10.
- **The journey overlay** is shown on the richest moment of the story (04:00, the medium suggestion), so all six stages point at real content. Beat 16 rebuilds that moment.
- **"Đơn hàng: Chưa biết"** is a KPI on its own, rather than an omitted one.
- **Mobile (390 px):** single column, answer first. Graceful, not designed to the same polish as the projector sizes.

## 9. Self-assessment (after four review rounds)

| Criterion | Score | What would make it a 5 |
|---|---|---|
| First-glance clarity | 4 | Run a 10-second test with three people who have never seen LiveLift, and fix whatever they misread. |
| Hierarchy | 4 | The phone preview's dark mass still pulls the eye at 1920; a lighter host frame would calm it. |
| Spacing rhythm | 4 | At 1280×720 the desk compresses to 12 px gaps and the chart to about 130 px tall; a dedicated short-screen layout would help. |
| Typography | 4 | Hand-tune kerning of the 40/56 px numerals, and verify stacked tone marks (ẩ, ổ) on the projector itself. |
| Colour and contrast | 4 | The dark theme's pinned row (red tint) is a little heavy; test on the actual UIT projector. |
| Motion quality | 4 | Profile the 60× clock on a low-end laptop and confirm 60 fps; add a shared-element move from suggestion to pinned row. |
| Honesty of labels | 5 | — |
| State coverage | 4 | Design a real CSV error state (bad row, duplicate name) for when CSV parsing exists. |
| Story flow | 4 | Rehearse with a stopwatch and trim beats that run over 6 s. |
| Polish | 4 | A second pass on the 390 px layout, and a lighter "Khung hình người dẫn" placeholder. |
