# LiveLift V3 Preregistered Quantitative Pass/Fail Thresholds & Governance Gates

**Document ID:** `VAL-V3-THRS-11`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 4 (Measurement, Thresholds & Decisions)  
**Classification:** Empirical Decision Criteria & Statistical Gate Specification  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §5, §16, §21; `docs/validation/v3/00_VALIDATION_PROTOCOL.md` §1, §7; `docs/validation/v3/08_MEASUREMENT_SHEET.md`

---

## 1. Executive Summary & Preregistration Philosophy

This specification establishes the authoritative, preregistered quantitative pass/fail thresholds, statistical decision rules, and hard disqualification triggers governing the LiveLift V3 Product Validation Program.

### 1.1 The Preregistration Principle
In behavioral and operational systems research, adjusting evaluation thresholds after observing experimental data (*p-hacking* or goalpost shifting) invalidates scientific and commercial claims. To ensure complete auditability:
1. **Pre-Experimental Freeze:** All numeric criteria, percentage improvements, and disqualification triggers in this document are frozen prior to participant testing.
2. **Deterministic Gate Mapping:** Every experimental outcome deterministically maps to one of three strategic decisions: **BUILD (Advance to Phase 1 Single-Device Build)**, **PIVOT (Scoped Operational Reframing)**, or **KILL / DO NOT ADVANCE TO PHASE 1**.
3. **No Retrospective Exceptions:** A failure on any primary threshold or hard disqualification trigger cannot be overridden by favorable subjective opinions or secondary metrics.

```
+----------------------------------------------------------------------------------------------------+
|                                    GOVERNANCE GATE ARCHITECTURE                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|                       [ EXPERIMENTAL TRIALS: N = 6 to 10 PARTICIPANT PAIRS ]                       |
|                                                  │                                                 |
|                       ┌──────────────────────────┴──────────────────────────┐                      |
|                       ▼                                                     ▼                      |
|          [ ZERO-TOLERANCE AUDIT ]                                [ QUANTITATIVE METRICS ]          |
|          4 Hard Disqualification Triggers                        10 Operational Dimensions         |
|          (Anchor Shift, False Action,                            (Wilcoxon Signed-Rank Test)       |
|           Command Loss, Crash)                                              │                      |
|                       │                                                     │                      |
|         ANY TRIGGER   │ ALL PASS                                            │                      |
|         ACTIVATED?    │                                                     │                      |
|           ┌───────────┴───────────┐                                         │                      |
|           ▼                       ▼                                         │                      |
|     [ HARD FAIL ]        [ EVALUATE THRESHOLDS ] <──────────────────────────┘                      |
|    Automatic Disqual.    - Primary Gates (Core Desk)                                               |
|    -> KILL / PIVOT       - Secondary Gates (Host & Prep)                                           |
|                                   │                                                                |
|                       ┌───────────┼───────────┐                                                    |
|                       ▼           ▼           ▼                                                    |
|                   [ BUILD ]   [ PIVOT ]   [ KILL ]                                                 |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Master Preregistered Threshold Matrix

The 10 preregistered criteria are systematically mapped across the six core operational dimensions:

```
+-----------------------------------------------------------------------------------------------------------------------------------+
|                                            PREREGISTERED THRESHOLD MASTER SCORECARD                                               |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| #  | Operational Dimension      | Tier     | Primary Metric         | Preregistered Threshold  | Mathematical Condition           |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 01 | Setup & Configuration      | Secondary| Setup Time (T_setup)   | <= 10.0m total;          | T_setup <= 10.0m AND             |
|    |                            |          |                        | <= 2.0m slower than Base | Delta_T_setup <= 2.0m            |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 02 | Schedule-Risk Awareness    | Primary  | Detection Latency      | >= 80% recognized        | Count(T_detect <= 10.0s) /       |
|    |                            |          | (T_detect)             | in <= 10.0 seconds       |   N_disturbances >= 0.80         |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 03 | Overrun Recovery Speed     | Primary  | Decision Latency       | Median >= 30.0% faster;  | Pct_Improve(T_decision) >= 30.0% |
|    | & Constraint Validity      |          | & Validity Rate        | >= 90.0% valid choices   | AND R_valid >= 90.0%             |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 04 | Hard Promotion Anchor      | Primary  | Anchor Variance &      | Zero critical misses;    | N_critical_misses == 0 AND       |
|    | Protection                 |          | Critical Miss Count    | Median Var <= 15.0s      | Median(V_anchor) <= 15.0s        |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 05 | Routine Capture Burden     | Primary  | Transitions & Latency  | <= 1 command/transition; | Commands <= 1.0 AND              |
|    |                            |          |                        | Median <= 3.0s; >=90%<15s| Med(T_cap)<=3.0s & E_PVA<=10.0%  |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 06 | Operator Cognitive Burden  | Primary  | Raw NASA-TLX           | Median score >= 20.0%    | Pct_Improve(NASA_TLX) >= 20.0%   |
|    |                            |          | Workload Scale         | lower than baseline      | (Statistically Sig: p < 0.05)    |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 07 | Host Coordination (P0.5)   | Gated    | Cues & Message Volume  | >= 30.0% fewer messages; | Pct_Reduction(N_msgs) >= 30.0%   |
|    | (Host View Sub-Study)      |          |                        | >= 80% understood <= 5.0s| AND Count(T_comp<=5s)/N >= 0.80  |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 08 | Post-Show PVA Review       | Primary  | Reconstruction Time &  | <= 5.0m total, >= 30%    | T_recon <= 5.0m & Pct_Imp >= 30% |
|    |                            |          | Fact Accuracy (A_facts)| faster; >= 90% facts ok  | AND A_facts >= 90.0%             |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 09 | Subjective Adoption Choice | Primary  | Forced-Choice Probe    | >= 70.0% of operators    | N_choose_LiveLift / N_operators  |
|    |                            |          |                        | voluntarily choose desk  |   >= 0.70                        |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
| 10 | Voluntary Repeat Use       | Field G1 | Repeated In-Vivo Runs  | >= 3 recurring teams     | Count(Teams >= 3 runs) >= 3      |
|    | (Phase 1 Acceptance Gate)  |          |                        | across >= 3 sessions     | (Voluntary production adoption)  |
+----+----------------------------+----------+------------------------+--------------------------+----------------------------------+
```

---

## 3. Detailed Dimension Specifications & Scoring Rubrics

### 3.1 Threshold 1: Setup Time ($T_{\text{setup}}$)
* **Operational Rationale:** If preparing a show in LiveLift is heavier or more cumbersome than duplicating a spreadsheet tab, solo operators and small agencies will abandon the tool before broadcast kickoff.
* **Numeric Boundary:**
  - Absolute Cap: $\text{Median}(T_{\text{setup}}) \le 10.0\text{ minutes}$.
  - Baseline Parity: $\text{Median}(T_{\text{setup, LiveLift}}) - \text{Median}(T_{\text{setup, Base}}) \le 2.0\text{ minutes}$.
* **Evaluation Method:** Clock time from blank/import opening to participant declaring readiness.
* **Scoring Rubric:**
  - `PASS`: Setup completed $\le 10.0$m and $\le 2.0$m slower than baseline.
  - `MARGINAL`: Setup takes $10.1\text{--}15.0$m, or $> 2.0$m slower; triggers UX onboarding refinement.
  - `FAIL`: Setup exceeds $15.0$m; heavier than traditional tools.

---

### 3.2 Threshold 2: Schedule-Risk Detection Latency ($T_{\text{detect}}$)
* **Operational Rationale:** Detecting an emerging schedule deficit early allows gentle, non-disruptive compression of upcoming buffers. Detecting it late causes catastrophic panic, emergency cutting of hero products, or missed promotions.
* **Numeric Boundary:**
  $$\frac{\sum_{i=1}^{N_{\text{trials}}} \mathbf{1}(T_{\text{detect}, i} \le 10.0\text{s})}{N_{\text{trials}}} \ge 80.0\%$$
* **Evaluation Method:** Dual-rater stopwatch from mathematical deficit instant to operator verbal or behavioral acknowledgment.
* **Scoring Rubric:**
  - `PASS`: At least $80.0\%$ of scored trials recognized within $\le 10.0$ seconds.
  - `MARGINAL`: $60.0\%\text{--}79.9\%$ recognized in $\le 10.0$s; indicates visual hierarchy ambiguity.
  - `FAIL`: $< 60.0\%$ recognized; baseline conditional formatting matches or outperforms LiveLift.

---

### 3.3 Threshold 3: Overrun Recovery Speed ($T_{\text{decision}}$) & Validity ($R_{\text{valid}}$)
* **Operational Rationale:** Once a deficit is recognized, calculating which downstream segments can yield time without violating manufacturer floors is mentally exhausting. The LiveLift recovery engine must materially accelerate decision velocity while guaranteeing mathematical feasibility.
* **Numeric Boundary:**
  $$\text{Percentage Improvement in Median } T_{\text{decision}} \ge 30.0\%$$
  $$R_{\text{valid}} \ge 90.0\%$$
* **Evaluation Method:** Paired Wilcoxon signed-rank test comparing $T_{\text{decision}}$ in seconds; constraint audit on all logged choices.
* **Scoring Rubric:**
  - `PASS`: Median recovery time $\ge 30.0\%$ faster than baseline AND $\ge 90.0\%$ of choices valid under constraints.
  - `MARGINAL`: Recovery is $10.0\%\text{--}29.9\%$ faster, or validity is $75.0\%\text{--}89.9\%$.
  - `FAIL`: Recovery is $< 10.0\%$ faster, or validity is $< 75.0\%$; LiveLift provides no operational arithmetic advantage.

---

### 3.4 Threshold 4: Critical Cue Misses & Anchor Variance ($V_{\text{anchor}}$)
* **Operational Rationale:** Live TikTok Shop commerce depends on scheduled promotions (Seller Center flash sales, platform co-funded vouchers). Missing an anchor destroys GMV and violates commercial agreements.
* **Numeric Boundary:**
  $$N_{\text{critical\_unintended\_misses}} = 0 \quad (\text{Zero Tolerance})$$
  $$\text{Median}(V_{\text{anchor}}) \le 15.0\text{ seconds}$$
* **Critical Miss Definition:** A hard anchor is classified as a Critical Miss if:
  1. Broadcast execution begins $> 30.0$ seconds after scheduled wall-clock instant.
  2. The anchor is omitted, skipped, or executed without the product card pinned in Seller Center.
  3. The anchor start time was shifted without explicit prior human authorization.
* **Scoring Rubric:**
  - `PASS`: Zero critical misses across all experimental trials AND median variance $\le 15.0$ seconds.
  - `FAIL`: Any critical missed anchor attributable to software confusion, or median variance $> 15.0$s.

---

### 3.5 Threshold 5: Routine Capture Burden ($N_{\text{commands}}$, $T_{\text{capture}}$, $E_{\text{PVA}}$)
* **Operational Rationale:** If logging segment progress requires complex navigation or multi-click workflows, operators will abandon tracking during chaotic live broadcasts, corrupting post-show analytics.
* **Numeric Boundary:**
  - Clicks per Transition: $\le 1.0$ command interaction per routine segment transition.
  - Median Capture Latency: $\text{Median}(T_{\text{capture}}) \le 3.0\text{ seconds}$.
  - Plan-vs-Actual Boundary Accuracy: $\ge 90.0\%$ of segment transitions recorded within $15.0$ seconds of ground-truth video timecode ($E_{\text{PVA}} \le 10.0\%$).
* **Scoring Rubric:**
  - `PASS`: $\le 1$ click, median $\le 3.0$s, and $E_{\text{PVA}} \le 10.0\%$.
  - `MARGINAL`: $1.1\text{--}2.0$ clicks, or latency $3.1\text{--}6.0$s; operator notes capture friction.
  - `FAIL`: $> 2$ clicks, latency $> 6.0$s, or $E_{\text{PVA}} > 10.0\%$; capture chore compromises operations.

---

### 3.6 Threshold 6: Operator Cognitive Workload (NASA-TLX)
* **Operational Rationale:** Live stream operators operate at near-total cognitive saturation. LiveLift must materially unload mental arithmetic and window-switching anxiety.
* **Numeric Boundary:**
  $$\frac{\text{Median}(\text{TLX}_{\text{Base}}) - \text{Median}(\text{TLX}_{\text{LiveLift}})}{\text{Median}(\text{TLX}_{\text{Base}})} \times 100\% \ge 20.0\%$$
* **Evaluation Method:** Raw NASA-TLX 6-dimensional scale (0–100) administered immediately post-trial; paired difference evaluated via Wilcoxon signed-rank test ($\alpha = 0.05$).
* **Scoring Rubric:**
  - `PASS`: Statistically significant reduction in median workload of $\ge 20.0\%$ ($p < 0.05$).
  - `MARGINAL`: Workload reduction of $5.0\%\text{--}19.9\%$, or non-significant trend ($p \ge 0.05$).
  - `FAIL`: Workload reduction $< 5.0\%$, or LiveLift workload is higher than baseline.

---

### 3.7 Threshold 7: Host Coordination & Comprehension (Host View Gated Sub-Study)
* **Operational Rationale:** Talent on camera must not be distracted by chat notifications or verbose instructions. The Host View must provide glanceable, atomic cues that reduce communication clutter without harming delivery.
* **Numeric Boundary:**
  $$\text{Message Reduction Rate} \ge 30.0\%$$
  $$\frac{\sum \mathbf{1}(T_{\text{comprehend}} \le 5.0\text{s})}{N_{\text{cues}}} \ge 80.0\%$$
  $$N_{\text{speech\_stumbles\_caused\_by\_cue}} = 0$$
* **Gated Architecture:** Host View (P0.5) is evaluated as an **independent, decoupled sub-study**. If Host View fails to achieve these thresholds, it is eliminated or pivoted to Desk-Only (Pivot A), without invalidating the core Operator Desk (P0).
* **Scoring Rubric:**
  - `PASS`: $\ge 30.0\%$ fewer messages, $\ge 80.0\%$ cues comprehended in $\le 5$s, and zero delivery degradation.
  - `FAIL (PIVOT A)`: Messages not reduced or host exhibits teleprompter glaze / speech stumbles; trigger immediate Desk-Only pivot.

---

### 3.8 Threshold 8: Post-Show PVA Review & Fact Accuracy
* **Operational Rationale:** Reconstructing what occurred during a live show is vital for merchant brand reporting and revenue settlement. LiveLift must eliminate painful manual video scrubbing.
* **Numeric Boundary:**
  $$\text{Total Review Duration } (T_{\text{recon}}) \le 5.0\text{ minutes}$$
  $$\text{Percentage Improvement in Median } T_{\text{recon}} \ge 30.0\%$$
  $$A_{\text{facts}} \ge 90.0\% \quad (\ge 9 \text{ out of 10 standardized probes correct})$$
* **Evaluation Method:** Timed review task followed by standardized 10-question factual audit.
* **Scoring Rubric:**
  - `PASS`: Review completed $\le 5.0$m, median $\ge 30.0\%$ faster than baseline, and $A_{\text{facts}} \ge 90.0\%$.
  - `MARGINAL`: Review takes $5.1\text{--}8.0$m, or accuracy is $75.0\%\text{--}89.9\%$.
  - `FAIL`: Review takes $> 8.0$m, or accuracy is $< 75.0\%$; review engine untrustworthy.

---

### 3.9 Threshold 9: Subjective Commercial Adoption Preference
* **Operational Rationale:** Behavioral efficiency must translate into genuine commercial preference. If operators outperform with LiveLift but still choose Google Sheets for their next real broadcast, product adoption will fail in the wild.
* **Numeric Boundary:**
  $$\frac{N_{\text{operators\_choosing\_LiveLift}}}{N_{\text{total\_operators}}} \ge 70.0\%$$
* **Evaluation Method:** Forced-choice post-test interview commitment probe: *"If you were directing tomorrow's real live sales broadcast, which tool would you voluntarily mandate for your studio, and why?"*
* **Scoring Rubric:**
  - `PASS`: $\ge 70.0\%$ of operators choose LiveLift.
  - `MARGINAL`: $50.0\%\text{--}69.9\%$ choose LiveLift; qualitative feedback required to diagnose resistance.
  - `FAIL`: $< 50.0\%$ choose LiveLift; operators prefer spreadsheet/chat.

---

### 3.10 Threshold 10: Voluntary Repeat Use (Phase 1 In-Vivo Acceptance Gate)
* **Operational Rationale:** Laboratory trials prove capability; field trials prove utility. Before authorizing commercial production (Phase 2), LiveLift must prove sticky in repeated live studio operations.
* **Numeric Boundary:**
  $$\text{Count}(\text{Merchant Teams Completing } \ge 3 \text{ Consecutive Sessions}) \ge 3\text{ teams}$$
* **Timing & Execution:** Evaluated at Gate G1 during Phase 1 functional field trials.
* **Scoring Rubric:**
  - `PASS`: At least 3 independent recurring merchant teams voluntarily use the Phase 1 single-device desk across $\ge 3$ consecutive production broadcasts.
  - `FAIL`: Teams abandon the desk after 1 session or refuse field deployment.

---

## 4. Hard Disqualification Triggers (Zero Tolerance)

Regardless of aggregate quantitative metric performance, the activation of any of the following four **Hard Disqualification Triggers** results in an **immediate experimental failure and disqualification** of the prototype build:

```
+----------------------------------------------------------------------------------------------------+
|                               HARD DISQUALIFICATION TRIGGERS (ZERO TOLERANCE)                      |
+----+----------------------------+------------------------------------------------------------------+
| #  | Trigger Name               | Operational Violation Definition                                 |
+----+----------------------------+------------------------------------------------------------------+
| T1 | Silent Anchor Shift        | The software automatically shifts, reschedules, or alters a      |
|    |                            | hard promotional anchor in time without explicit, active human    |
|    |                            | authorization. (Hiding deficits by sliding the anchor forward).  |
+----+----------------------------+------------------------------------------------------------------+
| T2 | False Confirmed Action     | The software indicates, confirms, or implies to the user that a  |
|    |                            | native TikTok Shop action (pinning, vouchers, price cuts) was     |
|    |                            | executed on the platform, when it was only locally reported.     |
+----+----------------------------+------------------------------------------------------------------+
| T3 | Lost Acknowledged Command  | An operator command (start segment, extend, note, transition)    |
|    |                            | acknowledged by the UI is dropped, rolled back, or lost from the |
|    |                            | local event stream, causing data corruption or desync.           |
+----+----------------------------+------------------------------------------------------------------+
| T4 | Prototype Crash / Lockup   | An unhandled software crash, blank screen, frozen cursor, or     |
|    |                            | memory leak that interrupts broadcast operations for > 15s.      |
+----+----------------------------+------------------------------------------------------------------+
```

### 4.1 Trigger T1: Silent Anchor Shift
* **Rationale:** In live commerce, changing the scheduled time of a flash sale without notifying the host or audience breaches platform rules and damages viewer trust. If an overrun occurs, the software must show an explicit **Deficit Alert**; it must **never** silently recalculate the anchor start time to make the rundown look green.
* **Violation Check:** Any code or UI behavior where `anchor.start_time` moves dynamically with upstream delays without a logged operator confirmation.

### 4.2 Trigger T2: False Confirmed Action
* **Rationale:** Third-party software cannot programmatically execute actions inside TikTok Shop Seller Center. A tool that marks an action as "Confirmed on TikTok" creates catastrophic false confidence.
* **Violation Check:** Any event or UI label claiming `confirmed_by_platform` rather than `operator_reported`.

### 4.3 Trigger T3: Lost Acknowledged Command
* **Rationale:** If an operator clicks "Next Segment" and turns their attention back to the broadcast, losing that transition event due to race conditions or unhandled state transitions invalidates all downstream metrics.
* **Violation Check:** Any discrepancy between the command receipt log and the persisted runtime state.

### 4.4 Trigger T4: Prototype Crash / Invalidation
* **Rationale:** Live broadcast operations do not pause for software reboots. A crash during a live show is an unforgivable failure.
* **Violation Check:** Any unrecoverable exception, white screen of death, or frozen thread requiring browser restart.

---

## 5. Statistical Power, Sample Size & Governance Gates

### 5.1 Sample Size & Statistical Power
* **Sample Size ($N$):** $N = 6 \text{ to } 10$ operator-host participant pairs (representing at least 3 distinct recurring merchant teams).
* **Statistical Framework:** Nonparametric paired analysis using the **Wilcoxon Signed-Rank Test** ($W$).
* **Significance Level:** $\alpha = 0.05$ (two-tailed).
* **Effect Size & Power:** For a paired sample of $N = 8$ pairs, the design achieves $\ge 80\%$ power to detect large operational effect sizes ($d \ge 1.1$, corresponding to $\ge 30\%$ median improvements in latencies and $\ge 20\%$ in NASA-TLX workload).
* **Confidence Reporting:** For all continuous metrics, report the Hodges-Lehmann median difference estimator and its distribution-free $95\%$ confidence interval.

### 5.2 Primary vs Secondary Gate Architecture

```
+----------------------------------------------------------------------------------------------------+
|                                    GATE GOVERNANCE ARCHITECTURE                                    |
+-------------------+----------------------------+---------------------------------------------------+
| Gate Level        | Scope & Timing             | Evaluation Criteria                               |
+-------------------+----------------------------+---------------------------------------------------+
| **Gate G0**       | Laboratory Phase 0 Trial   | Must pass Thresholds 01 through 09 AND zero       |
| (Validation Gate) | (Fixture UI + WoZ Engine)  | triggers T1–T4.                                   |
|                   |                            | Authorizes Phase 1 Single-Device Engineering.     |
+-------------------+----------------------------+---------------------------------------------------+
| **Gate G1**       | In-Vivo Phase 1 Pilot      | Must pass Gate G0 metrics in live studio setting  |
| (Functional Gate) | (Local SQLite/IndexedDB)   | AND pass Threshold 10 (>=3 teams, >=3 shows).     |
|                   |                            | Authorizes Phase 2 Multi-Tenant / Server Pilot.   |
+-------------------+----------------------------+---------------------------------------------------+
```

---

## 6. Subgroup Analysis & Edge Cohort Rules

To ensure findings are robust and not an artifact of novice participants, subgroup analyses must be independently calculated and disclosed for the following mandatory cohorts:

1. **Spreadsheet Power-User Subgroup ($n \ge 1$):**
   - *Requirement:* Must include at least 1 advanced operator with mastery of Google Sheets formulas and macros.
   - *Rule:* If the power-user achieves superior recovery and review speeds with Google Sheets compared to LiveLift, the finding must be analyzed: Does LiveLift only benefit novices, or does it provide genuine structural advantage?
2. **Skeptical Operator Subgroup ($n \ge 1$):**
   - *Requirement:* Must include at least 1 operator who explicitly prefers paper rundowns or minimal tooling.
   - *Rule:* Used to evaluate whether the capture burden (Threshold 5) induces operational resistance.
3. **Professional Rundown Challengers ($n \ge 2$):**
   - *Requirement:* At least 2 operators must evaluate LiveLift against a configured professional broadcast tool (Ontime / Shoflo / Rundown Studio).
   - *Rule:* Benchmarks LiveLift's live commerce domain specialization against generic broadcast software.
4. **Simple-Show Counterexample ($n = 1$ team):**
   - *Requirement:* 1 merchant team running unstructured, 2-SKU conversational live streams.
   - *Rule:* Validates the lower boundary of product utility, proving where LiveLift is unnecessary.
