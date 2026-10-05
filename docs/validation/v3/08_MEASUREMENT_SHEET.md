# LiveLift V3 Quantitative Measurement Instrument & Data Dictionary

**Document ID:** `VAL-V3-MEAS-08`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 4 (Measurement, Thresholds & Decisions)  
**Classification:** Empirical Data Collection Instrument & Mathematical Dictionary  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §5, §16, §21; `docs/validation/v3/00_VALIDATION_PROTOCOL.md` §3, §7; `docs/validation/v3/04_TEST_SCENARIO.md`; `docs/validation/v3/07_DISTURBANCE_TIMELINE.md`; `docs/validation/v3/09_OBSERVER_CHECKLIST.md`

---

## 1. Executive Summary & Data Governance

This specification establishes the authoritative mathematical formulas, operational variable definitions, data schemas, and standardized raw logging instruments for the LiveLift V3 Product Validation Program.

### 1.1 Integrity & Research Stance
In strict compliance with the **Integrity Mandate**, all measurements must represent genuine, audited behavioral observations. Fabricated telemetry, post-hoc smoothing, omitted outliers, or biased data transformations are strictly prohibited. 

Every trial in the dual-arm within-subjects trial is recorded across two synchronized video tracks (Observer 1 Technical/Timing and Observer 2 Human Factors). All timing points must be reconcilable to millisecond timecodes (`HH:MM:SS.mmm`) derived from the master Network Time Protocol (NTP) time server.

```
+----------------------------------------------------------------------------------------------------+
|                                MEASUREMENT ARCHITECTURE DATA PIPELINE                               |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|    [ EXPERIMENTAL RUN ] ---> [ DUAL-RATER OBSERVER LOGS ] ---> [ NTP-ALIGNED AUDIT ]               |
|      Condition A & B           Obs 1: Millisecond actions        Inter-Rater Reliability           |
|      15-minute trials          Obs 2: Communication/Gaze         ICC(2,1) >= 0.90                  |
|                                                                        │                           |
|                                                                        ▼                           |
|    [ PASS/FAIL GATES ] <--- [ PAIRED DIFFERENCE CALC ] <--- [ DERIVED METRICS SHEET ]              |
|      11_THRESHOLDS.md          Wilcoxon Signed-Rank Test         08_MEASUREMENT_SHEET.md           |
|      13_DECISION.md            Hodges-Lehmann Estimator          T_detect, T_decision, V_anchor    |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Mathematical Data Dictionary & Metric Formulas

The validation program operationalizes the six core operational dimensions into eight primary quantitative metrics.

```
+----------------------------------------------------------------------------------------------------+
|                                    SUMMARY METRIC FORMULA MATRIX                                    |
+----+----------------------------+-----------------------+------------------------------------------+
| ID | Metric Name                | Unit / Scale          | Authoritative Mathematical Formula       |
+----+----------------------------+-----------------------+------------------------------------------+
| M1 | Setup Time (T_setup)       | Minutes (float)       | t_ready - t_session_init                 |
| M2 | Detection Latency          | Seconds (float)       | t_detect - t_stimulus                    |
| M3 | Decision Latency           | Seconds (float)       | t_action - t_detect                      |
| M4 | Recovery Validity Rate     | Percentage (%)        | (N_valid_decisions / N_total) * 100      |
| M5 | Anchor Variance (V_anchor) | Seconds (float)       | |t_actual_anchor - t_target_anchor|      |
| M6 | Plan-vs-Actual Error Rate  | Percentage (%)        | (N_err_boundaries / N_total) * 100       |
| M7 | Routine Capture Burden     | Clicks & Seconds      | Clicks per transition; t_log - t_cut     |
| M8 | Host Coordination Disrup   | Count, Sec, Ratio     | N_msgs, T_comprehend, Stumble/Glance     |
| M9 | Cognitive Workload (TLX)   | Scale (0 - 100)       | Sum(Subscales) / 6 (Raw NASA-TLX)        |
| M10| Reconstruction & Review    | Minutes & Accuracy %  | T_recon; (N_correct / 10) * 100          |
| M11| Next LIVE Adaptation       | Minutes & Feasibility | T_plan; Binary Constraint Check          |
+----+----------------------------+-----------------------+------------------------------------------+
```

---

### 2.1 Metric 1: Setup Time ($T_{\text{setup}}$)
* **Definition:** Total elapsed wall-clock duration in minutes required for the operator to initialize the show environment, verify catalog SKUs, configure hard anchors, and declare readiness for live broadcast.
* **Mathematical Formula:**
  $$T_{\text{setup}} = \frac{t_{\text{ready}} - t_{\text{session\_init}}}{60}$$
  * $t_{\text{session\_init}}$: Timestamp when the operator opens the blank/imported rundown template.
  * $t_{\text{ready}}$: Timestamp when the operator signals complete readiness to the proctor.
* **Unit of Measure:** Minutes (decimal format, rounded to 2 decimal places).
* **Target:** $T_{\text{setup}} \le 10.0\text{ min}$, and $\Delta T_{\text{setup}} \le 2.0\text{ min}$ compared to baseline median.

---

### 2.2 Metric 2: Schedule-Risk Detection Latency ($T_{\text{detect}}$)
* **Definition:** Elapsed duration in seconds from the exact mathematical injection of an operational disturbance or schedule deficit to the operator's first observable cognitive recognition.
* **Mathematical Formula:**
  $$T_{\text{detect}} = t_{\text{detect}} - t_{\text{stimulus}}$$
  * $t_{\text{stimulus}}$: Authoritative ground-truth timestamp when the disturbance condition occurs:
    - *Disturbance D1 (Overrun Deficit):* The exact second when active elapsed time plus remaining floating durations causes the projected cursor to exceed the hard anchor commitment ($T_{\text{projected}} > T_{\text{anchor}}$). In Scenario 1, this occurs at $T = 06:30$ ($T_{\text{start}}(S2) + 4\text{m}30\text{s}$). In Scenario 2, this occurs at $T = 07:45$ ($T_{\text{start}}(S3) + 4\text{m}00\text{s}$).
    - *Disturbance D3 (Stockout):* The exact second the mock Seller Center console displays `Tồn kho = 0`.
    - *Disturbance D4 (Console Lag):* The exact second the operator initiates product pin and encounters the 40s spinner.
    - *Disturbance D5 (Under-run):* The exact second the host speaks the unscripted pacing wrap phrase.
  * $t_{\text{detect}}$: Authoritative timestamp of first observable operator recognition:
    - *Physical Marker:* Eye gaze shifts directly to the deficit alert / red cell; hand reaches for mouse.
    - *Verbal Marker:* Spoken acknowledgment (*"Lệch giờ rồi"*, *"Trễ Flash Sale"*, *"Hết hàng"*).
    - *Software Marker:* Interacting with the recovery drawer, highlighting a cell, or beginning to type an operational alert.
* **Unit of Measure:** Seconds (decimal format, rounded to 1 decimal place).
* **Target:** $\ge 80\%$ of scored trials recognized within $T_{\text{detect}} \le 10.0\text{ seconds}$.

---

### 2.3 Metric 3: Recovery Decision Latency ($T_{\text{decision}}$) & Validity ($R_{\text{valid}}$)
* **Definition:** 
  1. *Latency ($T_{\text{decision}}$):* Elapsed duration in seconds from initial risk detection ($t_{\text{detect}}$) to the execution or dispatch of a recovery action ($t_{\text{action}}$).
  2. *Validity ($R_{\text{valid}}$):* Percentage of recovery decisions that satisfy all declared product constraints (contractual floor durations, hard anchor inviolability, and non-negative buffers).
* **Mathematical Formulas:**
  $$T_{\text{decision}} = t_{\text{action}} - t_{\text{detect}}$$
  $$R_{\text{valid}} = \left( \frac{\sum_{i=1}^{N_{\text{decisions}}} \mathbf{1}_{\text{valid}}(i)}{N_{\text{decisions}}} \right) \times 100\%$$
  where indicator function $\mathbf{1}_{\text{valid}}(i) = 1$ if and only if all the following hold:
  1. $\text{Duration}(S_k) \ge \text{Floor\_Duration}(S_k)$ for all affected segments $S_k$.
  2. $\text{Projected\_Start}(\text{Anchor}_j) \le \text{Committed\_Time}(\text{Anchor}_j)$ (Hard anchor is protected).
  3. No downstream segment occurring *after* an anchor is shortened to solve a deficit occurring *before* that anchor.
* **Unit of Measure:** Latency in seconds; Validity in percentage ($0.0\%\text{--}100.0\%$).
* **Target:** Median $T_{\text{decision}}$ at least $30\%$ faster than baseline median; $R_{\text{valid}} \ge 90.0\%$.

---

### 2.4 Metric 4: Anchor Adherence & Anchor Variance ($V_{\text{anchor}}$)
* **Definition:** Absolute deviation in seconds between the actual broadcast execution time of a hard promotional anchor and its immutable pre-scheduled wall-clock commitment.
* **Mathematical Formula:**
  $$V_{\text{anchor}} = |t_{\text{actual\_anchor}} - t_{\text{committed\_anchor}}|$$
  * $t_{\text{actual\_anchor}}$: Authoritative timestamp when the host officially announces and unlocks the promotion on camera AND the product card is pinned in Seller Center.
  * $t_{\text{committed\_anchor}}$: Pre-scheduled wall-clock commitment ($09:00:00$ and $14:00:00$ in Scenario 1; $10:30:00$ and $14:00:00$ in Scenario 2).
* **Binary Adherence Classification:**
  $$\text{Status}_{\text{anchor}} = \begin{cases} 
  \text{PASS (Synchronized)}, & \text{if } V_{\text{anchor}} \le 15.0\text{ seconds} \\
  \text{MARGINAL (Delayed)}, & \text{if } 15.0\text{s} < V_{\text{anchor}} \le 30.0\text{ seconds} \\
  \text{CRITICAL MISS (Failed)}, & \text{if } V_{\text{anchor}} > 30.0\text{ seconds or omitted entirely}
  \end{cases}$$
* **Target:** Exactly **0 critical unintended anchor misses** across all trials; median $V_{\text{anchor}} \le 15.0\text{ seconds}$.

---

### 2.5 Metric 5: Plan-vs-Actual Boundary Error Rate ($E_{\text{PVA}}$)
* **Definition:** The proportion of segment start and end transitions where the operator's recorded runtime timestamp deviates by more than $15.0$ seconds from audited ground-truth video timecode, or where transitions are skipped or erroneously marked.
* **Mathematical Formula:**
  $$E_{\text{PVA}} = \left( \frac{N_{\text{erroneous\_boundaries}}}{N_{\text{total\_boundaries}}} \right) \times 100\%$$
  where a boundary $b$ is classified as erroneous if:
  $$\mathbf{1}_{\text{err}}(b) = \begin{cases} 
  1, & \text{if } |t_{\text{logged}}(b) - t_{\text{ground\_truth}}(b)| > 15.0\text{ seconds} \\
  1, & \text{if } b \text{ was omitted / unrecorded} \\
  1, & \text{if } b \text{ was falsely recorded (ghost transition)} \\
  0, & \text{otherwise}
  \end{cases}$$
  For a 6-segment rundown with 12 discrete transition boundaries (Start and End per segment):
  $$N_{\text{total\_boundaries}} = 12$$
* **Target:** $E_{\text{PVA}} \le 10.0\%$ (no more than 1 erroneous boundary per 15-minute trial).

---

### 2.6 Metric 6: Routine Capture Burden ($N_{\text{commands}}$ & $T_{\text{capture}}$)
* **Definition:** The operational effort required to record a standard, non-disturbed segment transition during the live broadcast.
* **Components:**
  1. *Interaction Command Count ($N_{\text{commands}}$):* Total discrete physical inputs (mouse clicks or keystrokes) required to complete a single segment transition.
  2. *Capture Latency ($T_{\text{capture}}$):* Elapsed time in seconds from the moment the host completes a segment pitch on camera ($t_{\text{pitch\_end}}$) to the moment the transition is saved in the tool ($t_{\text{log\_saved}}$).
* **Mathematical Formula:**
  $$T_{\text{capture}} = t_{\text{log\_saved}} - t_{\text{pitch\_end}}$$
* **Target:** $\le 1$ command per transition; median $T_{\text{capture}} \le 3.0\text{ seconds}$; $\ge 90\%$ of boundaries recorded within $15\text{ seconds}$.

---

### 2.7 Metric 7: Host Coordination Disruption & Comprehension
* **Definition:** Evaluates the cognitive and communicative friction between the behind-the-scenes operator and the on-camera talent across message volume, comprehension latency, and delivery fluency.
* **Component Formulas:**
  1. **Total Coordination Message Volume ($N_{\text{msgs}}$):**
     $$N_{\text{msgs}} = N_{\text{timing\_cues}} + N_{\text{chat\_messages}} + N_{\text{whiteboard\_cues}}$$
  2. **Avoidable Timing Message Ratio ($R_{\text{avoidable}}$):**
     $$R_{\text{avoidable}} = \left( \frac{N_{\text{timing\_clarifications}}}{N_{\text{msgs}}} \right) \times 100\%$$
     *(Clarification queries: "Còn mấy phút?", "Ủa qua mã chưa?", "Cắt hay giữ?", "Nhanh lên")*
  3. **Host Comprehension Latency ($T_{\text{comprehend}}$):**
     $$T_{\text{comprehend}} = t_{\text{host\_pivot}} - t_{\text{cue\_dispatched}}$$
     * $t_{\text{cue\_dispatched}}$: Millisecond timestamp when the cue appears on the Host View tablet or is sent via Zalo.
     * $t_{\text{host\_pivot}}$: Millisecond timestamp when the host visibly absorbs the cue and adapts verbal delivery on camera.
  4. **Behavioral Speech Stumble Rate ($N_{\text{stumble}}$):** Count of verbal stutters, mid-sentence halts ($>2$s), or accidental repetition of operator instructions occurring within 5 seconds of cue reception.
  5. **Teleprompter Glaze Incidents ($N_{\text{glaze}}$):** Count of occurrences where host eye gaze fixes onto the cue tablet for $>4.0$ continuous seconds, freezing audience connection.
* **Target:** $\ge 30.0\%$ reduction in total coordination message volume; $\ge 80.0\%$ of cues comprehended within $T_{\text{comprehend}} \le 5.0\text{ seconds}$; zero speech stumbles or delivery degradation caused by cues.

---

### 2.8 Metric 8: NASA-TLX Subjective Cognitive Workload
* **Definition:** Standardized measurement of operator multi-tasking strain administered immediately post-trial across the 6 validated dimensions of the NASA Task Load Index.
* **Subscales & Range:** Each subscale is evaluated on a continuous interval scale from 0 to 100 (in 5-point increments, $0 = \text{Very Low / Perfect}, 100 = \text{Very High / Failure}$):
  1. **Mental Demand (MD):** How much mental and perceptual activity was required (thinking, calculating, remembering)?
  2. **Physical Demand (PD):** How much physical activity was required (typing, clicking, rapid window juggling)?
  3. **Temporal Demand (TD):** How much time pressure did you feel due to the pace of the show?
  4. **Performance Satisfaction (OP):** How successful were you in executing the rundown and protecting anchors? (Inverted: $0 = \text{Perfect}, 100 = \text{Failure}$).
  5. **Effort (EF):** How hard did you have to work to maintain your level of performance?
  6. **Frustration Level (FR):** How irritated, stressed, or annoyed did you feel during the broadcast?
* **Mathematical Formula (Raw NASA-TLX Score):**
  $$\text{NASA-TLX}_{\text{Raw}} = \frac{\text{MD} + \text{PD} + \text{TD} + \text{OP} + \text{EF} + \text{FR}}{6}$$
* **Target:** Median $\text{NASA-TLX}_{\text{Raw}}$ score in LiveLift is at least **$20.0\%$ lower** than Baseline median.

---

### 2.9 Metric 9: Post-Show Review & Plan Reconstruction ($T_{\text{recon}}$ & $A_{\text{facts}}$)
* **Definition:** 
  1. *Reconstruction Duration ($T_{\text{recon}}$):* Clock time in minutes from show conclusion to operator producing a reconciled actual report.
  2. *Fact Accuracy Rate ($A_{\text{facts}}$):* Accuracy on a 10-item standardized factual quiz evaluating actual show occurrences without video review.
* **Mathematical Formulas:**
  $$T_{\text{recon}} = \frac{t_{\text{review\_complete}} - t_{\text{show\_end}}}{60}$$
  $$A_{\text{facts}} = \left( \frac{\sum_{k=1}^{10} \mathbf{1}_{\text{correct}}(k)}{10} \right) \times 100\%$$
* **Standardized 10-Item Post-Show Fact Battery:**
  1. Which product experienced the largest timing overrun?
  2. What was the exact duration overrun (within $\pm 30$s) of that product?
  3. Was Segment 3 (Toner / Earbuds) compressed, and by approximately how much?
  4. Did Hard Anchor 1 start on time, early, or late (within $\pm 15$s)?
  5. How much buffer was remaining immediately prior to Hard Anchor 1?
  6. At what timecode did the stockout occur?
  7. Which product was pulled forward or substituted to handle the stockout?
  8. How long was the platform pinning delay on Segment 5 / Segment 4?
  9. Did the final closing outro start within 15 seconds of the scheduled commitment?
  10. What was the total broadcast variance at show end (within $\pm 30$s)?
* **Target:** $T_{\text{recon}} \le 5.0\text{ minutes}$ (and median $\ge 30\%$ faster than baseline); $A_{\text{facts}} \ge 90.0\%$.

---

### 2.10 Metric 10: Feasible Next LIVE Adaptation ($T_{\text{plan}}$ & $\text{Feas}$)
* **Definition:** 
  1. *Planning Duration ($T_{\text{plan}}$):* Elapsed wall-clock time in minutes required to produce a modified rundown for the next broadcast incorporating operational learnings (+2m Hero, -1m Intro).
  2. *Feasibility Score ($\text{Feas}$):* Binary audit confirming whether the patched plan respects all minimum floor constraints and downstream hard anchors.
* **Mathematical Formula:**
  $$T_{\text{plan}} = \frac{t_{\text{plan\_complete}} - t_{\text{plan\_start}}}{60}$$
  $$\text{Feas} = \begin{cases}
  1 \text{ (PASS)}, & \text{if } \forall S_i: \text{Planned}(S_i) \ge \text{Floor}(S_i) \text{ and } \forall A_j: \text{Projected}(A_j) \le \text{Anchor}(A_j) \\
  0 \text{ (FAIL)}, & \text{otherwise}
  \end{cases}$$
* **Target:** $T_{\text{plan}}$ median $\ge 30\%$ faster than baseline; $\text{Feas} = 1$ in $\ge 90\%$ of trials.

---

## 3. Paired Difference Calculations & Directional Conventions

Because the validation protocol uses a **within-subjects paired design**, the fundamental unit of analysis is the within-participant paired difference:

$$\Delta_i = \text{Score}_{\text{LiveLift}, i} - \text{Score}_{\text{Baseline}, i}$$

### 3.1 Directional Sign Conventions
Depending on the metric's operational nature, a "better" score has different mathematical signs:

```
+----------------------------------------------------------------------------------------------------+
|                                    METRIC DIRECTIONALITY MATRIX                                     |
+--------------------------+---------------------+-------------------+-------------------------------+
| Metric Category          | Desired Direction   | Superiority Sign  | Percentage Improvement Formula|
+--------------------------+---------------------+-------------------+-------------------------------+
| Latencies (T_detect,     | Lower is better     | Delta < 0         | ((Baseline - LiveLift) /      |
| T_decision, T_capture)   | (Reduction)         | (Negative)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
| Variances & Errors       | Lower is better     | Delta < 0         | ((Baseline - LiveLift) /      |
| (V_anchor, E_PVA)        | (Reduction)         | (Negative)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
| Cognitive Load           | Lower is better     | Delta < 0         | ((Baseline - LiveLift) /      |
| (NASA-TLX)               | (Reduction)         | (Negative)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
| Accuracy & Validity      | Higher is better    | Delta > 0         | ((LiveLift - Baseline) /      |
| (R_valid, A_facts)       | (Increase)          | (Positive)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
| Time (T_recon, T_plan)   | Lower is better     | Delta < 0         | ((Baseline - LiveLift) /      |
|                          | (Reduction)         | (Negative)        |   Baseline) * 100%            |
+--------------------------+---------------------+-------------------+-------------------------------+
```

---

## 4. Master Data Schema & Storage Architecture

All captured observations must conform to the following tabular schema. Variables are strictly typed and bounded.

```
+----------------------------------------------------------------------------------------------------+
|                                   DATA SCHEMA FIELD SPECIFICATIONS                                 |
+--------------------+------------+---------------+----------------------+---------------------------+
| Field Name         | Data Type  | Nullable      | Valid Range          | Description               |
+--------------------+------------+---------------+----------------------+---------------------------+
| trial_id           | String     | No            | `TR-[0-9]{3}`        | Unique trial code         |
| participant_id     | String     | No            | `P[0-9]{2}-OP`       | Operator participant ID   |
| host_id            | String     | No            | `P[0-9]{2}-HOST`     | Host participant ID       |
| condition          | Enum       | No            | `LIVELIFT`, `BASE`   | Experimental arm          |
| order_sequence     | Enum       | No            | `A_B`, `B_A`         | Counterbalanced order     |
| scenario_id        | Enum       | No            | `SCEN-01`, `SCEN-02` | Test scenario catalog     |
| trial_date         | Date       | No            | `YYYY-MM-DD`         | Date of execution         |
| obs1_rater_id      | String     | No            | `RATER-[0-9]{2}`     | Observer 1 identifier     |
| obs2_rater_id      | String     | No            | `RATER-[0-9]{2}`     | Observer 2 identifier     |
| t_setup_min        | Float      | No            | `0.00 .. 30.00`      | Setup duration (minutes)  |
| d1_t_stimulus      | Timestamp  | No            | `HH:MM:SS.mmm`       | D1 injection timecode     |
| d1_t_detect        | Timestamp  | No            | `HH:MM:SS.mmm`       | D1 detection timecode     |
| d1_t_action        | Timestamp  | No            | `HH:MM:SS.mmm`       | D1 action timecode        |
| d1_t_detect_lat_s  | Float      | No            | `0.0 .. 120.0`       | D1 detection latency (s)  |
| d1_t_dec_lat_s     | Float      | No            | `0.0 .. 120.0`       | D1 decision latency (s)   |
| d1_decision_valid  | Boolean    | No            | `TRUE`, `FALSE`      | D1 constraint compliance  |
| d2_v_anchor1_s     | Float      | No            | `0.0 .. 300.0`       | Anchor 1 variance (s)     |
| d2_anchor1_status  | Enum       | No            | `PASS`, `MARG`, `FAIL`| Anchor 1 categorical grade|
| d3_t_detect_lat_s  | Float      | No            | `0.0 .. 120.0`       | D3 stockout detect lat (s)|
| d3_t_dec_lat_s     | Float      | No            | `0.0 .. 120.0`       | D3 stockout recovery lat  |
| d4_hold_action     | Boolean    | No            | `TRUE`, `FALSE`      | D4 holding cue dispatched |
| d5_hold_close      | Boolean    | No            | `TRUE`, `FALSE`      | D5 anchor 2 protected     |
| v_anchor2_s        | Float      | No            | `0.0 .. 300.0`       | Anchor 2 variance (s)     |
| err_boundary_count | Integer    | No            | `0 .. 12`             | Erroneous transitions     |
| pva_error_rate_pct | Float      | No            | `0.0 .. 100.0`       | PVA boundary error rate % |
| capture_clicks_avg | Float      | No            | `0.0 .. 10.0`        | Mean clicks per boundary  |
| capture_lat_med_s  | Float      | No            | `0.0 .. 30.0`        | Median capture latency (s)|
| total_coord_msgs   | Integer    | No            | `0 .. 100`            | Total cues & messages sent|
| avoidable_msg_pct  | Float      | No            | `0.0 .. 100.0`       | Avoidable message ratio % |
| host_comp_lat_med_s| Float      | No            | `0.0 .. 30.0`        | Host comprehension latency|
| host_stumbles_count| Integer    | No            | `0 .. 20`             | Host speech stumbles      |
| host_glaze_count   | Integer    | No            | `0 .. 20`             | Teleprompter glaze events |
| tlx_mental_demand  | Integer    | No            | `0 .. 100`            | NASA-TLX Mental Demand    |
| tlx_phys_demand    | Integer    | No            | `0 .. 100`            | NASA-TLX Physical Demand  |
| tlx_temp_demand    | Integer    | No            | `0 .. 100`            | NASA-TLX Temporal Demand  |
| tlx_performance    | Integer    | No            | `0 .. 100`            | NASA-TLX Performance     |
| tlx_effort         | Integer    | No            | `0 .. 100`            | NASA-TLX Effort           |
| tlx_frustration    | Integer    | No            | `0 .. 100`            | NASA-TLX Frustration      |
| tlx_raw_total      | Float      | No            | `0.00 .. 100.00`      | Mean NASA-TLX raw score   |
| t_recon_min        | Float      | No            | `0.00 .. 30.00`      | Review reconstruction time|
| fact_accuracy_pct  | Float      | No            | `0.0 .. 100.0`       | Post-show fact accuracy % |
| t_plan_min         | Float      | No            | `0.00 .. 30.00`      | Next LIVE planning time   |
| next_plan_feasible | Boolean    | No            | `TRUE`, `FALSE`      | Next LIVE valid plan audit|
+--------------------+------------+---------------+----------------------+---------------------------+
```

---

## 5. Blank Session Logging Instruments

The following sheets provide standardized logging templates to be printed or imported into research tablets for each experimental trial.

---

### Sheet 5.1: Master Trial Header Block

```
====================================================================================================
LIVELIFT V3 VALIDATION PROGRAM — SESSION LOGGING HEADER
====================================================================================================
TRIAL ID:           [ TR-_________ ]            DATE:             [ YYYY-MM-DD: ______________ ]
OPERATOR ID:        [ P____-OP     ]            SCHEDULED START:  [ HH:MM:SS:   ______________ ]
HOST ID:            [ P____-HOST   ]            ACTUAL START:     [ HH:MM:SS:   ______________ ]
CONDITION:          [ ] LIVELIFT DESK (A)       [ ] GOOGLE SHEETS BASELINE (B)
ORDER SEQUENCE:     [ ] A -> B (Cohort 1)       [ ] B -> A (Cohort 2)
SCENARIO / CATALOG: [ ] SCEN-01 (Cosmetics)     [ ] SCEN-02 (Fashion/Tech)
OBSERVER 1 (TIMING):[ RATER-______ ]            OBSERVER 2 (HUMAN):[ RATER-______ ]
====================================================================================================
```

---

### Sheet 5.2: Second-by-Second Disturbance Event Logging Table

```
+----+-------------+--------------+--------------+--------------+-------------+-------------+------------+
| ID | Event Name  | Stimulus (t) | Detect (t)   | Action (t)   | T_detect(s) | T_action(s) | Valid?     |
+----+-------------+--------------+--------------+--------------+-------------+-------------+------------+
| D1 | Overrun     | __:__:__.__  | __:__:__.__  | __:__:__.__  | ____._ s    | ____._ s    | [ ]Y  [ ]N |
|    | Deficit     | Target: 06:30| Gaze/Alert   | Cue Dispatch | (Max 10.0s) |             | Violations?|
+----+-------------+--------------+--------------+--------------+-------------+-------------+------------+
| D2 | Hard Anchor | Committed    | Actual Start | Deviat (sec) | Status      | Pinned in   | Host Ready?|
|    | 1 Sync      | 09:00:00.000 | __:__:__.__  | ____._ s     | [ ]PASS<=15 | Seller Ctr? | [ ] Yes    |
|    |             |              |              |              | [ ]FAIL>15  | [ ] Yes     | [ ] Stumble|
+----+-------------+--------------+--------------+--------------+-------------+-------------+------------+
| D3 | Mid-Pitch   | Stock = 0    | Gaze/Alert   | Cue Dispatch | T_detect(s) | T_action(s) | SKU Pulled:|
|    | Stockout    | __:__:__.__  | __:__:__.__  | __:__:__.__  | ____._ s    | ____._ s    | [ ] S5 Nắng|
|    |             |              |              |              | (Max 10.0s) |             | [ ] Buffer |
+----+-------------+--------------+--------------+--------------+-------------+-------------+------------+
| D4 | Console Lag | Spinner On   | Gaze/Alert   | Cue Dispatch | T_detect(s) | Hold Cue?   | Dead Air?  |
|    | (40s Freeze)| __:__:__.__  | __:__:__.__  | __:__:__.__  | ____._ s    | [ ] Yes     | [ ] None   |
|    |             |              |              |              |             | [ ] No      | [ ] >5s    |
+----+-------------+--------------+--------------+--------------+-------------+-------------+------------+
| D5 | Under-run   | Verbal Stall | Gaze/Alert   | Cue Dispatch | T_detect(s) | Held 14:00? | Early Pull?|
|    | Script Void | __:__:__.__  | __:__:__.__  | __:__:__.__  | ____._ s    | [ ] Yes     | [ ] Yes    |
|    |             |              |              |              |             | [ ] No      | [ ] NO (OK)|
+----+-------------+--------------+--------------+--------------+-------------+-------------+------------+
| -- | Closing     | Committed    | Actual Start | Deviat (sec) | Status      | Total Run   | Final Diff |
|    | Anchor 2    | 14:00:00.000 | __:__:__.__  | ____._ s     | [ ]PASS<=15 | __:__:__.__ | ____._ s   |
|    |             |              |              |              | [ ]FAIL>15  | (15m +/-15s)|            |
+----+-------------+--------------+--------------+--------------+-------------+-------------+------------+
```

---

### Sheet 5.3: Boundary Logging & Plan-vs-Actual Audit Table

```
+---+----------------------+---------------+---------------+---------------+---------------+--------+
|Seq| Segment Name         | Ground Start  | Ground End    | Logged Start  | Logged End    | Error? |
+---+----------------------+---------------+---------------+---------------+---------------+--------+
| 1 | S1: Intro & Vouchers | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
| 2 | S2: Hero 1 Serum     | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
| 3 | S3: Toner Buffer     | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
| 4 | S4: Flash Deal Kem   | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
| 5 | S5: Kem Nắng Upsell  | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
| 6 | S6: Kết Show Outro   | __:__:__.__   | __:__:__.__   | __:__:__.__   | __:__:__.__   | [ ] >15|
+---+----------------------+---------------+---------------+---------------+---------------+--------+
TOTAL ERRONEOUS BOUNDARIES (Count where |Logged - Ground| > 15s or Omitted): [ _____ / 12 ]
BOUNDARY ERROR RATE (E_PVA = Count / 12 * 100%):                            [ ____._ %  ]
```

---

### Sheet 5.4: Host Coordination, Gaze & Communication Log

```
+----------------------------------------------------------------------------------------------------+
| COORDINATION CUE & COMMUNICATION LOG (OBSERVER 2)                                                  |
+----------------------------------------------------------------------------------------------------+
| Total Coordination Cues Dispatched:                                        [ _____ cues ]          |
| Avoidable Clarification Cues ("Còn mấy phút?", "Nhanh lên", "Cắt chưa?"): [ _____ cues ]          |
| Avoidable Message Ratio (Clarifications / Total * 100%):                   [ ____._ %   ]          |
|                                                                                                    |
| Host Comprehension Latencies (Time from cue appearance to verbal pivot):                           |
|   - Cue 1 (D1 Overrun / Toner Compress): Sent: __:__:__.__ | Pivot: __:__:__.__ | Lat: ___._ s      |
|   - Cue 2 (D2 Pre-Anchor 30s Countdown): Sent: __:__:__.__ | Pivot: __:__:__.__ | Lat: ___._ s      |
|   - Cue 3 (D3 Stockout Emergency Cut):   Sent: __:__:__.__ | Pivot: __:__:__.__ | Lat: ___._ s      |
|   - Cue 4 (D4 Holding Action Minigame):  Sent: __:__:__.__ | Pivot: __:__:__.__ | Lat: ___._ s      |
|   - Cue 5 (D5 Under-run Holding Action): Sent: __:__:__.__ | Pivot: __:__:__.__ | Lat: ___._ s      |
|   MEDIAN HOST COMPREHENSION LATENCY:                                       [ ____._ s   ]          |
|   PERCENTAGE UNDERSTOOD IN <= 5.0 SECONDS:                                 [ ____._ %   ]          |
|                                                                                                    |
| Host Delivery Degradation Indicators:                                                              |
|   - Speech Stumble / Verbal Hesitations within 5s of cue (B-07):           [ _____ incidents ]     |
|   - Teleprompter Glaze Incidents (>4s continuous screen gaze) (B-06):      [ _____ incidents ]     |
|   - Unscripted Dead Air (>5s continuous stream silence) (B-08):            [ _____ incidents ]     |
+----------------------------------------------------------------------------------------------------+
```

---

### Sheet 5.5: NASA-TLX Cognitive Workload Questionnaire

Administered immediately following trial completion. The operator marks their rating on each continuous scale from 0 to 100 (in increments of 5):

```
+----+-----------------------+---------------------------------------------------+-------+
| ID | Subscale              | Rating Scale & Anchors                            | Score |
+----+-----------------------+---------------------------------------------------+-------+
| 01 | MENTAL DEMAND         | Low |---|---|---|---|---|---|---|---|---| High    | [   ] |
|    |                       | 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
| 02 | PHYSICAL DEMAND       | Low |---|---|---|---|---|---|---|---|---| High    | [   ] |
|    |                       | 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
| 03 | TEMPORAL DEMAND       | Low |---|---|---|---|---|---|---|---|---| High    | [   ] |
|    |                       | 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
| 04 | PERFORMANCE (INVERTED)| Good|---|---|---|---|---|---|---|---|---| Poor    | [   ] |
|    | (0 = Perfect, 100=Fail| 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
| 05 | EFFORT                | Low |---|---|---|---|---|---|---|---|---| High    | [   ] |
|    |                       | 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
| 06 | FRUSTRATION LEVEL     | Low |---|---|---|---|---|---|---|---|---| High    | [   ] |
|    |                       | 0              25             50             75       100      |
+----+-----------------------+---------------------------------------------------+-------+
|    | RAW NASA-TLX SCORE    | (MD + PD + TD + OP + EF + FR) / 6                 | [ . ] |
+----+-----------------------+---------------------------------------------------+-------+
```

---

### Sheet 5.6: Post-Show Fact Battery & Reconstruction Log

```
+----------------------------------------------------------------------------------------------------+
| POST-SHOW RECONSTRUCTION & 10-ITEM FACT AUDIT                                                      |
+----------------------------------------------------------------------------------------------------+
| Reconstruction Start: [ __:__:__ ]   Reconstruction Complete: [ __:__:__ ]  Elapsed: [ __.__ min ]  |
+----+---------------------------------------------------------------+--------------+----------------+
| #  | Factual Audit Question (Proctor Administered)                 | Correct Fact | Operator Ans |
+----+---------------------------------------------------------------+--------------+----------------+
| 1  | Which product experienced the largest timing overrun?         | Hero 1 Serum | [ ] Correct    |
| 2  | What was the exact overrun duration (within +/- 30s)?         | +1.5m (90s)  | [ ] Correct    |
| 3  | Was Segment 3 (Toner) compressed, and by approximately how    | Yes, by 1.5m | [ ] Correct    |
|    | much? (Scheduled 3.0m -> Actual 1.5m)                         | (Down to 1.5m|                |
| 4  | Did Hard Anchor 1 (Flash Kem) start on time (+/- 15s)?        | Yes, 09:00:00| [ ] Correct    |
| 5  | What was the remaining buffer immediately prior to Anchor 1?  | 0.0m (Exhaust| [ ] Correct    |
| 6  | At what timecode did the inventory stockout drop to zero?     | 10:15 / S4+1m| [ ] Correct    |
| 7  | Which product was pulled forward to resolve the stockout?     | S5 Kem Nắng  | [ ] Correct    |
| 8  | How long did the Seller Center pinning lag stall operations?  | 40 seconds   | [ ] Correct    |
| 9  | Did Closing Anchor 2 start within 15 seconds of commitment?   | Yes, 14:00:00| [ ] Correct    |
| 10 | What was the total broadcast variance at show end (+/- 30s)?  | 0.0m (+/-15s)| [ ] Correct    |
+----+---------------------------------------------------------------+--------------+----------------+
TOTAL CORRECT FACTUAL ANSWERS:                                               [ _____ / 10 ]          |
FACT ACCURACY SCORE (A_facts = Correct / 10 * 100%):                         [ ____._ %   ]          |
====================================================================================================
NEXT LIVE ADAPTATION TASK:
Planning Start: [ __:__:__ ]   Planning Complete: [ __:__:__ ]   Elapsed:    [ __.__ min  ]          |
Constraint Validation Audit:
  - Did patched allocations respect product floor minimums?                  [ ] YES   [ ] NO         |
  - Did patched allocations preserve downstream hard anchor timing?          [ ] YES   [ ] NO         |
FEASIBLE NEXT LIVE PLAN STATUS:                                              [ ] PASS  [ ] FAIL       |
====================================================================================================
```

---

## 6. Verification & Quality Assurance Method

1. **Dual-Rater Reconciliation:** After each trial, Observer 1 and Observer 2 must cross-compare logged timestamps for $t_{\text{stimulus}}$, $t_{\text{detect}}$, and $t_{\text{action}}$.
2. **Discrepancy Threshold:** Any timestamp discrepancy $> 2.0\text{ seconds}$ between raters must be arbitrated by immediate joint review of the synchronized OBS 60fps multi-track video master.
3. **Data Lock:** Reconciled values are transcribed into the official master ledger (`docs/validation/v3/12_RESULT_TEMPLATE.md`). No alterations may be made to the ledger once signed by the Validation Researcher.
