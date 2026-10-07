// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { chmodSync, existsSync, mkdtempSync, rmSync, statSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { SessionSchema, type Session } from "@/contracts";
import { ENV } from "./config";
import { providerFixtureSession, FIXTURE_START } from "./fixtureSession";
import { EvidenceStore } from "./store";
import { fixtureEvidence, officialFixturePayloads } from "./fixtures";
import { reconcileLiveEvidence } from "@/lib/domain/liveIntelligence";
import { initialize, deleteWorkspace } from "../operations";
import { addUser } from "../auth";
import { deployment, openExisting } from "../database";
import { closeRuntime, getRuntime } from "../runtime";
import type { ProductionConfig } from "../config";
import { GET as statusRoute } from "@/app/api/v3/intelligence/status/route";
import { GET as evidenceGet, POST as evidencePost } from "@/app/api/v3/intelligence/evidence/route";
import { POST as refreshRoute } from "@/app/api/v3/intelligence/refresh/route";
import { POST as loginRoute } from "@/app/api/v3/auth/login/route";
import { TikTokShopProvider, parseMinutePage, parseProducts, fail } from "./provider";

let folder: string, cfg: ProductionConfig, op: Record<string, string>, viewer: Record<string, string>;
const request = (path: string, headers: Record<string, string> = {}, body?: unknown): Request => new Request(`${cfg.origin}${path}`, { method: body === undefined ? "GET" : "POST", headers: {
  "Content-Type": "application/json", Origin: cfg.origin, "X-LiveLift-Request": "1", ...headers,
}, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const bodyFor = (session = providerFixtureSession()) => ({ commandId: randomUUID(), roomId: cfg.roomId, sessionId: session.id, expectedSessionRevision: session.revision, session, productMappings: [{ liveLiftProductId: "local-product-a", providerProductId: "100001" }] });
const readBody = (session: Session, extra: Record<string, unknown> = {}) => ({ roomId: cfg.roomId, sessionId: session.id, session, perspective: "later_evidence", ...extra });

beforeEach(async () => {
  folder = mkdtempSync(join(tmpdir(), "livelift-v7-test-"));
  cfg = { dbPath: join(folder, "authority.sqlite"), backupDir: join(folder, "backups"), roomId: "v7-room", workspaceId: randomUUID(), origin: "https://livelift.example.test", trustProxy: false, capabilities: [] };
  initialize(cfg);
  for (const [name, value] of Object.entries({ NODE_ENV: "production", LIVELIFT_WORKSPACE_ID: cfg.workspaceId, LIVELIFT_ROOM_ID: cfg.roomId, LIVELIFT_APP_ORIGIN: cfg.origin, LIVELIFT_DB_PATH: cfg.dbPath, LIVELIFT_BACKUP_DIR: cfg.backupDir })) vi.stubEnv(name, value);
  for (const name of Object.values(ENV)) vi.stubEnv(name, "");
  vi.stubEnv(ENV.mode, "fixture"); vi.stubEnv(ENV.dbPath, join(folder, "provider-evidence.sqlite")); vi.stubEnv(ENV.intervalPolicy, "unverified");
  const db = openExisting(cfg.dbPath);
  try { await addUser(db, "v7-op", "Operator", "operator", "fixture password sufficiently long"); await addUser(db, "v7-viewer", "Viewer", "viewer", "fixture password sufficiently long"); } finally { db.close(); }
  const signIn = async (username: string) => {
    const response = await loginRoute(request("/api/v3/auth/login", {}, { username, password: "fixture password sufficiently long" })); expect(response.status).toBe(200);
    const context = await response.json();
    return { Cookie: response.headers.get("set-cookie")!.split(";")[0], "X-LiveLift-Workspace": context.workspaceId, "X-LiveLift-Generation": context.generation };
  };
  op = await signIn("v7-op"); viewer = await signIn("v7-viewer");
});
afterEach(async () => { await closeRuntime(); vi.restoreAllMocks(); vi.unstubAllEnvs(); rmSync(folder, { recursive: true, force: true }); });

async function insertReal(session = providerFixtureSession()): Promise<Session> {
  const real = SessionSchema.parse({ ...session, environment: "REAL", id: randomUUID() });
  const rt = await getRuntime();
  rt.authority.db.prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?)").run(real.id, cfg.roomId, real.lifecycle, JSON.stringify(real), JSON.stringify({ products: real.products.map((p) => p.id), segments: real.plans[0].segments.map((s) => s.id), cues: [] }));
  return real;
}
test("existing login/context/CSRF and viewer read permissions fail closed", async () => {
  expect((await statusRoute(request("/api/v3/intelligence/status"))).status).toBe(401);
  expect((await statusRoute(request("/api/v3/intelligence/status", viewer))).status).toBe(200);
  for (const [headers, expected] of [[{ ...op, "X-LiveLift-Workspace": randomUUID() }, 404], [{ ...op, "X-LiveLift-Generation": randomUUID() }, 409]] as const) expect((await statusRoute(request("/api/v3/intelligence/status", headers))).status).toBe(expected);
  expect((await refreshRoute(request("/api/v3/intelligence/refresh", viewer, bodyFor()))).status).toBe(403);
  expect((await refreshRoute(request("/api/v3/intelligence/refresh", { ...op, Origin: "https://evil.invalid" }, bodyFor()))).status).toBe(403);
  expect((await refreshRoute(request("/api/v3/intelligence/refresh", op, { ...bodyFor(), roomId: "wrong" }))).status).toBe(404);
  const real = await insertReal();
  expect((await evidenceGet(request(`/api/v3/intelligence/evidence?roomId=${cfg.roomId}&sessionId=${real.id}`, viewer))).status).toBe(200);
  expect((await evidenceGet(request(`/api/v3/intelligence/evidence?roomId=wrong&sessionId=${real.id}`, viewer))).status).toBe(404);
  expect((await evidenceGet(request(`/api/v3/intelligence/evidence?roomId=${cfg.roomId}&sessionId=missing`, viewer))).status).toBe(404);
});
test("SIMULATED fixtures persist across restart, repeated intent is idempotent, refetch appends prior history", async () => {
  const body = bodyFor(); const original = JSON.stringify(body.session);
  const first = await (await refreshRoute(request("/api/v3/intelligence/refresh", op, body))).json();
  expect(first).toMatchObject({ state: "AVAILABLE", duplicate: false, snapshot: { mode: "SIMULATED", provider: "fixture" } });
  const path = join(folder, "provider-evidence.sqlite"); expect(statSync(path).mode & 0o777).toBe(0o600);
  await closeRuntime();
  const repeated = await (await refreshRoute(request("/api/v3/intelligence/refresh", op, body))).json(); expect(repeated.snapshot.snapshotId).toBe(first.snapshot.snapshotId); expect(repeated.duplicate).toBe(true);
  const newer = await (await refreshRoute(request("/api/v3/intelligence/refresh", op, { ...body, commandId: randomUUID(), fixtureCase: "zero_clicks" }))).json(); expect(newer.snapshot.snapshotId).not.toBe(first.snapshot.snapshotId);
  const read = await (await evidencePost(request("/api/v3/intelligence/evidence", op, readBody(body.session)))).json(); expect(read.priorSnapshots).toHaveLength(2);
  const prior = await (await evidencePost(request("/api/v3/intelligence/evidence", op, readBody(body.session, { snapshotId: first.snapshot.snapshotId })))).json(); expect(prior.snapshot).toEqual(first.snapshot);
  expect(JSON.stringify(body.session)).toBe(original);
  expect((await getRuntime()).authority.db.prepare("SELECT count(*) AS n FROM sessions").get()!.n).toBe(0);
});
test("idempotency collision with another actor or changed intent is rejected", async () => {
  const body = bodyFor(); await refreshRoute(request("/api/v3/intelligence/refresh", op, body));
  expect((await refreshRoute(request("/api/v3/intelligence/refresh", op, { ...body, fixtureCase: "zero_clicks" }))).status).toBe(409);
  const rt = await getRuntime(); const who = deployment(rt.authority.db);
  const store = new EvidenceStore(join(folder, "provider-evidence.sqlite"), who);
  try { expect(() => store.claim({ ...who, sessionId: body.sessionId, mode: "SIMULATED" }, body.commandId, "different", "different", Date.now())).toThrow("another actor or intent"); } finally { store.close(); }
});
test("REAL refuses fixture fallback and browser-supplied REAL state", async () => {
  const real = await insertReal(); const fetcher = vi.spyOn(TikTokShopProvider.prototype, "getMinuteEvidence");
  const response = await refreshRoute(request("/api/v3/intelligence/refresh", op, { commandId: randomUUID(), roomId: cfg.roomId, sessionId: real.id, providerSessionId: "123", expectedSessionRevision: real.revision }));
  expect(await response.json()).toMatchObject({ state: "NOT_CONFIGURED", code: "not_configured" }); expect(fetcher).not.toHaveBeenCalled(); expect(existsSync(join(folder, "provider-evidence.sqlite"))).toBe(false);
  const read = await (await evidenceGet(request(`/api/v3/intelligence/evidence?roomId=${cfg.roomId}&sessionId=${real.id}`, viewer))).json();
  expect(read.status.state).toBe("NOT_CONFIGURED"); expect(read.snapshot).toBeNull();
  expect((await refreshRoute(request("/api/v3/intelligence/refresh", op, { ...bodyFor(), sessionId: real.id, session: real }))).status).toBe(400);
});
test("eligible lifecycle and revision checks reject before upstream; product mapping needs stable identities", async () => {
  const body = bodyFor();
  expect((await refreshRoute(request("/api/v3/intelligence/refresh", op, { ...body, expectedSessionRevision: 999 }))).status).toBe(409);
  expect((await refreshRoute(request("/api/v3/intelligence/refresh", op, { ...body, session: { ...body.session, lifecycle: "active" } }))).status).toBe(409);
  expect((await refreshRoute(request("/api/v3/intelligence/refresh", op, { ...body, productMappings: [{ liveLiftProductId: "unknown", providerProductId: "1" }] }))).status).toBe(400);
  expect((await refreshRoute(request("/api/v3/intelligence/refresh", op, { ...body, productMappings: [...body.productMappings, ...body.productMappings] }))).status).toBe(400);
});
test("provider failures are normalized and do not replace previously fetched evidence", async () => {
  const body = bodyFor(); const first = await (await refreshRoute(request("/api/v3/intelligence/refresh", op, body))).json();
  const limited = await refreshRoute(request("/api/v3/intelligence/refresh", op, { ...body, commandId: randomUUID(), fixtureCase: "rate_limit" }));
  expect(await limited.json()).toMatchObject({ state: "RATE_LIMITED", code: "rate_limited" }); expect(limited.headers.get("retry-after")).toBe("60");
  const read = await (await evidencePost(request("/api/v3/intelligence/evidence", op, readBody(body.session)))).json(); expect(read.snapshot.snapshotId).toBe(first.snapshot.snapshotId); expect(read.status.state).toBe("RATE_LIMITED");
});
test("later snapshots are excluded from as-known-then even when fetchedAt is inside requested historical range", async () => {
  const body = bodyFor(); await refreshRoute(request("/api/v3/intelligence/refresh", op, body));
  const response = await evidencePost(request("/api/v3/intelligence/evidence", op, readBody(body.session, { perspective: "as_known_then", asOfMs: FIXTURE_START + 30_000 })));
  const replay = await response.json(); expect(replay.perspective).toBe("as_known_then"); expect(replay.providerEvidence).toEqual([]); expect(replay.snapshot).toBeUndefined();
  expect(replay.runtime.endedAtMs).toBeNull();
});
test("append-only store rejects mutation, wrong workspace/room/generation, unsafe modes and symlinks", () => {
  const path = join(folder, "separate.sqlite"); const identity = { workspaceId: cfg.workspaceId, generation: randomUUID(), roomId: cfg.roomId };
  const store = new EvidenceStore(path, identity); const scope = { ...identity, sessionId: "sim-v7", mode: "SIMULATED" as const };
  try {
    expect(() => store.db.exec("DELETE FROM evidence_meta")).toThrow("immutable");
    expect(() => store.latest({ ...scope, generation: randomUUID() })).toThrow();
    expect(() => store.latest({ ...scope, workspaceId: randomUUID() })).toThrow();
    const command = randomUUID(); store.claim(scope, command, "op", "hash", Date.now());
    expect(store.claim(scope, command, "op", "hash", Date.now()).result).toEqual({ state: "UNAVAILABLE", code: "outcome_unknown" });
  } finally { store.close(); }
  expect(() => new EvidenceStore(path, { ...identity, roomId: "other" })).toThrow("identity mismatch");
  const link = join(folder, "link.sqlite"); symlinkSync(path, link); expect(() => new EvidenceStore(link, identity)).toThrow("Unsafe");
  chmodSync(path, 0o644); expect(() => new EvidenceStore(path, identity)).toThrow("Unsafe");
});
test("genuine Creator telemetry is visible historically only after storage during LIVE", () => {
  const path = join(folder, "creator.sqlite"), identity = { workspaceId: cfg.workspaceId, roomId: cfg.roomId, generation: randomUUID() };
  const store = new EvidenceStore(path, identity), scope = { ...identity, sessionId: "real", mode: "REAL" as const }, id = randomUUID();
  try {
    store.claim(scope, id, "op", "intent", FIXTURE_START);
    store.finish(scope, id, { state: "AVAILABLE", telemetry: { telemetryId: randomUUID(), sessionId: "real", mode: "REAL", providerSessionId: "123", observedAt: FIXTURE_START + 20_000, recordedAt: FIXTURE_START + 30_000,
      metrics: [{ key: "current_visitor_count", value: 123, availability: "available", unit: "count", observedAt: FIXTURE_START + 20_000, source: "tiktok_creator", evidenceTier: "provider_observed" }] } });
    expect(store.knownTelemetry(scope, FIXTURE_START + 25_000)).toEqual([]); expect(store.knownTelemetry(scope, FIXTURE_START + 30_000)).toHaveLength(1);
  } finally { store.close(); }
});
test("snapshot versions remain auditable and cannot be read from a restored generation", () => {
  const path = join(folder, "versioned.sqlite"), identity = { workspaceId: cfg.workspaceId, roomId: cfg.roomId, generation: randomUUID() };
  let store = new EvidenceStore(path, identity); const session = providerFixtureSession(); const scope = { ...identity, sessionId: session.id, mode: "SIMULATED" as const };
  const snapshot = reconcileLiveEvidence(session, fixtureEvidence(session, FIXTURE_START + 500_000), { snapshotId: randomUUID(), providerSessionId: "123", fetchedAt: FIXTURE_START + 500_000, productMappings: [] });
  const command = randomUUID(); store.claim(scope, command, "op", "intent", Date.now()); store.finish(scope, command, { state: "AVAILABLE", snapshot }); store.close();
  store = new EvidenceStore(path, { ...identity, generation: randomUUID() });
  try { expect(store.latest({ ...scope, generation: store.identity.generation })).toBeNull(); expect(store.db.prepare("SELECT count(*) AS n FROM snapshots").get()!.n).toBe(1); } finally { store.close(); }
});

function configureReal() {
  vi.stubEnv(ENV.mode, "real");
  for (const name of [ENV.appKey, ENV.appSecret, ENV.accessToken, ENV.shopCipher]) vi.stubEnv(name, randomUUID());
}
function mockRealEvidence() {
  const payload = officialFixturePayloads(FIXTURE_START, FIXTURE_START + 120_000);
  const parsed = parseMinutePage(payload.minutes, Date.now(), "tiktok_shop", "half_open");
  vi.spyOn(TikTokShopProvider.prototype, "getMinuteEvidence").mockResolvedValue({ minuteBuckets: parsed.buckets, providerWindow: parsed.window });
  vi.spyOn(TikTokShopProvider.prototype, "getProductPerformance").mockResolvedValue(parseProducts(payload.products, Date.now(), "tiktok_shop"));
}
test("REAL adapter observations persist with provenance; subsequent auth expiration never falls back", async () => {
  configureReal(); mockRealEvidence(); const real = await insertReal();
  const body = { commandId: randomUUID(), roomId: cfg.roomId, sessionId: real.id, providerSessionId: "123", expectedSessionRevision: real.revision };
  const first = await (await refreshRoute(request("/api/v3/intelligence/refresh", op, body))).json();
  expect(first).toMatchObject({ state: "AVAILABLE", snapshot: { mode: "REAL", provider: "tiktok_shop" } });
  expect(first.snapshot.minuteBuckets.every((b: { source: string }) => b.source === "tiktok_shop")).toBe(true);
  vi.mocked(TikTokShopProvider.prototype.getMinuteEvidence).mockImplementation(async () => fail("auth_expired"));
  const expired = await (await refreshRoute(request("/api/v3/intelligence/refresh", op, { ...body, commandId: randomUUID() }))).json();
  expect(expired).toMatchObject({ state: "AUTH_EXPIRED", code: "auth_expired" }); expect(expired.snapshot).toBeUndefined();
  const read = await (await evidenceGet(request(`/api/v3/intelligence/evidence?roomId=${cfg.roomId}&sessionId=${real.id}`, viewer))).json();
  expect(read.snapshot.snapshotId).toBe(first.snapshot.snapshotId); expect(read.status.state).toBe("AUTH_EXPIRED");
  expect((await getRuntime()).authority.db.prepare("SELECT state_json FROM sessions WHERE id=?").get(real.id)!.state_json).toBe(JSON.stringify(real));
});
test("a show revision changed during a slow REAL fetch prevents snapshot commit", async () => {
  configureReal(); mockRealEvidence(); const real = await insertReal(); const rt = await getRuntime();
  const evidence = await TikTokShopProvider.prototype.getMinuteEvidence("123", Date.now());
  vi.mocked(TikTokShopProvider.prototype.getMinuteEvidence).mockImplementation(async () => {
    rt.authority.db.prepare("UPDATE sessions SET state_json=? WHERE id=?").run(JSON.stringify({ ...real, revision: real.revision + 1 }), real.id); return evidence;
  });
  const response = await refreshRoute(request("/api/v3/intelligence/refresh", op, { commandId: randomUUID(), roomId: cfg.roomId, sessionId: real.id, expectedSessionRevision: real.revision, providerSessionId: "123" }));
  expect(response.status).toBe(409);
  const store = new EvidenceStore(join(folder, "provider-evidence.sqlite"), deployment(rt.authority.db));
  try { expect(store.db.prepare("SELECT count(*) AS n FROM snapshots").get()!.n).toBe(0); } finally { store.close(); }
});
test("explicit administrator workspace deletion erases its separate provider evidence", async () => {
  await refreshRoute(request("/api/v3/intelligence/refresh", op, bodyFor()));
  const path = join(folder, "provider-evidence.sqlite"); expect(existsSync(path)).toBe(true);
  await closeRuntime(); deleteWorkspace(cfg, cfg.workspaceId, false);
  expect(existsSync(path)).toBe(false); expect(existsSync(cfg.dbPath)).toBe(false);
});
