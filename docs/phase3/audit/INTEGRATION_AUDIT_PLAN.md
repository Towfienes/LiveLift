# Phase 3 Integration Audit Plan

This document establishes the executable protocol for independently auditing and certifying the LiveLift V3 Phase 3 implementation when Platform and UI lanes deliver their worktrees.

---

## 1. Audit Prerequisites & Environment Configuration

Prior to initiating live verification against an integrated delivery, configure the following environment:

| Variable | Description / Example Value |
|---|---|
| `LIVELIFT_TEST_SERVER_URL` | `http://localhost:3130` (or `https://staging.livelift.local`) |
| `LIVELIFT_APP_ORIGIN` | `https://staging.livelift.local` |
| `LIVELIFT_WORKSPACE_ID` | `00000000-0000-4000-8000-000000000001` |
| `LIVELIFT_ROOM_ID` | `room-aud-01` |
| `LIVELIFT_GENERATION` | `11111111-1111-4111-8111-111111111111` |
| `LIVELIFT_DB_PATH` | `/var/lib/livelift/authority.sqlite` |
| `LIVELIFT_BACKUP_DIR` | `/var/backups/livelift` |
| `LIVELIFT_OPERATOR_USERNAME` | `operator` |
| `LIVELIFT_OPERATOR_PASSWORD` | `OperatorPassword123!` |
| `LIVELIFT_VIEWER_USERNAME` | `viewer` |
| `LIVELIFT_VIEWER_PASSWORD` | `ViewerPassword123!` |

---

## 2. Lane Delivery Handoff Verification Gates

Every candidate branch or merge submission must pass through the sequential gates below:

```mermaid
flowchart TD
    A["Integrated Delivery Candidate"] --> B{"Gate 1: Contract Typing & Schemas"}
    B -- Passes --> C{"Gate 2: Linter & Static Security"}
    B -- Fails --> FAIL["Reject Delivery"]
    C -- Passes --> D{"Gate 3: In-Process Unit & Regression Suite"}
    C -- Fails --> FAIL
    D -- Passes --> E{"Gate 4: Live HTTP Adversarial Acceptance Suite"}
    D -- Fails --> FAIL
    E -- Passes --> F{"Gate 5: Backup & Restore Ops Drill"}
    E -- Fails --> FAIL
    F -- Passes --> G{"Gate 6: Accessibility Automated & Manual Checklist"}
    F -- Fails --> FAIL
    G -- Passes --> H{"Gate 7: 48-Hour Production Soak Gate"}
    G -- Fails --> FAIL
    H -- Passes --> CERTIFIED["Phase 3 Production Certified"]
```

### Gate 1: Contract Typing & Schemas (PASS NOW)
- **Command:** `npm run typecheck` (in `next/`)
- **Pass Criteria:** 0 TypeScript compilation errors. Frozen contracts in `contracts/production.ts` and `contracts/authority.ts` must remain completely unmodified.

### Gate 2: Code Quality & Static Linter (PASS NOW)
- **Command:** `npm run lint` (in `next/`)
- **Pass Criteria:** 0 ESLint errors and 0 warnings.

### Gate 3: In-Process Unit, Fixtures & Regression Suite (PASS NOW)
- **Command:** `npm test` (in `next/`)
- **Pass Criteria:** All 28 test files and 340 tests pass (55 live tests skipped gracefully when live server is not running).

### Gate 4: Live HTTP Adversarial Acceptance Suite (INTEGRATION REQUIRED)
- **Command:**
  ```bash
  export LIVELIFT_TEST_SERVER_URL=http://localhost:3130
  export LIVELIFT_APP_ORIGIN=http://localhost:3130
  npm test
  ```
- **Pass Criteria:** All 395 tests pass with 0 failures and 0 skipped. Verifies P3-AUTH, P3-ISOLATION, P3-AUTHZ, P3-CSRF, P3-STORAGE, P3-SECURITY, P3-OBSERVABILITY, and P3-DATA.

### Gate 5: Backup & Restore Ops Drill (INTEGRATION REQUIRED)
- **Protocol:**
  1. Trigger verified backup via CLI (`ops backup`).
  2. Confirm manifest fields, checksum SHA-256, and SQLite integrity check.
  3. Modify database or advance room revision.
  4. Perform restore drill via CLI (`ops restore <backup-dir>`).
  5. Confirm:
     - New generation assigned.
     - Login sessions revoked.
     - Restored accounts disabled until admin revalidation.
     - Recovery notice present with correct backup revision.
     - Measured restore duration <= 1 hour (RTO).

### Gate 6: Accessibility Verification
- **Automated:** Execute axe scans once `axe-core` is integrated by Platform lane (`npm run test:a11y`).
- **Manual Evidence Checklist:**
  - [ ] Complete critical flow using only the keyboard (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`).
  - [ ] Dialog focus trap: Tab cannot leave active restore modal; focus returns to trigger on dismissal.
  - [ ] 200% zoom: Layout scales without clipping, overlaps, or horizontal scrollbars.
  - [ ] Screen reader verification: NVDA / VoiceOver correctly announces Login, LIVE start transition, and Restore dialog.
  - [ ] Timer verification: Elapsed segment timers are not spammed to screen reader every second.

### Gate 7: 48-Hour Production Soak Endurance Rehearsal
- **Protocol:**
  ```bash
  # Execute full 48h soak rehearsal against staging host
  node --import tsx acceptance/soakRunner.ts --mode rehearsal_48h --duration 48h
  ```
- **Pass Criteria:**
  - 48 hours continuous execution without crash or restart loop.
  - Zero divergence between operator and viewer reads.
  - Zero invariant violations.
  - Reconciles 100% of simulated network glitch dropouts via receipt lookup.
  - Periodic backup checks passing.

---

## 3. Step-by-Step Executable Audit Runbook

### Step 3.1: Initialize Clean Deployment
```bash
# 1. Clean slate
rm -f /tmp/livelift-prod-audit.sqlite /tmp/.livelift-*.json
mkdir -p /tmp/backups

# 2. Run explicit initialization via ops CLI
./ops init --db /tmp/livelift-prod-audit.sqlite --workspace 00000000-0000-4000-8000-000000000001 --room room-aud-01

# 3. Add operator and viewer accounts
./ops user add --username operator --name "Lead Operator" --role operator --password-file /tmp/op_pass.txt
./ops user add --username viewer --name "Guest Viewer" --role viewer --password-file /tmp/vw_pass.txt
```

### Step 3.2: Verify Startup & Probe Semantics
```bash
# Start server in production mode
npm run dev -- -p 3130 &
SERVER_PID=$!
sleep 2

# Probe liveness (healthz)
curl -s http://localhost:3130/api/healthz
# Expected: HTTP 200 {"status":"ok"}

# Probe readiness (readyz)
curl -s http://localhost:3130/api/readyz
# Expected: HTTP 200 {"status":"ok"}
```

### Step 3.3: Adversarial Authentication & Cookie Inspection
```bash
# 1. Login as operator
curl -i -s -X POST http://localhost:3130/api/v3/auth/login \
  -H "Content-Type: application/json" \
  -H "X-LiveLift-Request: 1" \
  -H "Origin: http://localhost:3130" \
  -d '{"username":"operator","password":"OperatorPassword123!"}'

# Verify response headers:
# - Set-Cookie contains __Host-livelift_session
# - Cookie attributes include: Secure, HttpOnly, SameSite=Strict, Path=/
# - No Domain attribute
```

### Step 3.4: Adversarial CSRF & Context Probes
```bash
# Missing X-LiveLift-Request -> 403 csrf_failed
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3130/api/v3/room/commands \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3130" \
  -H "Cookie: __Host-livelift_session=..." \
  -d '{}'
# Expected: 403

# Wrong Origin -> 403 csrf_failed
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3130/api/v3/room/commands \
  -H "Content-Type: application/json" \
  -H "Origin: https://attacker.com" \
  -H "X-LiveLift-Request: 1" \
  -H "Cookie: __Host-livelift_session=..." \
  -d '{}'
# Expected: 403

# Valid Logout -> 200 (requires body: {})
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3130/api/v3/auth/logout \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3130" \
  -H "X-LiveLift-Request: 1" \
  -H "Cookie: __Host-livelift_session=..." \
  -d '{}'
# Expected: 200

# Supported Wrong Room Query Target -> 404 not_found
curl -s -o /dev/null -w "%{http_code}\n" -X GET "http://localhost:3130/api/v3/room?roomId=room-unconfigured-foreign" \
  -H "Cookie: __Host-livelift_session=..." \
  -H "X-LiveLift-Workspace: 00000000-0000-4000-8000-000000000001" \
  -H "X-LiveLift-Generation: 11111111-1111-4111-8111-111111111111"
# Expected: 404 (Note: context headers are Workspace and Generation; room enforcement uses query/envelope targets)
```

### Step 3.5: Execute Automated Acceptance Suites
```bash
export LIVELIFT_TEST_SERVER_URL=http://localhost:3130
npm test
```

### Step 3.6: Cleanup
```bash
kill $SERVER_PID
rm -rf /tmp/livelift-prod-audit.sqlite /tmp/backups /tmp/.livelift-*.json
```
