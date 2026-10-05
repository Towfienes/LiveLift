import {
  RuntimeSnapshot,
  SessionIdentity,
  RunOfShowSegment,
  ProductSnapshot,
  ReplayEvent,
  LearningObject,
  NextLiveChange,
  MetricWindow,
  ReplayGap,
} from "@/contracts";
import {
  FIXTURE_ACTIVE_SNAPSHOT,
  FIXTURE_ACTIVE_SESSION,
  FIXTURE_PREPARED_SESSION,
  FIXTURE_SIMULATED_SESSION,
  FIXTURE_ENDED_SESSION,
  FIXTURE_PRODUCTS,
  FIXTURE_SEGMENTS,
  FIXTURE_CAPABILITIES,
  FIXTURE_REPLAY_EVENTS,
  FIXTURE_REPLAY_GAPS,
  FIXTURE_METRIC_WINDOWS,
  FIXTURE_LEARNING_OBJECTS,
  FIXTURE_NEXT_LIVE_CHANGES,
} from "@/fixtures/sessions";

class SimulatorEngine {
  private sessions: Map<string, SessionIdentity> = new Map();
  private snapshots: Map<string, RuntimeSnapshot> = new Map();
  private replayEvents: Map<string, ReplayEvent[]> = new Map();
  private replayGaps: Map<string, ReplayGap[]> = new Map();
  private metricWindows: Map<string, MetricWindow[]> = new Map();
  private learningObjects: Map<string, LearningObject[]> = new Map();
  private nextLiveChanges: Map<string, NextLiveChange[]> = new Map();

  constructor() {
    this.reset();
  }

  public reset() {
    this.sessions.clear();
    this.snapshots.clear();
    this.replayEvents.clear();
    this.replayGaps.clear();
    this.metricWindows.clear();
    this.learningObjects.clear();
    this.nextLiveChanges.clear();

    // Seed Active Session
    this.sessions.set(FIXTURE_ACTIVE_SESSION.id, { ...FIXTURE_ACTIVE_SESSION });
    this.snapshots.set(FIXTURE_ACTIVE_SESSION.id, JSON.parse(JSON.stringify(FIXTURE_ACTIVE_SNAPSHOT)));

    // Seed Prepared Session
    this.sessions.set(FIXTURE_PREPARED_SESSION.id, { ...FIXTURE_PREPARED_SESSION });
    this.snapshots.set(FIXTURE_PREPARED_SESSION.id, {
      session: { ...FIXTURE_PREPARED_SESSION },
      currentSegment: null,
      presentingProduct: null,
      pinnedProduct: null,
      pinnedVerification: "unknown",
      activeRecommendation: null,
      segments: JSON.parse(JSON.stringify(FIXTURE_SEGMENTS)),
      products: JSON.parse(JSON.stringify(FIXTURE_PRODUCTS)),
      capabilities: { ...FIXTURE_CAPABILITIES },
      isHeld: false,
    });

    // Seed Simulated Rehearsal
    this.sessions.set(FIXTURE_SIMULATED_SESSION.id, { ...FIXTURE_SIMULATED_SESSION });
    this.snapshots.set(FIXTURE_SIMULATED_SESSION.id, {
      session: { ...FIXTURE_SIMULATED_SESSION },
      currentSegment: null,
      presentingProduct: null,
      pinnedProduct: null,
      pinnedVerification: "unknown",
      activeRecommendation: null,
      segments: JSON.parse(JSON.stringify(FIXTURE_SEGMENTS)),
      products: JSON.parse(JSON.stringify(FIXTURE_PRODUCTS)),
      capabilities: { ...FIXTURE_CAPABILITIES },
      isHeld: false,
    });

    // Seed Ended Session with Replay
    this.sessions.set(FIXTURE_ENDED_SESSION.id, { ...FIXTURE_ENDED_SESSION });
    this.snapshots.set(FIXTURE_ENDED_SESSION.id, {
      session: { ...FIXTURE_ENDED_SESSION },
      currentSegment: null,
      presentingProduct: null,
      pinnedProduct: null,
      pinnedVerification: "unknown",
      activeRecommendation: null,
      segments: JSON.parse(JSON.stringify(FIXTURE_SEGMENTS)),
      products: JSON.parse(JSON.stringify(FIXTURE_PRODUCTS)),
      capabilities: { ...FIXTURE_CAPABILITIES },
      isHeld: false,
    });

    this.replayEvents.set(FIXTURE_ENDED_SESSION.id, JSON.parse(JSON.stringify(FIXTURE_REPLAY_EVENTS)));
    this.replayGaps.set(FIXTURE_ENDED_SESSION.id, JSON.parse(JSON.stringify(FIXTURE_REPLAY_GAPS)));
    this.metricWindows.set(FIXTURE_ENDED_SESSION.id, JSON.parse(JSON.stringify(FIXTURE_METRIC_WINDOWS)));
    this.learningObjects.set(FIXTURE_ENDED_SESSION.id, JSON.parse(JSON.stringify(FIXTURE_LEARNING_OBJECTS)));
    this.nextLiveChanges.set(FIXTURE_ENDED_SESSION.id, JSON.parse(JSON.stringify(FIXTURE_NEXT_LIVE_CHANGES)));
  }

  public listSessions(): SessionIdentity[] {
    return Array.from(this.sessions.values());
  }

  public getSession(id: string): SessionIdentity | null {
    return this.sessions.get(id) || null;
  }

  public getSnapshot(sessionId: string): RuntimeSnapshot | null {
    return this.snapshots.get(sessionId) || null;
  }

  public createSession(data: {
    title: string;
    scheduledAt?: string | null;
    timezone?: string;
    objective?: string | null;
    accountAssociation?: string | null;
    environment: "REAL" | "SIMULATED";
    startingPoint?: "blank" | "saved_pack" | "clone";
    sourceSessionId?: string;
  }): SessionIdentity {
    const id = `session_${Date.now()}`;
    const newSession: SessionIdentity = {
      id,
      title: data.title,
      scheduledAt: data.scheduledAt || null,
      actualStartedAt: null,
      actualEndedAt: null,
      timezone: data.timezone || "Asia/Ho_Chi_Minh",
      objective: data.objective || null,
      accountAssociation: data.accountAssociation || null,
      environment: data.environment,
      lifecycle: "planned",
      revision: 1,
      currentSegmentId: null,
      leadOperator: {
        id: "op_linh",
        name: "Linh",
        role: "lead",
        isLead: true,
      },
      trackedDurationSeconds: 0,
    };

    let initialProducts: ProductSnapshot[] = [];
    let initialSegments: RunOfShowSegment[] = [];

    if (data.startingPoint === "saved_pack") {
      initialProducts = JSON.parse(JSON.stringify(FIXTURE_PRODUCTS));
    } else if (data.startingPoint === "clone" && data.sourceSessionId) {
      const srcSnapshot = this.snapshots.get(data.sourceSessionId);
      if (srcSnapshot) {
        initialProducts = JSON.parse(JSON.stringify(srcSnapshot.products));
        initialSegments = srcSnapshot.segments.map((seg, idx) => ({
          ...seg,
          id: `seg_${id}_${idx + 1}`,
          state: "pending",
          actualStartedAt: null,
          actualEndedAt: null,
        }));
      }
    } else if (data.startingPoint !== "blank") {
      initialProducts = JSON.parse(JSON.stringify(FIXTURE_PRODUCTS));
      initialSegments = JSON.parse(JSON.stringify(FIXTURE_SEGMENTS)).map((s: RunOfShowSegment) => ({
        ...s,
        state: "pending",
        actualStartedAt: null,
        actualEndedAt: null,
      }));
    }

    this.sessions.set(id, newSession);
    this.snapshots.set(id, {
      session: newSession,
      currentSegment: null,
      presentingProduct: null,
      pinnedProduct: null,
      pinnedVerification: "unknown",
      activeRecommendation: null,
      segments: initialSegments,
      products: initialProducts,
      capabilities: { ...FIXTURE_CAPABILITIES },
      isHeld: false,
    });

    return newSession;
  }

  public updateProducts(sessionId: string, products: ProductSnapshot[]): boolean {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot) return false;
    snapshot.products = products;
    const session = this.sessions.get(sessionId);
    if (session) session.revision += 1;
    return true;
  }

  public updateSegments(sessionId: string, segments: RunOfShowSegment[]): boolean {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot) return false;
    snapshot.segments = segments;
    const session = this.sessions.get(sessionId);
    if (session) session.revision += 1;
    return true;
  }

  public startLive(sessionId: string): RuntimeSnapshot | null {
    const snapshot = this.snapshots.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (!snapshot || !session) return null;

    session.lifecycle = "active";
    session.actualStartedAt = new Date().toISOString();
    session.revision += 1;
    snapshot.session.lifecycle = "active";
    snapshot.session.actualStartedAt = session.actualStartedAt;
    snapshot.session.revision = session.revision;

    // Start first segment if available
    if (snapshot.segments.length > 0) {
      snapshot.segments[0].state = "current";
      snapshot.segments[0].actualStartedAt = session.actualStartedAt;
      snapshot.currentSegment = snapshot.segments[0];
      session.currentSegmentId = snapshot.segments[0].id;

      if (snapshot.segments[0].leadProductId) {
        const prod = snapshot.products.find(p => p.id === snapshot.segments[0].leadProductId);
        if (prod) {
          snapshot.presentingProduct = prod;
          snapshot.presentingReportedBy = session.leadOperator.name;
          snapshot.presentingReportedAt = "00:00:00";
        }
      }
    }

    // Set next recommendation if there is a 2nd segment
    if (snapshot.segments.length > 1) {
      const nextSeg = snapshot.segments[1];
      const prod = nextSeg.leadProductId ? snapshot.products.find(p => p.id === nextSeg.leadProductId) : null;
      snapshot.activeRecommendation = {
        id: `rec_${nextSeg.id}`,
        sessionId,
        targetSegmentId: nextSeg.id,
        targetProductId: prod?.id || null,
        targetName: prod?.name || nextSeg.title,
        proposedAction: `Present ${prod?.name || nextSeg.title}`,
        rationale: [
          { text: "Next scheduled in Run of Show", source: "Plan baseline", isFresh: true },
          { text: "Not yet presented in this session", source: "Coverage ledger", isFresh: true },
        ],
        constraintsStatus: "Constraints clear",
        decision: "proposed",
        executionState: "not_attempted",
        evidenceClass: "unknown",
        isPulledForward: false,
      };
    }

    return snapshot;
  }

  public acceptRecommendation(sessionId: string, _recommendationId: string): RuntimeSnapshot | null {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot || !snapshot.activeRecommendation) return null;

    // Acceptance does NOT change current segment or presenting product!
    snapshot.activeRecommendation.decision = "accepted";
    snapshot.activeRecommendation.decisionActor = snapshot.session.leadOperator.name;
    snapshot.activeRecommendation.decisionAt = new Date().toISOString();

    snapshot.lastCommandResult = {
      id: `cmd_${Date.now()}`,
      intent: "accept_recommendation",
      status: "acknowledged",
      message: `Accepted ${snapshot.activeRecommendation.targetName}. Ready to start when operator chooses.`,
      timestamp: new Date().toISOString(),
    };

    return snapshot;
  }

  public rejectRecommendation(sessionId: string, _recommendationId: string, reason?: string): RuntimeSnapshot | null {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot || !snapshot.activeRecommendation) return null;

    snapshot.activeRecommendation.decision = "rejected";
    snapshot.activeRecommendation.decisionActor = snapshot.session.leadOperator.name;
    snapshot.activeRecommendation.decisionAt = new Date().toISOString();
    snapshot.activeRecommendation.decisionReason = reason || "Operator rejected proposal";

    snapshot.lastCommandResult = {
      id: `cmd_${Date.now()}`,
      intent: "reject_recommendation",
      status: "acknowledged",
      message: `Proposal rejected. Planned rundown remains in order.`,
      timestamp: new Date().toISOString(),
    };

    return snapshot;
  }

  public startSegment(sessionId: string, segmentId: string): RuntimeSnapshot | null {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot) return null;

    const targetIdx = snapshot.segments.findIndex(s => s.id === segmentId);
    if (targetIdx === -1) return null;

    // Complete current segment
    if (snapshot.currentSegment) {
      const curIdx = snapshot.segments.findIndex(s => s.id === snapshot.currentSegment?.id);
      if (curIdx !== -1) {
        snapshot.segments[curIdx].state = "completed";
        snapshot.segments[curIdx].actualEndedAt = new Date().toISOString();
      }
    }

    // Set new current segment
    const targetSegment = snapshot.segments[targetIdx];
    targetSegment.state = "current";
    targetSegment.actualStartedAt = new Date().toISOString();
    snapshot.currentSegment = targetSegment;
    snapshot.session.currentSegmentId = targetSegment.id;

    // Link lead product to presenting product
    if (targetSegment.leadProductId) {
      const prod = snapshot.products.find(p => p.id === targetSegment.leadProductId);
      if (prod) {
        snapshot.presentingProduct = prod;
        snapshot.presentingReportedBy = snapshot.session.leadOperator.name;
        snapshot.presentingReportedAt = new Date().toLocaleTimeString("vi-VN");
      }
    } else {
      snapshot.presentingProduct = null;
    }

    // Propose subsequent pending segment as NEXT
    const nextPending = snapshot.segments.slice(targetIdx + 1).find(s => s.state === "pending");
    if (nextPending) {
      const prod = nextPending.leadProductId ? snapshot.products.find(p => p.id === nextPending.leadProductId) : null;
      snapshot.activeRecommendation = {
        id: `rec_${nextPending.id}`,
        sessionId,
        targetSegmentId: nextPending.id,
        targetProductId: prod?.id || null,
        targetName: prod?.name || nextPending.title,
        proposedAction: `Present ${prod?.name || nextPending.title}`,
        rationale: [
          { text: "Next eligible item in Run of Show", source: "Plan revision", isFresh: true },
          { text: "No presentation recorded yet", source: "Product coverage", isFresh: true },
        ],
        constraintsStatus: "Constraints clear",
        decision: "proposed",
        executionState: "not_attempted",
        evidenceClass: "unknown",
        isPulledForward: false,
      };
    } else {
      snapshot.activeRecommendation = null;
    }

    snapshot.lastCommandResult = {
      id: `cmd_${Date.now()}`,
      intent: "start_segment",
      status: "acknowledged",
      message: `Started segment: ${targetSegment.title}`,
      timestamp: new Date().toISOString(),
    };

    return snapshot;
  }

  public skipSegment(sessionId: string, segmentId: string): RuntimeSnapshot | null {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot) return null;

    const seg = snapshot.segments.find(s => s.id === segmentId);
    if (seg) {
      seg.state = "skipped";
    }

    snapshot.lastCommandResult = {
      id: `cmd_${Date.now()}`,
      intent: "skip_segment",
      status: "acknowledged",
      message: `Skipped segment: ${seg?.title}`,
      timestamp: new Date().toISOString(),
    };

    return snapshot;
  }

  public extendDuration(sessionId: string, minutes = 1): RuntimeSnapshot | null {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot || !snapshot.currentSegment) return null;

    snapshot.currentSegment.targetDurationMinutes += minutes;

    snapshot.lastCommandResult = {
      id: `cmd_${Date.now()}`,
      intent: "extend_duration",
      status: "acknowledged",
      message: `Extended ${snapshot.currentSegment.title} target by +${minutes}m`,
      timestamp: new Date().toISOString(),
    };

    return snapshot;
  }

  public holdProposal(sessionId: string): RuntimeSnapshot | null {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot) return null;

    snapshot.isHeld = !snapshot.isHeld;

    snapshot.lastCommandResult = {
      id: `cmd_${Date.now()}`,
      intent: snapshot.isHeld ? "hold_proposal" : "resume_proposal",
      status: "acknowledged",
      message: snapshot.isHeld ? "NEXT proposal held. Elapsed time continues." : "NEXT proposal resumed.",
      timestamp: new Date().toISOString(),
    };

    return snapshot;
  }

  public reportPresentation(sessionId: string, productId: string): RuntimeSnapshot | null {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot) return null;

    const prod = snapshot.products.find(p => p.id === productId);
    if (!prod) return null;

    snapshot.presentingProduct = prod;
    snapshot.presentingReportedBy = snapshot.session.leadOperator.name;
    snapshot.presentingReportedAt = new Date().toLocaleTimeString("vi-VN");

    snapshot.lastCommandResult = {
      id: `cmd_${Date.now()}`,
      intent: "report_presentation",
      status: "acknowledged",
      message: `Recorded presentation report for ${prod.name} (${prod.code}).`,
      timestamp: new Date().toISOString(),
    };

    return snapshot;
  }

  public reportPlatformAction(
    sessionId: string,
    productId: string,
    action: string,
    type: "attempt" | "performed"
  ): RuntimeSnapshot | null {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot) return null;

    const prod = snapshot.products.find(p => p.id === productId);
    if (!prod) return null;

    if (action.includes("pin")) {
      snapshot.pinnedProduct = prod;
      snapshot.pinnedReportedBy = snapshot.session.leadOperator.name;
      snapshot.pinnedReportedAt = new Date().toLocaleTimeString("vi-VN");
      // CRITICAL: Verification remains unknown unless confirmed by platform!
      snapshot.pinnedVerification = "unknown";
    }

    snapshot.lastCommandResult = {
      id: `cmd_${Date.now()}`,
      intent: "report_action",
      status: "acknowledged",
      message: `Logged ${type === "attempt" ? "attempt" : "operator report"} for ${prod.code}: ${action}. Platform verification remains Unknown.`,
      timestamp: new Date().toISOString(),
    };

    return snapshot;
  }

  public endLive(sessionId: string): RuntimeSnapshot | null {
    const snapshot = this.snapshots.get(sessionId);
    const session = this.sessions.get(sessionId);
    if (!snapshot || !session) return null;

    session.lifecycle = "ended";
    session.actualEndedAt = new Date().toISOString();
    snapshot.session.lifecycle = "ended";
    snapshot.session.actualEndedAt = session.actualEndedAt;
    if (snapshot.currentSegment) {
      snapshot.currentSegment.state = "completed";
      snapshot.currentSegment.actualEndedAt = session.actualEndedAt;
    }

    snapshot.lastCommandResult = {
      id: `cmd_${Date.now()}`,
      intent: "end_live",
      status: "acknowledged",
      message: `LiveLift tracking ended. Total duration frozen.`,
      timestamp: new Date().toISOString(),
    };

    return snapshot;
  }

  public getReplay(sessionId: string) {
    return {
      events: this.replayEvents.get(sessionId) || FIXTURE_REPLAY_EVENTS,
      gaps: this.replayGaps.get(sessionId) || FIXTURE_REPLAY_GAPS,
      metrics: this.metricWindows.get(sessionId) || FIXTURE_METRIC_WINDOWS,
    };
  }

  public getLearning(sessionId: string) {
    return {
      learningObjects: this.learningObjects.get(sessionId) || FIXTURE_LEARNING_OBJECTS,
      nextLiveChanges: this.nextLiveChanges.get(sessionId) || FIXTURE_NEXT_LIVE_CHANGES,
    };
  }

  public addLearningObject(sessionId: string, obj: Omit<LearningObject, "id" | "sessionId">) {
    const list = this.learningObjects.get(sessionId) || [...FIXTURE_LEARNING_OBJECTS];
    const newObj: LearningObject = {
      ...obj,
      id: `learn_${Date.now()}`,
      sessionId,
    };
    list.push(newObj);
    this.learningObjects.set(sessionId, list);
    return newObj;
  }

  public toggleNextLiveChange(sessionId: string, changeId: string): boolean {
    const list = this.nextLiveChanges.get(sessionId) || [...FIXTURE_NEXT_LIVE_CHANGES];
    const item = list.find(c => c.id === changeId);
    if (item) {
      item.isSelected = !item.isSelected;
      this.nextLiveChanges.set(sessionId, list);
      return true;
    }
    return false;
  }
}

export const simulator = new SimulatorEngine();
