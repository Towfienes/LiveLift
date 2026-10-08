"use client";

import type React from "react";
import { useState } from "react";
import type { Session } from "@/contracts";
import { SCENARIO_BY_ID, effectiveNowMs, type CommandBody, type ScenarioId } from "@/lib/domain";
import type { SimulatorStrip } from "@/components/ops/SimulatorStrip";

export type ClockCommand = Extract<CommandBody, { type: "advance_clock" | "set_clock" }>;

/**
 * The rehearsal clock controls, shared by the Operate desk and the Platform Lab: the virtual clock, +30s/+1m/+5m, "To
 * anchor", and (where the desk offers it) the scenario script. Each desk runs the commands its own way; this hook only
 * says which command each control sends, so both desks behave the same.
 */
export function useSimulatorControls({
  session,
  nowMs,
  nextAnchorMs,
  run,
  script,
}: {
  session: Session;
  nowMs: number;
  /** The next hard anchor's committed time, from the desk's own forecast. */
  nextAnchorMs: number | null;
  run: (body: ClockCommand) => void;
  /** The scenario script's Apply/Skip, when the desk offers them. Each reports back through `say`. */
  script?: { apply: (say: (message: string | null) => void) => void; skip: (say: (message: string | null) => void) => void };
}): { virtualNowMs: number; strip: React.ComponentProps<typeof SimulatorStrip> } {
  const [message, setMessage] = useState<string | null>(null);
  const scenario = script && session.scenarioId ? SCENARIO_BY_ID[session.scenarioId as ScenarioId] : undefined;
  const stepDef = scenario?.script[session.scriptCursor];
  const virtualNowMs = effectiveNowMs(session, nowMs);
  return {
    virtualNowMs,
    strip: {
      virtualNowMs,
      tz: session.timezone,
      nextAnchorMs,
      scripted: Boolean(scenario),
      step: scenario && stepDef ? { index: session.scriptCursor, total: scenario.script.length, label: stepDef.label } : null,
      onAdvance: (sec) => run({ type: "advance_clock", byMs: sec * 1000 }),
      onToAnchor: () => {
        if (nextAnchorMs !== null) run({ type: "set_clock", toMs: nextAnchorMs - 60_000 });
      },
      onApplyStep: () => script?.apply(setMessage),
      onSkipStep: () => script?.skip(setMessage),
      message,
    },
  };
}
