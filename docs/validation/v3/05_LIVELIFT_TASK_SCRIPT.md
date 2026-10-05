# LiveLift V3 Operator Task Script & Live Desk Execution Runbook

**Document ID:** `VAL-V3-LIVE-05`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 3 (Execution Runbooks & Checklists)  
**Classification:** Standard Operating Procedure & Operator Runbook  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §7, §21, §28; `docs/validation/v3/00_VALIDATION_PROTOCOL.md`; `docs/validation/v3/04_TEST_SCENARIO.md`; `docs/validation/v3/07_DISTURBANCE_TIMELINE.md`

---

## 1. Executive Summary & Purpose

This document provides the authoritative, step-by-step operational runbook for the live-room operator running the **LiveLift Commerce Operations Desk** during experimental validation trials.

### 1.1 The Operator's Operational Role
In TikTok Shop live commerce broadcasts across Vietnam and Southeast Asia, the behind-the-camera operator is the air-gapped human bridge between studio pacing, merchandising systems, and on-camera talent:
1. **Pacing Governance:** Tracking active elapsed time against the run-of-show (ROS) budget, protecting committed promotional windows, and preventing catastrophic schedule drift.
2. **Platform Console Execution:** Manually pinning and unpinning product cards in TikTok Shop Seller Center, verifying active discount vouchers, and monitoring inventory depleting in real time.
3. **Talent Coordination:** Providing glanceable, low-noise cues to the on-camera host without inducing teleprompter glaze, cognitive overload, or speech stumbles.
4. **Post-Show Accounting:** Recording execution actuals for brand proof-of-performance and commission reconciliation.

### 1.2 Certified Feature Reality & Wizard-of-Oz Boundaries
In strict compliance with the **Integrity Mandate** and the rule that *"Never pretend unfinished functionality exists"*, the operator interacts with the system strictly across certified operational boundaries:
- **`IMPLEMENTED` (Functional UI & In-Memory Engine):** Session creation (`/live/new`), rundown configuration (`/prepare`), live desk tracking (`/operate`), segment transitions (`Start segment`), duration extensions (`Extend +1m`), skips (`Skip segment`), direct override modal (`Choose next`), proposal hold (`Hold proposal`), operator note capture modal, manual platform action reporting modal, session wrap (`/wrap`), and review workspace navigation (`/review`).
- **`SIMULATED` (Static Data Fixtures):** Replay event streams (`FIXTURE_REPLAY_EVENTS`), Knowledge Lens filtering ("As Known Then"), static pulse metrics, pre-seeded learning objects, and Next LIVE change candidate toggles.
- **`WIZARD-OF-OZ` (Facilitator-Delivered Telemetry):** Dynamic cascading schedule deficit warnings, multi-option constraint-aware recovery cards, and host cue tablet mirror pushes.
- **`NOT AVAILABLE` (Platform / Autonomous Exclusions):** Automated native TikTok Shop pinning, automated voucher distribution, autonomous AI pacing engines, and private TikTok streaming APIs are strictly excluded. All platform actions remain manual in TikTok Shop Seller Center.

```
+----------------------------------------------------------------------------------------------------+
|                               LIVELIFT OPERATOR WORKSPACE ARCHITECTURE                             |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ DISPLAY 1: CONTROL DESK (Fullscreen F11) ]       [ DISPLAY 2: SELLER CENTER & OBS MONITOR ]     |
|  +-------------------------------------------+       +-------------------------------------------+ |
|  | LiveLift Commerce Operations Desk         |       | TikTok Shop Seller Center (Manual Pinning)| |
|  | - NOW Command Panel (Timer, Active Item)  |       | - Product Showcase Pin / Unpin Button     | |
|  | - NEXT Recommendation Band (Action, Cue)  |       | - Flash Voucher Activation Console        | |
|  | - Operator Toolbar (Extend, Skip, Override)|       | - Live Inventory Stock Ledger             | |
|  | - Run of Show Live Scroll List            |       | OBS Studio Master Stream Monitor (1080p)  | |
|  | - Recovery Drawer (WoZ Telemetry Prompts) |       | - Live Camera Return & Audio Levels       | |
|  +-------------------------------------------+       +-------------------------------------------+ |
|                                                                                                    |
|                                       COMMUNICATION BRIDGE                                         |
|                                                │                                                   |
|                                                ▼                                                   |
|                        [ ON-CAMERA HOST VIEW TABLET (Line of Sight) ]                              |
|                        - Synchronized Digital Countdown Timer                                      |
|                        - Active Presenting Product Code & SKU                                      |
|                        - Atomic Operator Instruction (<= 5 Words)                                  |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Pre-Show Preparation & Pre-Flight Protocol ($T-15\text{m}$ to $T-00\text{m}$)

Prior to broadcast kickoff, the operator must execute the pre-flight verification sequence.

### 2.1 Workstation Lockdown & Browser Kiosk Protocol
1. **Dedicated Fullscreen Kiosk:**
   - Launch Google Chrome on the primary operator display.
   - Navigate to the designated trial session URL: `http://localhost:3000/live/[SessionId]/operate`.
   - Press **`F11`** to enter fullscreen kiosk mode. Address bar, bookmarks bar, and system tray must be completely hidden.
2. **Navigation Trap (`beforeunload`) Activation:**
   - Verify that the browser's unload trap is active. 
   - *Test Procedure:* Press `Ctrl + R` (or `Cmd + R`). Confirm that the browser halts reload and displays: *"Changes you made may not be saved. Reload this site? [Cancel] [Reload]"*. Click **Cancel**.
   - *Warning:* The Next.js Phase 0 prototype stores session state in volatile memory (`simulatorEngine.ts`). Reloading the page clears all in-session runtime actuals. **Do NOT reload during an active trial.**
3. **Macro & Extension Audit:**
   - Confirm that no third-party automation tools, macro keypads (Stream Deck automations), AutoHotkey scripts, or countdown extensions are running.

### 2.2 System Configuration & Rundown Review
1. **Catalog & Rundown Audit (`/prepare`):**
   - Confirm pre-loaded product catalog:
     * **Scenario 1:** `CAT-COSMETICS-01` (AuraSkin: `SYS-INTRO`, `SKU-SERUM`, `SKU-TONER`, `SKU-KEMD`, `SKU-NANG`, `SYS-CLOSE`).
     * **Scenario 2:** `CAT-TECHFASH-02` (UrbanPulse: `SYS-INTRO2`, `SKU-TECH1`, `SKU-TECH2`, `SKU-FASH1`, `SKU-FASH2`, `SYS-CLOSE2`).
   - Verify that the planned duration totals exactly **15.0 minutes** (900 seconds) across 6 segments.
   - Confirm that the two hard promotion anchors are correctly tagged:
     * Scenario 1: Anchor 1 at $09:00:00$ (`SKU-KEMD`), Anchor 2 at $14:00:00$ (`SYS-CLOSE`).
     * Scenario 2: Anchor 1 at $10:30:00$ (`SKU-FASH1`), Anchor 2 at $14:00:00$ (`SYS-CLOSE2`).
2. **Clock Synchronization:**
   - Synchronize the operator workstation clock with the OBS studio master digital clock overlay within $\pm 0.5$ seconds.
   - Confirm that TikTok Shop Seller Center server time matches workstation wall-clock time.
3. **Host Display Link Verification:**
   - Verify that the host's auxiliary tablet screen is powered on, positioned directly under or adjacent to the primary camera lens ($< 15^\circ$ angular deviation).
   - Confirm facilitator remote push mirror responds within $\le 1.0$ second to operator status changes.

---

## 3. Live Desk UI Architecture & Operational Controls

The LiveLift Commerce Operations Desk (`next/src/app/live/[sessionId]/operate/page.tsx`) organizes runtime control into four high-visibility UI zones:

```
+----------------------------------------------------------------------------------------------------+
| 1. FOCUSED SHELL HEADER: Session Title · Environment · Elapsed (MM:SS) · Lead Op · [End LIVE]      |
+----------------------------------------------------------------------------------------------------+
| 2. DOMINANT COMMAND BAND (Top 40% of Screen):                                                      |
|  +---------------------------------------------+ +-----------------------------------------------+ |
|  | [NOW PANEL] (Active Runtime State)          | | [NEXT PANEL] (Recommendation & Action)        | |
|  | - Presenting SKU Avatar & Product Title     | | - Target Segment / Product Banner             | |
|  | - Operator Reported By & Timestamp          | | - Algorithmic "Why" Rationale Text            | |
|  | - ACTUAL ELAPSED (40px Font, MM:SS)         | | - [Accept recommendation] [Reject recommendation|
|  | - Remaining to Target (MM:SS)               | | - [Start Next Segment] [Hold proposal]        | |
|  | - Platform Pin Card: Status & Evidence Label| | - Guidance: "Start transitions runtime"       | |
|  +---------------------------------------------+ +-----------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
| 3. OPERATOR TOOLBAR (Quick Capture & Routine Controls):                                            |
|  [Report Presenting Mxx]  [Log Platform Action]  [Add note]  |  [Extend +1m]  [Skip]  [Choose next] |
+----------------------------------------------------------------------------------------------------+
| 4. LOWER REGION (Split 1.35 : 1):                                                                  |
|  +---------------------------------------------+ +-----------------------------------------------+ |
|  | [RUN OF SHOW SCROLL LIST]                   | | [SUPPORTING TAB REGION]                       | |
|  | - Segment 01 to 06 with Order Badges        | | - Tabs: [Queue] [Coverage] [Pulse] [History]  | |
|  | - Active Highlighting: Dark Green (#252D28) | | - Queue: Pending sequence & anchor countdowns | |
|  | - Target vs Actual Minutes Pill             | | - Pulse: Orders, GMV, conversion metrics      | |
|  | - [Return to Current] Scroll Snap Button    | | - History: Timestamped event audit log        | |
|  +---------------------------------------------+ +-----------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

### 3.1 Command Band Controls & Semantic Actions

#### The NOW Panel (`data-testid="now-panel"`)
- **Presenting Product:** Displays active product initials, alphanumeric code, and full title. Indicates operator reporting attribution (`Operator reported · lead · HH:MM:SS`).
- **`ACTUAL ELAPSED` Timer (`data-testid="now-actual-elapsed"`):** Large 40px digital readout displaying exact elapsed minutes and seconds since the current segment was started.
- **`Remaining to target`:** Countdown calculating:
  $$\text{Remaining} = \max(0, \text{TargetMinutes} \times 60 - \text{ElapsedSeconds})$$
- **Platform Pin Evidence Card (`data-testid="platform-pin-card"`):** Surfaces whether the active SKU is confirmed pinned on TikTok Shop. Because no native API exists, this defaults to `EvidenceLabel: unknown` with the note: *"No platform confirmation received."*

#### The NEXT Panel (`data-testid="next-panel"`)
- **Recommendation Status:** Displays `Recommended` (initial system proposal) or `Accepted by lead` (once operator confirms agreement).
- **Target Item & Rationale:** Outlines the upcoming product code and strategic rationale (e.g., *"Scheduled hero pitch to drive morning campaign momentum"*).
- **Button: `Accept recommendation` (`data-testid="accept-recommendation-btn"`):** Confirms operator acceptance of the proposal. **Critical Rule:** Accepting does **not** transition the broadcast runtime; it merely flags agreement.
- **Button: `Reject recommendation` (`data-testid="reject-recommendation-btn"`):** Dismisses the current proposal, causing the system to surface an alternative candidate.
- **Button: `Start [Next] segment` (`data-testid="start-segment-btn"`):** **The Authoritative Runtime Transition.** Clicking this button wraps the active segment, writes actual completion timestamps into in-memory state, advances the NOW cursor to the next item, and updates the host's display.
- **Button: `Hold proposal` / `Resume proposal` (`data-testid="hold-proposal-btn"`):** Pauses dynamic recommendation cycling while keeping the master broadcast clock running. Used during platform network freezes or host stalls.

### 3.2 Operator Quick Capture & Toolbar Actions
- **Button: `Report Presenting [SKU]` (`data-testid="quick-presenting-btn"`):** Fast one-click report that the host has physically introduced a specific item.
- **Button: `Log Platform Action` (`data-testid="quick-platform-report-btn"`):** Opens modal to log manual external platform operations:
  * Select Product (`selectedReportProductId`).
  * Action Type: `pin_product` or `apply_voucher`.
  * Status: `asserted_by_operator` (stored with verification state `unknown`).
  * If offline: Automatically routes to `draftStore.saveDraft` and displays the amber banner: `UNSYNCED DRAFT CREATED`.
- **Button: `Add note` (`data-testid="quick-add-note-btn"`):** Opens text capture modal. Allows operator to record unstructured runtime observations (e.g., *"Host answering chat question on skin compatibility"*).
- **Button: `Extend +1m` (`data-testid="extend-plus-one-btn"`):** Increments `targetDurationMinutes` by $+1.0$ minute for the active segment without altering the underlying pre-show baseline plan.
- **Button: `Skip segment` (`data-testid="skip-segment-btn"`):** Immediately marks the active segment as `skipped` in runtime memory and advances to the next pending item.
- **Button: `Choose next` (`data-testid="choose-next-btn"`):** Opens direct override modal listing all 6 segments. Clicking any segment immediately promotes it to active broadcast status, bypassing standard sequential order.

---

## 4. Scenario 1 Second-by-Second Execution Runbook (Cosmetics Catalog)

**Catalog:** `CAT-COSMETICS-01` (AuraSkin Vietnam)  
**Nominal Run:** $T = 00:00:00$ to $15:00:00$ (900 seconds)  
**Hard Promotion Anchors:** Anchor 1 at $09:00:00$ (`SKU-KEMD`), Anchor 2 at $14:00:00$ (`SYS-CLOSE`).

```
00:00       02:00                 06:00          09:00             12:00        14:00   15:00
  |-----------|---------------------|--------------|-----------------|------------|-------|
  [ 1. INTRO ]      [ 2. SERUM ]      [ 3. TONER ] [ 4. FLASH DEAL ] [ 5. NẮNG ]  [ CLOSE ]
                    ^               ^              ^                 ^            ^
                 04:30:          06:30:         09:00:00:         S4+1m15s:    14:00:00:
                 [CHAT STIMULUS] [EVAL D1]      [EVAL D2]         [INJECT D3]  [EVAL CLOSE]
                 Host stimulated 30s deficit    Did Flash start   Stockout!    End adherence
                 to pitch deep   vs Anchor 1    at 09:00:00?      Pull S5?     at 14:00:00
```

### 4.1 Second-by-Second Detailed Event Script

#### $T = 00:00:00$ — Session Kickoff (`SYS-INTRO`)
1. Proctor signals: *"Bắt đầu phiên live!"*
2. Operator observes LiveLift desk initialized on Segment 1 (`SYS-INTRO`). Planned target: 2.0m.
3. Verify timer starts ticking on `now-actual-elapsed`.
4. Switch to TikTok Shop Seller Center window: Verify stream is live and audio is balanced.
5. Host introduces broadcast, announces voucher goals, and teases the 09:00:00 Retinol Flash Deal.

#### $T = 01:45:00$ — Pre-Cue for Segment 2
1. LiveLift timer indicates `01:45` elapsed (15 seconds to target).
2. Inspect NEXT panel: Target shows `SKU-SERUM` (Hero 1: Serum Niacinamide).
3. Operator clicks `Accept recommendation` (`accept-recommendation-btn`).
4. Stage `SKU-SERUM` in TikTok Shop Seller Center showcase list.

#### $T = 02:00:00$ — Transition to Segment 2 (`SKU-SERUM`)
1. At exactly `02:00`, click **`Start Next segment`** (`start-segment-btn`).
2. NOW panel updates to `SKU-SERUM` (Hero 1). Timer resets to `00:00`. Target duration displays `4m`.
3. In Seller Center: Immediately click **Pin Product** for `SKU-SERUM`.
4. Return to LiveLift: Click `Log Platform Action` (`quick-platform-report-btn`). Select `SKU-SERUM`, action `pin_product`, click **Save**.
5. Host begins core product demonstration on camera.

#### $T = 04:30:00$ — Disturbance D1 Stimulus Injected
1. Proctor triggers mock audience chat question to host: *"Shop ơi da đang treatment bong tróc có xài được không, test lên da ngăm xem có vón không ạ?"*
2. Host reads comment aloud and begins detailed physical application on hand.
3. Operator monitors elapsed time. Notice pitch extends into technical deep-dive.

#### $T = 06:00:00$ — Scheduled Segment 2 Deadline Reached
1. LiveLift NOW timer reaches `04:00` (planned target elapsed).
2. Host continues detailed demonstration, answering audience inquiries.
3. Operator clicks **`Extend +1m`** (`extend-plus-one-btn`) to reflect operational reality without panicking. Target updates to `5m`.

#### $T = 06:30:00$ — Disturbance D1 Deficit Evaluation & WoZ Alert
1. Show clock reaches `06:30`. Active Serum elapsed time = `04:30`.
2. **WoZ Deficit Stimulus Delivered:** The facilitator triggers the simulated deficit card on the operator monitor:
   ```
   [CẢNH BÁO TIẾN ĐỘ: Dự phóng trễ 30s so với Flash Deal 09:00:00 (Thâm hụt: 0:30)]
   ```
3. **Recovery Options Presented in WoZ Drawer:**
   - *Option 1 (Buffer Absorption):* Truncate Serum at `07:00`; compress Segment 3 (Toner) from planned 3.0m to 1.5m (Floor: 1.0m). Anchor protected at exactly 09:00:00.
   - *Option 2 (Aggressive Compression):* Allow Serum to run to `07:30`; compress Toner to contractual floor of 1.0m. Anchor protected at exactly 09:00:00.
   - *Option 3 (Skip Intermediary):* Allow Serum to run to `08:00`; skip Toner entirely (0m). Reclaims 3.0m buffer. Anchor protected at 09:00:00.
   - *Invalid Option:* Attempting to compress Toner below its 1.0m contractual floor triggers invalid warning.
4. **Operator Decision & Execution:**
   - Operator selects **Option 1** or **Option 2** (valid buffer absorption).
   - Click `Add note`: Type *"Compressing S3 Toner to protect 09:00 Flash Deal"*.
   - Transmit atomic cue to Host Tablet: `[RECOVER: Rút Toner còn 1.5m | Giữ Flash Deal 09:00]`.
   - Host nods and begins wrapping Serum demo.

#### $T = 07:30:00$ — Transition to Segment 3 (`SKU-TONER`)
1. Host concludes Serum pitch: *"Dạ em qua mã Toner cân bằng ngay đây ạ!"*
2. Operator clicks **`Start Next segment`** (`start-segment-btn`).
3. In Seller Center: Unpin `SKU-SERUM`, click **Pin Product** for `SKU-TONER`.
4. LiveLift NOW panel updates to Toner. Target duration is adjusted to compressed target (1.5m).

#### $T = 08:30:00$ — Pre-Anchor Synchronization Window (D2 Prep)
1. Show clock reaches `08:30` (30 seconds before immutable Flash Deal).
2. In Seller Center: Navigate to Flash Sale campaign tab; locate `SKU-KEMD` (Kem Dưỡng Retinol 50% Flash Sale).
3. Transmit atomic cue to Host Tablet: `[ANCHOR: 30s đếm ngược FLASH DEAL Retinol]`.
4. Host alerts viewers: *"Còn đúng 30 giây nữa hệ thống sẽ mở Flash Deal 50% Kem Dưỡng Retinol, chuẩn bị sẵn tay trên nút mua nha cả nhà!"*

#### $T = 09:00:00$ — Hard Anchor 1 Execution (D2 Evaluation)
1. Master digital clock strikes exactly `09:00:00`.
2. Operator clicks **`Start Next segment`** (`start-segment-btn`) in LiveLift.
3. In Seller Center: Click **Pin Product** for `SKU-KEMD`.
4. Host counts down on air: *"5-4-3-2-1 mở deal! Giá sốc 295k chính thức mở bán!"*
5. Observer records Anchor Start Variance ($V_{\text{anchor}} = |t - 09:00:00|$). Target: $\le 15$ seconds.

#### $T = 10:15:00$ — Disturbance D3 Abrupt Stockout Injection
1. Segment 4 has run for 1m15s ($T_{\text{start}}(S4) + 1\text{m}15\text{s}$).
2. **Proctor Injects Stockout:** Mock Seller Center console flashes red alert:
   ```
   [MOCK CONSOLE ALERT]: CẢNH BÁO TỒN KHO: Mã hàng SKU-KEMD đã hết (Tồn kho = 0).
   ```
3. **Operator Recognition ($T_{\text{detect}}$):** Operator spots inventory depletion.
4. **Immediate Recovery Execution:**
   - In Seller Center: Click **Unpin** immediately on `SKU-KEMD`.
   - In LiveLift desk: Click `Choose next` (`choose-next-btn`) or click `Skip segment` (`skip-segment-btn`). Select Segment 5 (`SKU-NANG` — Kem Chống Nắng).
   - Transmit emergency cue to Host: `[STOP/HẾT HÀNG: Cắt Kem Dưỡng -> Chuyển Kem Nắng]`.
   - Host smoothly pivots on stream: *"Dạ 50 suất Kem Dưỡng đã cháy hàng hoàn toàn, hệ thống vừa tự động đóng giỏ hàng! Em xin phép chuyển ngay qua siêu phẩm chống nắng..."*

#### $T = 10:35:00$ — Disturbance D4 Platform Console Lag Injection
1. Dynamic transition into Segment 5 initiates.
2. Operator attempts to pin `SKU-NANG` in Seller Center.
3. **Proctor Injects Pin Lag:** 40-second network spinner locks Seller Center console:
   ```
   [SYSTEM BANNER]: Không thể ghim sản phẩm SKU-NANG. Đang kết nối máy chủ... (Thử lại trong 40 giây)
   ```
4. **Operator Response:**
   - Recognize that pin is delayed. Do NOT leave host stranded.
   - Click **`Hold proposal`** (`hold-proposal-btn`) in LiveLift desk.
   - Transmit holding cue to Host: `[HOLD: Minigame/Tương tác 40s trong lúc ghim]`.
   - Host deploys interaction filler: *"Trong lúc chờ hệ thống tải giỏ hàng, em xin phép tặng 3 phần quà cho các chị thả tim nhiều nhất nha..."*

#### $T = 11:15:00$ — D4 Cleared & Pin Confirmed
1. Network spinner resolves. Product card successfully pins in Seller Center.
2. Operator clicks `Resume proposal` (`hold-proposal-btn`).
3. Click `Log Platform Action` (`quick-platform-report-btn`): Select `SKU-NANG`, action `pin_product`, click **Save**.
4. Cues host: `[NOW: Đã ghim Kem Nắng | Giá 249k]`. Host resumes product pitch.

#### $T = 12:15:00$ — Disturbance D5 Host Under-run Stimulus
1. Segment 5 reaches $T_{\text{start}}(S5) + 1\text{m}00\text{s}$ (1.0m remaining before scheduled finish).
2. Host completes talking points quickly and signals on camera: *"Dạ mã chống nắng em chia sẻ xong rồi ạ, giờ mình chuẩn bị qua phần tiếp theo nha..."*
3. **Operator Pacing Recognition:**
   - Operator checks the clock: Current show time is $\approx 12:15$. Hard Anchor 2 (`SYS-CLOSE`) is locked to **14:00:00**.
   - **Critical Rule:** The operator must **NOT** transition to Segment 6 early. Ending early creates a 1.5-minute dead air void.
4. **Operator Execution:**
   - Transmit holding cue to Host: `[HOLD: Review swatch + Q&A giữ sóng đến 14:00]`.
   - Host pivots into audience interaction: *"Em thấy có chị hỏi da treatment dùng chống nắng này có rát không, em test lại chất kem trên tay nha..."*

#### $T = 13:30:00$ — Pre-Close Preparation
1. Show clock reaches `13:30` (30 seconds before closing cutoff).
2. LiveLift NEXT panel shows Segment 6 (`SYS-CLOSE`).
3. Operator transmits final cue: `[ANCHOR: Đúng 14:00 tổng kết chốt đơn]`.

#### $T = 14:00:00$ — Hard Anchor 2: Closing Transition
1. Clock strikes exactly `14:00:00`.
2. Operator clicks **`Start Next segment`** (`start-segment-btn`).
3. Host begins official outro: announces last 60 seconds to complete pending carts, reviews 7-day return policy, and teases tomorrow's 20:00 session.

#### $T = 15:00:00$ — Broadcast Sign-off & Wrap Transition
1. Clock strikes `15:00:00`.
2. Proctor calls: *"Hết giờ phát sóng! Hoàn thành phiên live!"*
3. Operator clicks **`End LIVE`** in top header (`onEndLiveClick`).
4. Modal confirms: *"End Live Tracking? [Cancel] [Confirm End]"*. Click **Confirm End**.
5. Browser automatically transitions to `/live/[sessionId]/wrap`.

---

## 5. Scenario 2 Second-by-Second Execution Runbook (Fashion/Tech Permuted)

**Catalog:** `CAT-TECHFASH-02` (UrbanPulse Studio)  
**Nominal Run:** $T = 00:00:00$ to $15:00:00$ (900 seconds)  
**Hard Promotion Anchors:** Anchor 1 at $10:30:00$ (`SKU-FASH1`), Anchor 2 at $14:00:00$ (`SYS-CLOSE2`).

```
00:00    01:30                05:00                           10:30             12:30        14:00   15:00
  |--------|--------------------|-------------------------------|-----------------|------------|-------|
  [ INTRO ][ 2. POWERBANK MAG ] [ 3. TAI NGHE ANC PRO ]         [ 4. FLASH TEE ]  [ 5. CARGO ] [ CLOSE ]
           ^                    ^                               ^                 ^            ^
        03:15:               06:15:                          10:30:00:         13:15:       14:00:00:
        [INJECT D3]          [INJECT D1]                     [EVAL D2 & D4]    [INJECT D5]  [EVAL CLOSE]
        Stockout!            Host overruns past 09:00        Flash Sale Anchor Under-run!   End adherence
        Pivot to S3?         Deficit vs Anchor 1 (10:30)     Pin lag freeze    Fill to 14m? at 14:00:00
```

### 5.1 Permuted Operational Choreography Table

| Elapsed (mm:ss) | State Anchor | Context & Stimulus | Operator Action on LiveLift Desk | Action in Seller Center / Chat | Scoring & Recovery Target |
|:---:|---|---|---|---|---|
| **00:00** | $T_{\text{start}}(S1)$ | Stream Kickoff (`SYS-INTRO2`). Planned: 1.5m. | Verify timer running on `now-actual-elapsed`. | Confirm OBS stream feed; monitor audio. | Setup verified $\pm 5$s. |
| **01:30** | $T_{\text{start}}(S2)$ | S1 ends. Transition to S2 (`SKU-TECH1` MagSafe). Planned: 3.5m. | Click `Start Next segment` (`start-segment-btn`). Target = 3.5m. | Pin `SKU-TECH1` in Seller Center. Log platform action in LiveLift. | Transition within $\le 5$s. |
| **03:15** | **$T_{\text{start}}(S2) + 1\text{m}45\text{s}$** | **INJECT D3 STOCKOUT:** Mock console alerts `SKU-TECH1` stock = 0. | Operator detects stockout ($T_{\text{detect}}$). Cues host to halt pitch. | Unpin `SKU-TECH1`. Transmit cue: `[STOP/HẾT HÀNG: Cắt Sạc MagSafe -> Chuyển Tai Nghe]`. | **$T_{\text{detect}} \le 10\text{s}$**. Host halts pitch within $\le 15$s. |
| **03:45** | Early S3 Entry | Dynamic early transition to S3 (`SKU-TECH2` Tai Nghe ANC). | Click `Start Next segment`. NOW updates to `SKU-TECH2`. | Pin `SKU-TECH2` in Seller Center. Log platform action in LiveLift. | Clean early transition without dead air. |
| **06:15** | **$T_{\text{start}}(S3) + 2\text{m}30\text{s}$** | **INJECT D1 STIMULUS:** Proctor posts technical audio question to host. | Monitor active pitch. Host performs outdoor call test. | Observe pacing drift as pitch expands. | Natural overrun initiated. |
| **07:45** | **$T_{\text{start}}(S3) + 4\text{m}00\text{s}$** | **EVALUATE D1 DEFICIT:** S3 has run 4.0m. WoZ flashes: `[Dự phóng trễ 45s so với Flash Deal 10:30:00]`. | Operator reviews recovery drawer ($T_{\text{detect}}$). Formulates S3 wrap. | Selects valid recovery: wrap S3 by 09:30. Transmit: `[RECOVER: Chốt Tai Nghe trước 09:30 | Giữ Flash 10:30]`. | **$T_{\text{detect}} \le 10\text{s}$**. Recovery preserves 10:30:00 anchor. |
| **09:30** | S3 Wrap | Host concludes Earbuds demo. | Click `Hold proposal` or prepare transition. | Stage `SKU-FASH1` (Flash Deal Áo Thun Acid Wash) in Seller Center. | Pace re-aligned to anchor. |
| **10:00** | Pre-Anchor Sync | 30s before Flash Sale. | Check countdown to 10:30:00. | Transmit cue: `[ANCHOR: 30s đếm ngược FLASH DEAL Áo Acid Wash]`. | Pre-cue sent $\ge 20$s before 10:30:00. |
| **10:30** | **Absolute Wall-Clock** | **EVALUATE D2 ANCHOR 1:** Flash Deal unlocks. **INJECT D4 CONSOLE LAG:** 40s spinner on pinning `SKU-FASH1`. | Click `Start Next segment` in LiveLift. Recognize Seller Center pin spinner ($T_{\text{detect}}$). | Click `Hold proposal`. Transmit holding cue: `[HOLD: Minigame chọn size 40s trong lúc ghim]`. | **$V_{\text{anchor}} \le 15\text{s}$**. Zero dead air during pin spinner. |
| **11:10** | D4 Cleared | Network spinner resolves. Product pins. | Click `Resume proposal`. Log platform action in LiveLift. | Cues host: `[NOW: Đã ghim Áo Acid Wash 180k]`. Host pitches deal. | Pin verified on stream. |
| **12:30** | S4 End | Transition to S5 (`SKU-FASH2` Cargo Pants). Planned: 1.5m. | Click `Start Next segment`. NOW updates to `SKU-FASH2`. | Pin `SKU-FASH2` in Seller Center. Log platform action in LiveLift. | Transition within $\le 5$s. |
| **13:15** | **$T_{\text{start}}(S5) + 45\text{s}$** | **INJECT D5 UNDER-RUN:** Host exhausts styling tips; signals early wrap. | Recognize pacing void ($T_{\text{detect}}$). Do NOT advance S6 early. | Transmit holding cue: `[HOLD: Minigame chia sẻ live giữ sóng đến 14:00]`. | **Closing Anchor held at 14:00:00**. |
| **14:00** | **Absolute Wall-Clock** | **EVALUATE CLOSING ANCHOR:** Final closing window unlocks. | Click `Start Next segment`. NOW updates to `SYS-CLOSE2`. | Host begins outro and tomorrow teaser. | **$V_{\text{anchor}} \le 15\text{s}$**. |
| **15:00** | Final Cutoff | Broadcast concludes. | Click `End LIVE` -> Confirm End. | Stream offline in OBS. Transition to `/wrap`. | Total runtime = $15\text{m}00\text{s} \pm 15\text{s}$. |

---

## 6. Wrap & Post-Session Review Runbook

Once the broadcast ends, the operator completes the post-show workflow across the `/wrap` and `/review` views.

### 6.1 Session Wrap Workspace (`/live/[sessionId]/wrap`)
1. **Inspect Runtime Summary Card:**
   - Verify `Tracked duration`: Displays actual run length (nominal `15:00`).
   - Verify `Last active segment`: Displays `SYS-CLOSE` (closed when tracking ended).
   - Verify `Lead operator`: Displays operator ID with authority preserved.
2. **Reconcile Unsynced Drafts:**
   - Inspect the drafts list (`draftStore.getDrafts(sessionId)`).
   - For each draft created during offline or rapid capture (notes, platform actions), click **`Confirm & Submit`** (`handleConfirmDraftSubmission`).
   - Confirm status updates to `Submitted`.
3. **Capture Wrap Note:**
   - In the text field, enter high-level qualitative observations (e.g., *"Successfully recovered D1 overrun by compressing S3; managed D3 stockout without dead air"*).
4. **Transition to Review Workspace:**
   - Click **`Open Review`** button (`data-testid="wrap-open-review-btn"`).
   - Route transitions to `/live/[sessionId]/review`.

### 6.2 Review Workspace & Plan-vs-Actual Audit (`/live/[sessionId]/review`)

```
+----------------------------------------------------------------------------------------------------+
|                                    LIVELIFT REVIEW WORKSPACE                                       |
+----------------------------------------------------------------------------------------------------+
| Sub-Navigation:  [ (•) Replay ]   [ ( ) Learn ]                                                    |
|                                                                                                    |
| KNOWLEDGE LENS TOGGLE:                                                                             |
| [ (•) As Known Then (Live State) ]        [ ( ) With Later Evidence (Post-Live Reconciled) ]       |
|                                                                                                    |
| EVENT LOG FILTER:  [ All ]  [ Recommendations ]  [ Decisions/Actions ]  [ Telemetry Gaps ]         |
+----------------------------------------------------------------------------------------------------+
```

#### 1. Replay View & Knowledge Lens Investigation
1. **Examine Semantic Replay Event Log:**
   - Scroll through chronologically ordered events (`evt_01` to `evt_xx`).
   - Each event card displays: timestamp, event type (`decision`, `operator_report`, `gap_start`), actor attribution (`lead`), and evidence label (`asserted_by_operator` / `unknown`).
2. **Toggle Knowledge Lens:**
   - Click **`As Known Then`**: Filters out late-arriving events. Displays exactly what the operator saw live on desk.
   - Click **`With Later Evidence`**: Includes post-live reconciled data, unmasking discrepancies or delayed server confirmations.
3. **Inspect Plan-vs-Actual Variance:**
   - Compare planned baseline durations against realized timestamps.
   - Answer the 3-minute post-test Operational Fact Probes (e.g., exact Serum overrun duration, exact stockout timing) directly from the structured event list.

#### 2. Learn View & Next LIVE Rundown Adaptation
1. Switch to **`Learn`** view by clicking the Learn sub-navigation tab.
2. **Inspect Pre-Seeded Learning Objects:**
   - Review operational findings generated from session telemetry (e.g., *"SKU-SERUM consistently requires +1.5m for audience Q&A; S3 Toner can be permanently scheduled at 1.5m"*).
3. **Evaluate Next LIVE Change Proposals (`nextLiveChanges`):**
   - Review proposed adjustments for tomorrow's broadcast:
     * *Change 1:* Increase Serum baseline duration from 4.0m to 5.5m.
     * *Change 2:* Decrease Toner baseline duration from 3.0m to 1.5m.
     * *Change 3:* Advance Flash Sale initial stock reservation to 100 units.
   - Toggle selection checkboxes (`handleToggleChange`) to accept or reject recommended patches.
4. **Add Manual Operator Observation:**
   - Click `Add Observation` button (`isAddObservationOpen`).
   - Enter Title: *"Increase buffer before closing anchor"*.
   - Enter Description: *"Host ran out of talking points on sunscreen; add audience swatch poll to fill final 2 minutes"*.
   - Click **Save Observation**.
5. **Clone Session for Next Broadcast:**
   - Navigate to `/live/new`.
   - Select **Clone session** (`live/new/page.tsx`).
   - Confirm cloned session shell inherits approved baseline parameters with all segment execution states cleanly reset to `PENDING`.

---

## 7. Operator Troubleshooting & Human Error Mitigation

| Operational Anomaly | Immediate Root Cause | Operator Corrective Action | System Failsafe |
|---|---|---|---|
| **Accidental Segment Skip** | Operator accidentally clicked `Skip segment` instead of `Extend +1m`. | 1. Immediately click **`Choose next`** (`choose-next-btn`).<br>2. Select the skipped segment from the modal list.<br>3. Segment immediately resumes active status. | In-memory simulator updates segment state back to active; logs override in history. |
| **Accidental Browser Reload Attempt** | Operator brushed trackpad back-swipe or pressed `Ctrl + R`. | 1. Click **`Cancel`** immediately on the browser confirmation modal.<br>2. Return to fullscreen mode (`F11`). | Active `beforeunload` listener prevents silent page reloads. |
| **Draft Offline Indicator** | Amber banner: `UNSYNCED DRAFT CREATED` appears on screen. | 1. Continue live operations normally. The action has been safely saved in local memory (`draftStore`).<br>2. Reconcile and submit drafts during post-show Wrap view (`/wrap`). | Prevents operator panic during momentary client-side hiccups. |
| **Host Fails to See Cue Tablet** | Host distracted by camera or ring light reflections. | 1. Operator delivers brief backup hand signal (e.g. 5-finger countdown).<br>2. Verify tablet brightness is set to 100% and angle is $< 15^\circ$ from camera. | Observer 2 logs cue transmission latency and delivery channel. |
| **Double Button Click** | Operator double-clicks `Start Next segment`. | 1. Check NOW panel to see which segment is currently active.<br>2. If advanced two segments forward, click `Choose next` to select the intended segment immediately. | `Choose next` provides instant single-click random access to any segment. |

---

## 8. Governance Sign-Off

This document constitutes the standardized operational runbook for LiveLift desk testing across all participant trials. Any modifications to button mappings or execution sequences must be documented in a dated version addendum.

| Role | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Lead Technical Author** | Worker 3 | Lead Technical Author (M3) | 2026-10-05 | *[Signed]* |
| **Orchestrator** | Orchestrator 1 | Lead Systems Architect | 2026-10-05 | *[Signed]* |
| **Independent Auditor** | Auditor | Quality & Forensic Gatekeeper | 2026-10-05 | *[Pending Verification]* |
