# LiveLift V3 Strategic Decision Framework: BUILD vs PIVOT vs KILL

**Document ID:** `VAL-V3-DECI-13`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 4 (Measurement, Thresholds & Decisions)  
**Classification:** Strategic Governance Framework & Product Decision Logic  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §5, §16, §21, §28, §29; `docs/validation/v3/00_VALIDATION_PROTOCOL.md` §1, §3; `docs/validation/v3/11_PASS_FAIL_THRESHOLDS.md`

---

## 1. Executive Summary & Decision Mandate

This document establishes the authoritative strategic decision framework for LiveLift V3. Following empirical trials ($N = 6 \text{ to } 10$ participant pairs), the product leadership team must execute an irrevocable, evidence-backed decision among three strategic pathways:

1. **BUILD:** Advance to Phase 1 Engineering (Single-Device Functional Manual Product).
2. **PIVOT:** Decouple and reframe product architecture across three predefined operational pivots (**Pivot A: Desk-Only**, **Pivot B: Review-Only Companion**, or **Pivot C: Commerce Template / Rundown Plugin**).
3. **KILL / DO NOT ADVANCE TO PHASE 1:** Immediately terminate product investment, archive repository assets, and document lessons learned.

### 1.1 The Priority of Behavioral Evidence
In accordance with master project governance, **audited behavioral evidence strictly supersedes subjective participant opinion**:
- If operators express enthusiastic praise ("I love the UI!") but telemetry proves they missed hard anchors, suffered increased cognitive workload, or logged late transitions, the verdict is **FAIL**.
- If operators express skepticism of software additions but achieve $\ge 30\%$ faster recovery, zero critical misses, and $\ge 20\%$ lower cognitive workload, the operational advantage is **CONFIRMED**.

```
+----------------------------------------------------------------------------------------------------+
|                                      DECISION LOGIC FLOWCHART                                      |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|                                    [ EMPIRICAL VALIDATION TRIAL ]                                  |
|                                                  │                                                 |
|                                                  ▼                                                 |
|                                     [ ZERO-TOLERANCE AUDIT ]                                       |
|                                     Did prototype trigger:                                         |
|                                     - Silent Anchor Shift?                                         |
|                                     - False Confirmed Action?                                      |
|                                     - Lost Acknowledged Command?                                   |
|                                     - Prototype Crash / Freeze?                                    |
|                                                  │                                                 |
|                                   YES ───────────┴─────────── NO                                   |
|                                    │                           │                                   |
|                                    ▼                           ▼                                   |
|                                [ KILL ]          [ PRIMARY DESK THRESHOLDS ]                       |
|                             Automatic Term.      - Risk Awareness >= 80% <= 10s                    |
|                                                  - Recovery >= 30% faster & >= 90% valid           |
|                                                  - Critical Misses == 0                            |
|                                                  - Capture Burden <= 1 cmd, <= 3s                  |
|                                                  - TLX Workload >= 20% lower                       |
|                                                  - PVA Review <= 5m, >= 30% faster                 |
|                                                  - Operator Preference >= 70%                      |
|                                                                │                                   |
|                                ┌───────────────────────────────┼───────────────────────────────┐   |
|                                ▼                               ▼                               ▼   |
|                         [ ALL PASS ]                    [ PARTIAL PASS ]                 [ FAIL ]  |
|                                │                               │                               │   |
|                   Host View Sub-Study Check?            Diagnostic Audit                 Spreadsheet beats |
|                    ┌───────────┴───────────┐            - Host View fails? -> PIVOT A    LiveLift in >= 2  |
|                   PASS                    FAIL          - In-live rejected?-> PIVOT B    iterations.       |
|                    │                       │            - Standalone rej?  -> PIVOT C          │           |
|                    ▼                       ▼                                                   ▼           |
|                [ BUILD ]               [ PIVOT A ]                                         [ KILL ]        |
|             Phase 1 Product         Desk-Only Scope                                     Archive Project    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Pathway 1: BUILD (Advance to Phase 1 Single-Device Product)

### 2.1 Prerequisite Gate Clearance
Advancement to the BUILD pathway requires meeting **100% of the following criteria**:
1. **Zero Disqualification Triggers:** Zero occurrences of Silent Anchor Shifts, False Confirmed Actions, Lost Acknowledged Commands, or Prototype Crashes.
2. **Primary Desk Thresholds Met:**
   - *Risk Awareness:* $\ge 80\%$ of injected conflicts recognized within $\le 10$ seconds.
   - *Recovery Decision Speed:* Median decision latency $\ge 30\%$ faster than baseline.
   - *Recovery Constraint Validity:* $\ge 90\%$ of recovery choices mathematically respect product floors and downstream anchors.
   - *Critical Cue Reliability:* Exactly 0 unintended critical anchor misses; median anchor variance $\le 15$ seconds.
   - *Routine Capture Burden:* $\le 1$ command per transition, median capture latency $\le 3$ seconds, boundary error rate $E_{\text{PVA}} \le 10\%$.
   - *Operator Cognitive Workload:* Median raw NASA-TLX score $\ge 20\%$ lower than baseline ($p < 0.05$).
   - *Review & Next Plan:* Total review duration $\le 5$ minutes (median $\ge 30\%$ faster than baseline) with $\ge 90\%$ fact accuracy.
   - *Subjective Operator Preference:* $\ge 70\%$ of participating operators voluntarily choose LiveLift for tomorrow's real show.

---

### 2.2 Authorized Engineering Scope (Phase 1)
Clearance of the BUILD gate authorizes engineering to implement the **Phase 1 Single-Device Manual Operations Desk**:
* **Persistence Layer:** Durable local storage utilizing **browser-local IndexedDB or embedded SQLite (via OPFS / WebAssembly)**.
* **Architecture:** Strictly **single-device, zero-backend, offline-first**. All state machines, event logs, and command receipts execute within the local client runtime.
* **Studio Room Scope:** Strictly **one active room per device**. Multi-room concurrent dashboards are explicitly deferred.
* **External Integration Boundary:**
  - **Zero TikTok API Dependencies:** No reliance on private or unofficial TikTok endpoints.
  - **Manual External Action Reporting:** Product pins, voucher activations, and price changes remain strictly manual operator clicks logged as `operator_reported`.
  - **No Autonomous Automation:** No auto-pinning bots, no headless browser scraping, no AI auto-pacing.

---

### 2.3 Strict Phase 2 Prohibition
Clearance of the Phase 0 BUILD gate **DOES NOT authorize Phase 2 engineering**:
- Cloud synchronization, server backends, PostgreSQL databases, multi-tenant authentication, WebSockets, and agency multi-room features remain **STRICTLY PROHIBITED** until Phase 1 passes its own in-vivo field acceptance gate (**Gate G1**).

---

## 3. Pathway 2: PIVOT (Scoped Operational Reframing)

If the core Operator Desk demonstrates genuine operational superiority, but secondary subsystems create friction or fail their dedicated sub-study gates, product leadership must execute one of three predefined pivots:

```
+----------------------------------------------------------------------------------------------------+
|                                      PIVOT TAXONOMY & TRIGGERS                                     |
+-------------------+-----------------------------------+--------------------------------------------+
| Pivot Variant     | Trigger Condition                 | Strategic Reframing Action                 |
+-------------------+-----------------------------------+--------------------------------------------+
| **Pivot A**       | Host View fails message reduction | **Kill Host View entirely.**               |
| (Desk-Only)       | or causes talent distraction;     | Focus 100% of engineering on behind-the-   |
|                   | Operator Desk passes all metrics. | desk Operator Console. Existing Zalo/cues. |
+-------------------+-----------------------------------+--------------------------------------------+
| **Pivot B**       | In-live runtime logging is        | **De-emphasize live in-show tracking.**    |
| (Review-Only      | rejected as too heavy, but post-  | Pivot to post-show video/chat transcript   |
|  Companion)       | show variance review is valued.   | PVA reconciler & Next LIVE plan generator. |
+-------------------+-----------------------------------+--------------------------------------------+
| **Pivot C**       | Operators reject standalone app;  | **Abandon standalone web app.**            |
| (Template / Plugin| demand existing spreadsheet/chat  | Package LiveLift pacing formulas into      |
|  Architecture)    | or broadcast rundown tools.       | Google Sheets template + Zalo cue bot.     |
+-------------------+-----------------------------------+--------------------------------------------+
```

---

### 3.1 Pivot A: Desk-Only Pivot (Decouple & Terminate Host View)
* **Trigger Conditions:**
  1. Operator Desk passes all primary thresholds (Thresholds 01 through 06, 08, 09).
  2. Host View (Threshold 07) fails: Total coordination messages are reduced by $< 30\%$, host comprehension takes $> 5$ seconds, or hosts exhibit teleprompter glaze / speech stumbles on camera.
  3. Qualitative feedback from hosts indicates the tablet creates visual clutter or anxiety.
* **Operational Action:**
  - **Permanently eliminate the dedicated Host View screen** from Phase 1 scope.
  - Reframe LiveLift strictly as a **Behind-the-Desk Operator Pacing Cockpit**.
  - Operator continues to direct talent using the studio's native communication channel (physical whiteboard, hand signals, or existing Zalo chat).
  - Eliminates cross-browser synchronization overhead and multi-screen deployment friction.

---

### 3.2 Pivot B: Review-Only Companion Pivot
* **Trigger Conditions:**
  1. Live in-show runtime tracking (Threshold 05) fails: Operators report that clicking segment transitions during high-stress selling is an intolerable chore, resulting in $E_{\text{PVA}} > 10\%$.
  2. Post-show Plan-vs-Actual review (Threshold 08) and Next LIVE planning (Threshold 10) receive high acclaim ($\ge 80\%$ fact accuracy, $\ge 80\%$ preference for the planning engine).
* **Operational Action:**
  - **De-prioritize live-second-by-second tracking.**
  - Reframe the product as a **Post-Live Debrief & Rundown Planning Companion**.
  - System ingests simple post-show artifacts (exported TikTok Seller Center order curves, raw stream timestamps, or simple segment lists) to reconstruct pacing variances and output optimized next-day rundowns.
  - Removes the high-reliability real-time state machine requirement.

---

### 3.3 Pivot C: Commerce Template / Rundown Plugin Pivot
* **Trigger Conditions:**
  1. Operators demonstrate that an expertly configured Google Sheets workbook (with formulas and conditional formatting) achieves comparable recovery and pacing performance to LiveLift.
  2. Studio owners refuse to adopt another standalone web application, citing screen real-estate constraints or reluctance to pay SaaS subscriptions for dedicated tools.
  3. Advanced operators request integration into existing production ecosystems (e.g., Ontime broadcast rundown, OBS WebSocket docks, or Google Workspace).
* **Operational Action:**
  - **Discontinue standalone application development.**
  - Package LiveLift's proprietary constraint-aware scheduling formulas, dynamic deficit calculators, and flash-sale pacing algorithms into a **Production-Grade Google Sheets Master Template** paired with an open-source **Zalo/Telegram Cue Webhook Bot**.
  - Monetize via paid template licenses, studio consulting, or plugins for established broadcast suites (Ontime / Shoflo).

---

## 4. Pathway 3: KILL / DO NOT ADVANCE TO PHASE 1

### 4.1 Concrete Termination Triggers
Product leadership must **immediately terminate LiveLift V3 development** and block Phase 1 engineering if any of the following empirical conditions occur:

```
+----------------------------------------------------------------------------------------------------+
|                                  HARD TERMINATION TRIGGER MATRIX                                   |
+----+----------------------------+------------------------------------------------------------------+
| #  | Termination Trigger        | Concrete Empirical Evidence Condition                            |
+----+----------------------------+------------------------------------------------------------------+
| K1 | Baseline Spreadsheet       | The competent Google Sheets baseline matches or outperforms      |
|    | Dominance                  | LiveLift in Recovery Decision Speed (T_decision) and Review      |
|    |                            | Accuracy (A_facts) across two focused product iterations.        |
+----+----------------------------+------------------------------------------------------------------+
| K2 | Critical Operational Harm  | LiveLift induces >= 1 critical unintended anchor miss or causes  |
|    | (Unintended Anchor Misses) | live broadcast failure due to interface ambiguity or distraction.|
+----+----------------------------+------------------------------------------------------------------+
| K3 | Cognitive Workload Increase| Operators experience higher subjective cognitive workload        |
|    | (NASA-TLX Regression)      | (NASA-TLX) using LiveLift than using Google Sheets (TLX_A>TLX_B).|
+----+----------------------------+------------------------------------------------------------------+
| K4 | Routine Capture Chore      | Operators abandon live transition logging in >= 30% of trials,   |
|    | Rejection                  | citing screen overload and Seller Center multi-tasking conflict. |
+----+----------------------------+------------------------------------------------------------------+
| K5 | Disqualification Trigger   | Prototype activates any zero-tolerance trigger: Silent Anchor    |
|    | Activation                 | Shift, False Confirmed Action, Lost Command, or Crash.           |
+----+----------------------------+------------------------------------------------------------------+
| K6 | Zero Commercial Willingness| < 50% of operators choose LiveLift, or zero merchant teams agree |
|    | to Adopt                   | to deploy the tool in repeated live broadcasts.                  |
+----+----------------------------+------------------------------------------------------------------+
```

---

### 4.2 Termination & Project Archival Protocol
Upon triggering a KILL decision:
1. **Immediate Code Freeze:** Halt all development on `orca/v3-validation` and related branches.
2. **Post-Mortem Documentation:** Author `docs/validation/v3/POST_MORTEM_KILL_REPORT.md` within 5 business days, documenting exact telemetry distributions, root causes of operational friction, and spreadsheet superiority mechanics.
3. **Repository Archival:** Tag the repository state as `v3-val-kill-archive`, lock branches, and transition engineering resources to alternative company initiatives.
4. **Governance Record:** Record formal cancellation in the Master Roadmap Decision Log (`docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §29).

---

## 5. Objective Behavioral Evidence vs Subjective Opinion

To prevent cognitive dissonance, confirmation bias, or polite participant flattery from contaminating the decision, research evaluations must follow the **Triangulation Matrix**:

```
+----------------------------------------------------------------------------------------------------+
|                                    TRIANGULATION CONFLICT RESOLUTION                               |
+------------------------+------------------------+--------------------------------------------------+
| Behavioral Telemetry   | Subjective Interview   | Authoritative Strategic Interpretation           |
+------------------------+------------------------+--------------------------------------------------+
| **PASS**               | **POSITIVE**           | **UNAMBIGUOUS BUILD:**                           |
| Latency improved >=30%;| Operator enthusiastically| Behavioral advantage validated by user sentiment.|
| Zero critical misses;  | chooses LiveLift;      | Clear mandate for Phase 1 single-device build.   |
| Workload lower >=20%.  | confirms commercial fit|                                                  |
+------------------------+------------------------+--------------------------------------------------+
| **PASS**               | **NEGATIVE**           | **BUILD WITH TARGETED UX REFINEMENT:**           |
| Latency improved >=30%;| Operator expresses     | Behavioral efficiency is real, but UI friction,  |
| Zero critical misses;  | skepticism; prefers    | styling, or habits cause subjective resistance.  |
| Workload lower >=20%.  | familiar sheets.       | Conduct onboarding and visual design polish.     |
+------------------------+------------------------+--------------------------------------------------+
| **FAIL**               | **POSITIVE**           | **HARD REJECTION / RE-AUDIT (FALSE CHARM):**     |
| Latencies lag baseline;| Operator claims tool   | Participant is exhibiting courtesy bias or novelty|
| Missed anchors > 0;    | is "amazing" and "saves| attraction. System failed operational reality.   |
| Workload higher.       | time".                 | Subjective praise is DISCARDED. Verdict is FAIL. |
+------------------------+------------------------+--------------------------------------------------+
| **FAIL**               | **NEGATIVE**           | **UNAMBIGUOUS KILL / PIVOT:**                    |
| Latencies lag baseline;| Operator rejects tool; | Total alignment between operational breakdown    |
| Cognitive overload.    | states sheet is better.| and user rejection. Immediate project kill.      |
+------------------------+------------------------+--------------------------------------------------+
```

---

## 6. Formal Decision Governance & Sign-Off

The final strategic decision must be unanimously ratified by the leadership trio and independently attested by the forensic auditor:

```
====================================================================================================
LIVELIFT V3 PRODUCT DECISION RATIFICATION
====================================================================================================
FINAL DECISION:     [ ] BUILD (Advance to Phase 1 Single-Device Product)
                    [ ] PIVOT A (Desk-Only Pivot)
                    [ ] PIVOT B (Review-Only Companion Pivot)
                    [ ] PIVOT C (Commerce Template / Rundown Plugin Pivot)
                    [ ] KILL / DO NOT ADVANCE TO PHASE 1

EXECUTIVE SUMMARY OF EMPIRICAL BASIS:
____________________________________________________________________________________________________
____________________________________________________________________________________________________

GOVERNANCE SIGN-OFF:

Product Strategy Lead:        ___________________________   Date: [ YYYY-MM-DD: ____________ ]
Lead Validation Researcher:   ___________________________   Date: [ YYYY-MM-DD: ____________ ]
Engineering Architecture Lead:___________________________   Date: [ YYYY-MM-DD: ____________ ]
Independent Forensic Auditor: ___________________________   Date: [ YYYY-MM-DD: ____________ ]
====================================================================================================
```
