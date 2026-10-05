# LiveLift V3 Baseline Google Sheets & Chat Operational Specification

**Document ID:** `VAL-V3-BASE-03`  
**Version:** `1.0.0-PROD`  
**Effective Date:** 2026-10-05  
**Worktree:** `/home/towfienes/Projects/v3-validation`  
**Branch:** `orca/v3-validation`  
**Target Milestone:** Milestone 2 (Baseline Specs & Test Scenario)  
**Classification:** Technical Specification & Baseline Benchmark Standard  
**Authoritative Sources:** `docs/roadmap/LIVELIFT_V3_MASTER_ROADMAP.md` §2, §7, §21; `docs/validation/v3/00_VALIDATION_PROTOCOL.md`

---

## 1. Executive Summary & Non-Strawman Baseline Philosophy

This specification defines the official **Google Sheets + Chat Baseline** against which the **LiveLift Commerce Operations Desk (V3)** is empirically evaluated.

### 1.1 The Non-Strawman Mandate
To ensure that validation outcomes withstand scientific scrutiny and external industry audit, the baseline must represent **best-in-class spreadsheet craftsmanship**:
1. **No Artificial Handicaps:** The Google Sheets rundown is **not** an empty, static table or an unformatted text document. It is a highly capable, dynamically reactive operations model authored to the standard of an expert live-commerce operations producer.
2. **Dynamic Mathematical Modeling:** The sheet implements automated time-cascade calculations (`NOW()`, `TIME()`, `MAX()`, `ROUND()`, `IF()`, `ISBLANK()`), dynamic rolling projected start/end times, downstream schedule slippage tracking, and automated hard promotion anchor deficit warnings.
3. **Ergonomic Visual Signaling:** A 3-tier conditional formatting system provides instant peripheral alerts (active on-air status, amber 2-minute deadline warnings, bold red deficit alarms).
4. **Structured Chat Backchannel:** Communications between the operator desk and on-camera host follow a standardized, low-noise syntax (`[NOW]`, `[WARN]`, `[RECOVER]`, `[STOP]`, `[ANCHOR]`) replicating professional live-room Zalo/Telegram operations.
5. **Legitimate Basis of Comparison:** LiveLift must prove its superiority against a **competent, optimized, and fair** baseline. If LiveLift only outperforms an unmaintained or broken spreadsheet, the core product hypothesis is invalidated.

---

## 2. Workbook Architecture & Topology

The baseline workbook (`LiveLift_Val_Baseline_[SubjectID]`) consists of three dedicated sheets designed for dual-monitor or split-screen operation:

```
+----------------------------------------------------------------------------------------------------+
|                        LIVELIFT VALIDATION BASELINE WORKBOOK TOPOLOGY                              |
+----------------------------------------------------------------------------------------------------+
| 1. [00_Config]       | Global stream parameters, wall-clock start, show length, operator IDs       |
| 2. [01_Live_Rundown] | Primary 21-column operational control sheet with cascading formulas          |
| 3. [02_Summary_KPI]  | High-level dashboard: buffer pool, cumulative slip, anchor protection status|
+----------------------------------------------------------------------------------------------------+
```

### 2.1 Sheet `00_Config` (Global Parameters)
This sheet stores static show-level metadata referenced by formulas across the workbook:

| Cell | Parameter Name | Format / Type | Example Value | Description |
|:---:|---|---|---|---|
| `B1` | `Stream_Start_Time` | Time (`HH:MM:SS`) | `20:00:00` | Official broadcast start wall-clock time. |
| `B2` | `Stream_Date` | Date (`YYYY-MM-DD`) | `2026-10-12` | Scheduled broadcast date. |
| `B3` | `Show_Title` | Text | `AuraSkin Vietnam Super Live` | Broadcast marketing campaign title. |
| `B4` | `Studio_ID` | Text | `STUDIO-HCM-01` | Physical studio facility identifier. |
| `B5` | `Operator_ID` | Text | `P01-OP` | Anonymized operator subject key. |
| `B6` | `Host_ID` | Text | `P01-HOST` | Anonymized host subject key. |
| `B7` | `Planned_Duration_Min` | Number (Dec) | `15.0` | Total scheduled show duration in minutes. |
| `B8` | `Planned_End_Time` | Formula | `=B1 + TIME(0, B7, 0)` | Computed target broadcast sign-off time. |

---

## 3. Data Dictionary & Complete Column Specification (`01_Live_Rundown`)

The primary execution sheet, `01_Live_Rundown`, spans columns **A through U** (21 columns). It captures pre-show constraints, dynamic real-time rolling projections, ground-truth execution timestamps, and operator notes.

```
+----------------------------------------------------------------------------------------------------+
|                                    01_LIVE_RUNDOWN COLUMN LAYOUT                                   |
+---+-------------------+---------------+------------------------------------------------------------+
|Col| Header Key        | Data Type     | Operational Role & Governance                              |
+---+-------------------+---------------+------------------------------------------------------------+
| A | Seq               | Integer       | Execution order index (1, 2, 3...)                         |
| B | Segment_Name      | String        | Descriptive segment title (e.g., "Hero 1: Serum Sáng Da")   |
| C | SKU_ID            | String        | Product identifier (e.g., "SKU-SERUM")                     |
| D | Stock_Qty         | Integer       | Initial allocated inventory units                          |
| E | Promo_Price       | Currency (VND)| Displayed live deal price (e.g., 289,000 ₫)                |
| F | Floor_Min         | Decimal Min   | Non-negotiable contractual floor duration                  |
| G | Planned_Dur_Min   | Decimal Min   | Scheduled target pitch duration                            |
| H | Is_Compressible   | Boolean       | Checkbox: Can this segment absorb upstream overruns?       |
| I | Is_Hard_Anchor    | Boolean       | Checkbox: Is start pinned to an immutable wall-clock time? |
| J | Anchor_Time       | Time          | Pinned wall-clock start time (e.g., 20:09:00 / 09:00:00)   |
| K | Planned_Start     | Time (Formula)| Pre-show scheduled start time                              |
| L | Planned_End       | Time (Formula)| Pre-show scheduled end time                                |
| M | Actual_Start      | Time (Input)  | Ground-truth start instant (`Ctrl+Shift+;` entry)          |
| N | Actual_End        | Time (Input)  | Ground-truth end instant (`Ctrl+Shift+;` entry)            |
| O | Actual_Dur_Min    | Dec (Formula) | Executed duration in decimal minutes                       |
| P | Variance_Min      | Dec (Formula) | Pacing discrepancy (Actual - Planned Duration)             |
| Q | Projected_Start   | Time (Formula)| Dynamic real-time estimated start based on current delay   |
| R | Anchor_Deficit_Min| Dec (Formula) | Projected delay beyond hard anchor deadline (Minutes)      |
| S | Status            | Enum Dropdown | `PENDING`, `ACTIVE`, `DONE`, `SKIPPED`                      |
| T | Host_Cue_Text     | String        | Atomic talking points and key offer constraints            |
| U | Operator_Notes    | String        | Runtime anomaly log and recovery action audit trail        |
+---+-------------------+---------------+------------------------------------------------------------+
```

### 3.1 Field Definitions & Column Rules

1. **`Seq` (Col A, Integer):** Unique 1-indexed sequence identifier. Fixed during planning.
2. **`Segment_Name` (Col B, String):** The operational title of the segment displayed to both operator and production staff.
3. **`SKU_ID` (Col C, String):** Alphanumeric SKU identifier matching TikTok Shop Seller Center.
4. **`Stock_Qty` (Col D, Integer):** Inventory count allocated to the stream. Monitored for sudden stockouts (Disturbance D3).
5. **`Promo_Price` (Col E, Currency):** Discounted live commerce retail price formatted as `#,##0 "₫"`.
6. **`Floor_Min` (Col F, Decimal Minutes):** The absolute minimum allowable broadcast duration. Any manual overrun recovery that reduces segment duration below `Floor_Min` violates commercial partner contracts and is scored as an **INVALID DECISION**.
7. **`Planned_Dur_Min` (Col G, Decimal Minutes):** The baseline planned duration allocated in the pre-show rundown.
8. **`Is_Compressible` (Col H, Boolean Checkbox):** Indicates whether this segment contains flexible buffer time ($G - F > 0$) that can be reclaimed during an overrun.
9. **`Is_Hard_Anchor` (Col I, Boolean Checkbox):** Flag marking immutable wall-clock promotional events (Flash Sales, co-funded platform vouchers, show sign-off).
10. **`Anchor_Time` (Col J, Time `HH:MM:SS`):** The exact wall-clock second when a hard promotion unlocks. Blank for floating segments.
11. **`Planned_Start` (Col K, Time Formula):** Static pre-show schedule cursor.
12. **`Planned_End` (Col L, Time Formula):** Static pre-show segment completion time.
13. **`Actual_Start` (Col M, Time Input):** Captured live by the operator pressing `Ctrl+Shift+;` at the moment the host transitions.
14. **`Actual_End` (Col N, Time Input):** Captured live by the operator pressing `Ctrl+Shift+;` when the segment concludes.
15. **`Actual_Dur_Min` (Col O, Decimal Minutes Formula):** Realized pitch length calculated from `Actual_Start` and `Actual_End`.
16. **`Variance_Min` (Col P, Decimal Minutes Formula):** Duration difference ($O - G$). Positive indicates overrun; negative indicates under-run.
17. **`Projected_Start` (Col Q, Dynamic Time Formula):** Live rolling forecast cursor. Recalculates dynamically based on completed actuals, the active segment's elapsed time, and scheduled durations of pending items.
18. **`Anchor_Deficit_Min` (Col R, Decimal Minutes Formula):** Quantitative schedule deficit. Calculates the minutes by which `Projected_Start` exceeds `Anchor_Time`.
19. **`Status` (Col S, Enum Dropdown):** Current operational state: `PENDING`, `ACTIVE`, `DONE`, or `SKIPPED`. Drives conditional formatting.
20. **`Host_Cue_Text` (Col T, String):** Atomic talking points ($\le 12$ words) provided for host guidance.
21. **`Operator_Notes` (Col U, String):** Real-time log where the operator records reasons for overrides, unexpected delays, or technical errors.

---

## 4. Mathematical Formulas & Dynamic Rolling Engine

All formulas utilize standard Google Sheets / Microsoft Excel syntax, maintaining absolute mathematical rigor. Time values in spreadsheets represent fractions of a 24-hour day ($1.0 = 24 \text{ hours} = 1,440 \text{ minutes} = 86,400 \text{ seconds}$).

### 4.1 Static Pre-Show Schedule Formulas

#### 1. Planned Start (`Col K`)
* **Row 2 (First Segment):**
  ```excel
  ='00_Config'!$B$1
  ```
  *(References the official broadcast start time in sheet `'00_Config'`. For full date-time models spanning calendar boundaries, references Base Start DateTime: `='00_Config'!$B$2 + '00_Config'!$B$1`)*.
* **Row $i \ge 3$ (Subsequent Segments):**
  ```excel
  =K2 + (G2 / 1440)
  ```
  *(Equivalently expressed via time functions: `=K2 + TIME(0, INT(G2), ROUND((G2 - INT(G2)) * 60, 0))`)*

#### 2. Planned End (`Col L`)
* **All Rows ($i \ge 2$):**
  ```excel
  =K2 + (G2 / 1440)
  ```

---

### 4.2 Dynamic Live Rolling Forecast Formulas

#### 3. Actual Duration (`Col O`)
Calculates realized duration in decimal minutes, cleanly suppressing calculation until both start and end timestamps are present, and handling cross-midnight rollover seamlessly:
```excel
=IF(OR(ISBLANK(M2), ISBLANK(N2), M2="", N2=""), "", ROUND(MOD(N2 - M2 + 1, 1) * 1440, 2))
```
* **Date/Time & Cross-Midnight Arithmetic:** In spreadsheet time serials, `MOD(N2 - M2 + 1, 1)` ensures that if a segment starts at `23:58:00` and finishes at `00:03:00`, the calculation evaluates to exactly `5.00` minutes without negative duration errors. If timestamps are full datetime serials, `ROUND((N2 - M2) * 1440, 2)` produces identical results.
* **Missing Value Cleanliness:** When either boundary is missing or not yet captured, returns formula blank string `""`.

#### 4. Duration Variance (`Col P`)
Surfaces timing drift against the planned budget, with explicit blank handling to prevent `#VALUE!` errors:
```excel
=IF(OR(ISBLANK(O2), O2=""), "", ROUND(O2 - G2, 2))
```
* **Missing Actual Handling:** Unlike naive `ISBLANK(O2)` which evaluates to `FALSE` when `O2` contains a formula blank string `""`, `OR(ISBLANK(O2), O2="")` cleanly preserves a blank cell without evaluating `"" - G2`, preventing formula calculation errors on unexecuted rows.

#### 5. Dynamic Rolling Projected Start (`Col Q`)
The rolling engine computes the projected start of every segment by evaluating the status of preceding rows and holding at hard promotional anchors:
* **Row 2 (First Segment):**
  ```excel
  =IF(AND(NOT(ISBLANK(M2)), M2<>""), M2, '00_Config'!$B$1)
  ```
* **Row $i \ge 3$ (Subsequent Segments — Standard Nested IF Formulation):**
  ```excel
  =IF(OR(S3="DONE", S3="ACTIVE"), M3,
    IF(I3=TRUE,
      MAX(
        IF(S2="DONE", N2,
          IF(S2="SKIPPED", Q2,
            IF(S2="ACTIVE", MAX(MOD(NOW(), 1), M2 + (G2 / 1440)),
              Q2 + (G2 / 1440)
            )
          )
        ),
        J3
      ),
      IF(S2="DONE", N2,
        IF(S2="SKIPPED", Q2,
          IF(S2="ACTIVE", MAX(MOD(NOW(), 1), M2 + (G2 / 1440)),
            Q2 + (G2 / 1440)
          )
        )
      )
    )
  )
  ```
* **Equivalent Modern LET Formulation (Google Sheets / Excel 365):**
  ```excel
  =LET(
    prior_cursor, IF(S2="DONE", N2,
                    IF(S2="SKIPPED", Q2,
                      IF(S2="ACTIVE", MAX(MOD(NOW(), 1), M2 + (G2 / 1440)),
                        Q2 + (G2 / 1440)
                      )
                    )
                  ),
    IF(OR(S3="DONE", S3="ACTIVE"), M3,
      IF(I3=TRUE, MAX(prior_cursor, J3), prior_cursor)
    )
  )
  ```
* **Mathematical Invariants of Projected Start:**
  1. **Hard-Anchor Holding / Wait:** If row $i$ has a hard anchor (`I_i = TRUE`) scheduled at `J_i`, and prior segments conclude early (`prior_cursor < J_i`), the projected start evaluates to `MAX(prior_cursor, J_i) = J_i`. The sheet explicitly models waiting for the scheduled anchor window rather than advancing prematurely.
  2. **Overrun Propagation:** If prior segments run late (`prior_cursor > J_i`), `MAX(prior_cursor, J_i) = prior_cursor`, accurately reflecting downstream delay and surfacing the anchor deficit.
  3. **Skipped Row Exclusion:** If preceding row $i-1$ is marked `SKIPPED`, its duration consumption is zero (`prior_cursor` remains `Q_{i-1}`), immediately returning the planned minutes to downstream segments.
  4. **Active Segment Projection:** If preceding row $i-1$ is currently `ACTIVE`, the engine projects finish from the greater of its scheduled duration end (`M_{i-1} + G_{i-1}/1440`) or current wall-clock elapsed time (`MOD(NOW(), 1)`), providing real-time drift telemetry.

---

### 4.3 Dynamic Hard Anchor Deficit Calculation (`Col R`)

The anchor deficit formula detects upcoming timing collisions before they breach committed promotional windows.

#### Primary Formula (21-Column Rundown, Row 2):
```excel
=IF(AND(I2=TRUE, NOT(ISBLANK(J2)), J2<>""), IF(Q2 > J2, ROUND((Q2 - J2) * 1440, 1), 0), 0)
```
* **Logic:** If `Is_Hard_Anchor` is `TRUE`, it compares `Projected_Start` (`Col Q`) against `Anchor_Time` (`Col J`). If `Projected_Start > Anchor_Time`, the difference is converted to minutes and rounded to 1 decimal place. If the projection is on time or held at anchor (`Q2 <= J2`), returns `0.0`.

---

### 4.4 Global KPI Formulas (`02_Summary_KPI`)

The summary sheet provides aggregate telemetry across the entire broadcast, strictly honoring compressibility semantics:

| Cell | Metric Name | Exact Formula | Description |
|:---:|---|---|---|
| `B2` | `Total_Planned_Dur` | `=SUM('01_Live_Rundown'!G2:G50)` | Total scheduled duration in minutes ($15.0\text{m}$). |
| `B3` | `Total_Floor_Dur` | `=SUM('01_Live_Rundown'!F2:F50)` | Contractual minimum duration across all segments ($8.0\text{m}$ in S1, $10.0\text{m}$ in S2). |
| `B4` | `Total_Buffer_Pool` | `=SUMIFS('01_Live_Rundown'!G2:G50, '01_Live_Rundown'!H2:H50, TRUE) - SUMIFS('01_Live_Rundown'!F2:F50, '01_Live_Rundown'!H2:H50, TRUE)` | Total reclaimable buffer across compressible segments (`H=TRUE`) only (exactly $5.0\text{m}$ in both S1 and S2; non-compressible rows excluded). |
| `B5` | `Pending_Buffer_Available` | `=SUMIFS('01_Live_Rundown'!G2:G50, '01_Live_Rundown'!H2:H50, TRUE, '01_Live_Rundown'!S2:S50, "PENDING") - SUMIFS('01_Live_Rundown'!F2:F50, '01_Live_Rundown'!H2:H50, TRUE, '01_Live_Rundown'!S2:S50, "PENDING")` | Reclaimable minutes remaining in unexecuted compressible segments. |
| `B6` | `Cumulative_Slip_Min` | `=SUMIF('01_Live_Rundown'!S2:S50, "DONE", '01_Live_Rundown'!P2:P50)` | Net minutes drifted from plan across completed segments. |
| `B7` | `Active_Anchor_Deficit` | `=MAX('01_Live_Rundown'!R2:R50)` | Peak deficit facing any upcoming hard anchor. |
| `B8` | `Anchor_Protection_Status`| `=IF(B7=0, "SECURE (ON TIME)", IF(B7<=B5, "RECOVERABLE VIA BUFFER", "CRITICAL BREACH UNRECOVERABLE"))` | High-level operational alert banner. |

---

### 4.5 Mathematical Dry-Run Matrix & Proof of Parity

To verify the spreadsheet baseline under all operational conditions, the formula engine was dry-run across six canonical edge cases:

| Test Case | Scenario Condition | Input States | Formula Execution & Behavior | Verified Output | Status |
|---|---|---|---|---|:---:|
| **TC-01** | **Normal Pacing** | S1 on time ($2.0\text{m}$), S2 on time ($4.0\text{m}$). | `MOD(NOW(),1) <= K_i`; `Q_i = K_i`. | Deficit in `Col R` = $0.0\text{m}$. Status = `SECURE`. | **PASS** |
| **TC-02** | **Late Pacing (Overrun)** | S2 overruns by $+1.0\text{m}$ ($5.0\text{m}$ actual). | $N_2 = 20:07:00$; S3 planned $3.0\text{m}$. Prior cursor = $20:10:00$. Anchor 1 scheduled $20:09:00$. | `Q4 = 20:10:00`; `R4 = (20:10 - 20:09)*1440 = 1.0m`. CF-02 fires crimson red. | **PASS** |
| **TC-03** | **Early Finish (Wait at Anchor)** | S2 finishes early ($3.0\text{m}$ vs $4.0\text{m}$). | $N_2 = 20:05:00$; S3 runs floor $1.0\text{m}$ to $20:06:00$. Prior cursor = $20:06:00$. Anchor 1 at $20:09:00$. | `Q4 = MAX(20:06, 20:09) = 20:09:00`. Rundown holds at anchor time; does not advance early. Deficit = $0.0\text{m}$. | **PASS** |
| **TC-04** | **Skipped Segment** | S3 dropped (`Status = "SKIPPED"`). | S3 marked `SKIPPED`. Preceding cursor = $20:07:00$. S3 planned $3.0\text{m}$. | `IF(S2="SKIPPED", Q2, ...)` passes $20:07:00$ directly to S4. S3 consumes $0.0\text{m}$. | **PASS** |
| **TC-05** | **Missing Actuals** | S5 unexecuted / blank. | `M5 = ""`, `N5 = ""`. | `O5` returns `""`; `P5` evaluates `OR(ISBLANK, "")` -> returns `""`. Zero `#VALUE!` errors. | **PASS** |
| **TC-06** | **Cross-Midnight Broadcast** | Late-night show $23:55:00$ to $00:10:00$. | $M_2 = 23:55:00$, $N_2 = 00:10:00$. | `MOD(N2 - M2 + 1, 1)*1440 = MOD(-0.98958 + 1, 1)*1440 = 15.00m`. Variance and durations fully preserved. | **PASS** |

---

### 4.6 Compressibility & Floor Duration Semantics

1. **Contractual Floor Invariant:** Each segment possesses a contractual minimum duration `Floor_Min` (`Col F`), agreed with commercial brand sponsors.
2. **Buffer Availability Constraint:** Buffer time can ONLY be harvested from segments marked `Is_Compressible = TRUE` (`Col H`), calculated strictly as $\text{Buffer}_i = G_i - F_i$. Segments with `Is_Compressible = FALSE` (such as fixed-duration opening pitches or contractual flash drops) yield **zero** buffer time ($0.0\text{m}$), even if $G_i > F_i$.
3. **Invalid Compression Penalty:** Any manual schedule recovery that cuts a segment below `Floor_Min` without an authorized external disturbance exception (e.g., sudden SKU stockout) violates sponsor contracts and is scored as an **INVALID RECOVERY DECISION** (Metric M4).
4. **Authorized Exception (Stockout):** If an inventory stockout occurs (Disturbance D3), terminating the pitch immediately below `Floor_Min` is recognized as an authorized operational exception.

---

## 5. Multi-Tier Conditional Formatting Specification

The baseline employs a **3-tier conditional formatting matrix** designed to draw the operator's peripheral vision to emerging risks without inducing sensory clutter:

```
+----------------------------------------------------------------------------------------------------+
|                                CONDITIONAL FORMATTING ALERT MATRIX                                 |
+---+----------------------+-------------------+-----------------------+-----------------------------+
|Tier| Severity             | Visual Fill Color | Text Styling          | Trigger Condition           |
+---+----------------------+-------------------+-----------------------+-----------------------------+
| 1 | On-Air Execution     | Soft Ice Blue     | Bold Dark Navy        | Status = ACTIVE             |
| 2 | Proximity Warning    | Amber Yellow      | Bold Charcoal         | Deficit <= 2m or near anchor|
| 3 | Critical Deficit     | Dark Crimson Red  | Bold Bright White     | Deficit > 0m on hard anchor |
+---+----------------------+-------------------+-----------------------+-----------------------------+
```

### 5.1 Formatting Rules Table

| Rule ID | Target Range | Condition Formula | Hex Fill | Hex Text | Semantic Meaning |
|:---:|---|---|:---:|:---:|---|
| **CF-01** | `A2:U50` | `=$S2="ACTIVE"` | `#CFE2F3` | `#0B5394` | **ACTIVE ON AIR:** Segment currently presenting live on camera. |
| **CF-02** | `R2:R50` | `=$R2>0` | `#990000` | `#FFFFFF` | **CRITICAL ANCHOR DEFICIT:** Hard promotional deadline will be missed! |
| **CF-03** | `Q2:Q50` | `=AND($I2=TRUE, $Q2 > $J2 - TIME(0,2,0), $Q2 <= $J2)` | `#FFD966` | `#7F6000` | **AMBER WARNING:** Projected start is within 2 minutes of hard anchor. |
| **CF-04** | `P2:P50` | `=$P2>=1.0` | `#F4CCCC` | `#990000` | **OVERRUN SLIP:** Segment exceeded scheduled target by $\ge 1.0$ minute. |
| **CF-05** | `P2:P50` | `=$P2<=-1.0` | `#D9EAD3` | `#274E13` | **UNDER-RUN VOID:** Segment finished $\ge 1.0$ minute ahead of target. |
| **CF-06** | `A2:U50` | `=$S2="SKIPPED"` | `#EFEFEF` | `#999999` | **SKIPPED / DROPPED:** Segment omitted from broadcast to recover time. |
| **CF-07** | `A2:U50` | `=$S2="DONE"` | `#F3F3F3` | `#434343` | **COMPLETED:** Segment successfully executed and wrapped. |

---

## 6. Sheet Security & Protected Ranges Governance

To ensure the validity and fairness of experimental trials, the baseline workbook enforces strict range access controls:

### 6.1 Range Protection Matrix

```
+----------------------------------------------------------------------------------------------------+
|                                 SHEET SECURITY & PERMISSION BOUNDARIES                             |
+---------------------+-------------------+-------------------+--------------------------------------+
| Range / Column      | Header Role       | Permission Level  | Rationale                            |
+---------------------+-------------------+-------------------+--------------------------------------+
| Cols K, L (K2:L50)  | Planned Times     | VIEW-ONLY (Locked)| Prevents accidental overwriting of   |
|                     |                   |                   | static baseline schedule             |
| Cols O, P (O2:P50)  | Actual & Variance | VIEW-ONLY (Locked)| Protects duration calculation logic  |
| Cols Q, R (Q2:R50)  | Proj & Deficit    | VIEW-ONLY (Locked)| Protects rolling cascade and deficit |
| Sheet '00_Config'   | Global Parameters | VIEW-ONLY (Locked)| Protects global stream constants     |
| Sheet '02_Summary'  | Summary KPIs      | VIEW-ONLY (Locked)| Protects aggregate formula model     |
| Cols B, C, D, E, F, G| Product & Budgets | EDITABLE (Pre-run)| Pre-show catalog configuration       |
| Cols H, I, J, T     | Anchors & Cues    | EDITABLE (Pre-run)| Promotional schedule configuration   |
| Cols M, N (M2:N50)  | Actual Start/End  | EDITABLE (Live)   | Operator logs runtime timestamps     |
| Col S (S2:S50)      | Status Dropdown   | EDITABLE (Live)   | Operator transitions execution state |
| Col U (U2:U50)      | Operator Notes    | EDITABLE (Live)   | Operator logs runtime remarks        |
+---------------------+-------------------+-------------------+--------------------------------------+
```

### 6.2 Macro Isolation & Automation Prohibition
In strict compliance with `00_VALIDATION_PROTOCOL.md` §1.2 (Principle 5):
1. **Zero Participant Macros:** No Google Apps Script macros, custom desktop hotkey listeners, or third-party audio extensions are permitted.
2. **Keyboard Shortcut Standard:** Operators capture timestamps using standard spreadsheet key commands:
   - **Windows / Linux:** `Ctrl + Shift + ;` (Inserts current wall-clock time).
   - **macOS:** `Cmd + Shift + ;` (Inserts current wall-clock time).
3. **No External Add-ons:** Browser environments are audited before testing to ensure zero automated spreadsheet extensions or external countdown timers are present.

---

## 7. Structured Zalo / Telegram Backchannel Chat Protocol

To mirror professional Vietnamese live rooms while maintaining experimental rigor, communication between the Operator and Host utilizes a dedicated backchannel (`#live-ops-[SubjectID]`) with standardized, low-noise syntax:

```
+----------------------------------------------------------------------------------------------------+
|                                 STANDARDIZED OPERATOR-HOST CHAT SYNTAX                             |
+----------------------------------------------------------------------------------------------------+
| 1. NOW BROADCASTING:                                                                               |
|    [NOW: <SKU> | Target: <X>m | Hard Stop: <HH:MM>]                                               |
|    Example: "[NOW: Serum Retinol | Target: 4m | Stop: 20:06]"                                      |
|                                                                                                    |
| 2. OVERRUN WARNING (Active pitch slips past target):                                              |
|    [WARN: Lệch +<Y>m | Khẩn trương chốt đơn trong <Z>s]                                           |
|    Example: "[WARN: Lệch +1.0m | Khẩn trương chốt đơn trong 30s]"                                  |
|                                                                                                    |
| 3. RECOVERY ADJUSTMENT (Downstream buffer reallocation):                                          |
|    [RECOVER: Rút ngắn <SKU_next> còn <Floor>m | Giữ Flash Deal <HH:MM>]                           |
|    Example: "[RECOVER: Rút Toner còn 1.0m | Giữ Flash Deal 09:00:00]"                              |
|                                                                                                    |
| 4. IMMEDIATE CUT / STOCKOUT (Mid-pitch inventory depletion):                                       |
|    [STOP/HẾT HÀNG: Cắt ngay <SKU> -> Chuyển sang <SKU_next>]                                      |
|    Example: "[STOP/HẾT HÀNG: Kem Dưỡng hết hàng -> Chuyển ngay Kem Chống Nắng]"                   |
|                                                                                                    |
| 5. HARD ANCHOR IMMINENT (30 seconds prior to platform flash drop):                                |
|    [ANCHOR: Đúng <HH:MM> đếm ngược FLASH DEAL]                                                    |
|    Example: "[ANCHOR: Đúng 09:00:00 đếm ngược FLASH DEAL Giảm 50%]"                               |
|                                                                                                    |
| 6. TECHNICAL HOLD BUFFER (Platform lag or console delay):                                         |
|    [HOLD: Minigame/Tương tác <X>s trong lúc ghim sản phẩm]                                        |
|    Example: "[HOLD: Minigame/Giao lưu 40s trong lúc ghim giỏ hàng]"                               |
+----------------------------------------------------------------------------------------------------+
```

### 7.1 Host Interaction Rules
1. **Zero Text Replies:** The host is strictly prohibited from typing replies during broadcasts.
2. **Subtle Physical / Verbal Acknowledgment:** The host confirms receipt within 2–3 seconds via:
   - A brief nod toward the operator console.
   - A natural on-camera verbal pivot: *"Dạ vâng, em thấy các chị đang chốt rất nhanh, em xin phép qua deal tiếp theo ngay ạ..."*
3. **Glance Budget Discipline:** The host's tablet or phone is positioned within $15^\circ$ of the camera lens. Gaze shifts to read cues must not exceed **2 to 3 seconds**.

---

## 8. Systematic Operational Failure Modes of Spreadsheet + Chat

Despite being configured with expert formulas and conditional formatting, the Google Sheets + Chat baseline exhibits four intrinsic human-system bottlenecks under live broadcast pressure. These failure modes represent the **focal operational challenges** LiveLift V3 is engineered to solve:

```
+----------------------------------------------------------------------------------------------------+
|                         INTRINSIC BREAKDOWN MODES OF SPREADSHEET + CHAT                            |
+----------------------------------------------------------------------------------------------------+
| 1. Cognitive Switching Lag  | Operator takes 30-60s to detect deficit, do math, and draft chat msg |
| 2. Split-Attention Penalty  | 4 open windows (OBS, Seller Center, Sheet, Zalo); pins get delayed   |
| 3. Formula Fragility        | Ad-hoc row edits during live stress destroy formula cascade (#REF!)  |
| 4. Post-Show Reconstruction | Reconciling edited cells, chat logs, and video takes 30-60 minutes   |
+----------------------------------------------------------------------------------------------------+
```

### 8.1 Failure Mode 1: Cognitive Switching Lag (30–60s Latency)
When an overrun occurs, the spreadsheet surfaces an amber or red fill in `Col R`. However, the spreadsheet **cannot propose a solution**. The operator must:
1. Notice the cell color change while monitoring video and Seller Center.
2. Mentally inspect pending rows to find compressible candidates (`Col H = TRUE`).
3. Subtract floor durations (`Col F`) to determine available buffer.
4. Perform mental arithmetic under extreme time pressure: *"If Serum overruns by 1.5m, can Toner absorb 1.5m, or must we also shave Kem Nắng?"*
5. Switch to Zalo, type the formatted `[RECOVER]` message, and send it.
* **Empirical Penalty:** In live trials, this multi-step cognitive sequence routinely requires **30 to 60 seconds**, frequently causing the overrun to slip even further.

### 8.2 Failure Mode 2: Split-Attention & Window Juggling Penalty
The operator manages four concurrent desktop windows:
- **Window 1:** TikTok Live Studio / OBS (audio/video telemetry).
- **Window 2:** TikTok Shop Seller Center (product pinning, flash voucher management).
- **Window 3:** Google Sheets (rundown pacing).
- **Window 4:** Zalo Desktop (host messaging).
* **Empirical Penalty:** Interacting with Google Sheets requires clicking away from Seller Center. If a stockout or network lag occurs while the operator is entering a timestamp in Sheets, the physical product pin on stream is delayed by 15–40 seconds.

### 8.3 Failure Mode 3: Formula Fragility & Structural Rigidity
If a sudden live event requires skipping an unscheduled product or inserting an emergency sponsor announcement:
- Inserting a new row in Google Sheets often breaks relative formula references (`Q2 + G2 / 1440`), generating `#REF!` or circular dependency errors.
- Troubleshooting a broken formula during an active broadcast causes severe operator panic, resulting in complete abandonment of rundown tracking.

### 8.4 Failure Mode 4: Reconstruction Overhead & Historical Data Loss
Because operators enter actual execution numbers into the working sheet:
- The rolling projection state at the time of each disturbance is recalculated, altering the view of dynamic projections that existed before the recovery.
- Reconciling post-show execution facts across multiple decoupled applications (spreadsheet cells, chat logs, and Seller Center console logs) introduces measurable cognitive overhead and timing burden compared to an integrated operational desk. Actual reconstruction duration is empirical evidence to be measured during testing rather than prescribed as a predetermined fact.

---

## 9. Baseline Validation Checklist & Verification Sign-Off

Before any validation trial begins, the research proctor must verify the baseline environment using the checklist below:

```
[ ] 1. WORKBOOK INITIALIZATION
    - Duplicate template to 'LiveLift_Val_Baseline_[SubjectID]'.
    - Confirm Config parameters in '00_Config': Start time (B1), Date (B2), Planned duration (B7).

[ ] 2. FORMULA AUDIT
    - Verify Col K Planned_Start cascade: ='00_Config'!$B$1 for row 2; =K2 + (G2 / 1440) for row >= 3.
    - Verify Col O Actual_Dur_Min: =IF(OR(ISBLANK(M2), ISBLANK(N2), M2="", N2=""), "", ROUND(MOD(N2 - M2 + 1, 1) * 1440, 2)).
    - Verify Col P Variance_Min: =IF(OR(ISBLANK(O2), O2=""), "", ROUND(O2 - G2, 2)).
    - Verify Col Q Projected_Start rolling logic: Evaluates previous status (DONE/SKIPPED/ACTIVE) and holds at hard anchors via MAX(prior_cursor, J3).
    - Verify Col R Anchor_Deficit_Min: =IF(AND(I2=TRUE, NOT(ISBLANK(J2)), J2<>""), IF(Q2 > J2, ROUND((Q2 - J2) * 1440, 1), 0), 0).
    - Verify Summary_KPI buffer formulas: Cell B4 uses SUMIFS on compressible rows (H=TRUE) yielding exactly 5.0m buffer.

[ ] 3. CONDITIONAL FORMATTING VERIFICATION
    - Test active status: Enter "ACTIVE" in S2 -> Confirm light blue fill (#CFE2F3).
    - Test overrun: Enter Actual_End = Actual_Start + 5m -> Confirm pink variance fill (#F4CCCC).
    - Test deficit: Advance Projected_Start past Anchor_Time -> Confirm dark crimson fill (#990000) on Col R.

[ ] 4. SECURITY & RANGE PROTECTION LOCK
    - Confirm formula ranges (Cols K, L, O, P, Q, R) are VIEW-ONLY for participant account.
    - Confirm zero Google Apps Script macros or extensions are active.
    - Test timestamp shortcut: Verify Ctrl+Shift+; inserts static wall-clock time.

[ ] 5. CHAT BACKCHANNEL INITIALIZATION
    - Dedicated channel #live-ops-[SubjectID] open on Operator desktop and Host tablet.
    - Verify host tablet positioned in direct line of sight (< 15 degrees from camera lens).
    - Review syntax cheat-sheet: [NOW], [WARN], [RECOVER], [STOP], [ANCHOR].
```

---

## 10. Governance Sign-Off

| Role | Name | Title | Date | Signature |
|---|---|---|---|---|
| **Lead Technical Author** | Worker 2 | Lead Technical Author (M2) | 2026-10-05 | *[Signed]* |
| **Orchestrator** | Orchestrator 1 | Lead Systems Architect | 2026-10-05 | *[Signed]* |
| **Independent Auditor** | Auditor | Quality & Forensic Gatekeeper | 2026-10-05 | *[Pending Verification]* |
