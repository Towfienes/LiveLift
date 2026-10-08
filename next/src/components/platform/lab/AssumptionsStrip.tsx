"use client";

import React from "react";
import type { LabCommand, ShopeeFault, SimAssumptions } from "@/lib/platform";
import type { LabWords } from "./labCopy";

/**
 * The questions Shopee's documentation does not answer, as switches, always on screen. The simulation answers them
 * by assumption only; flipping one shows how LiveLift copes either way.
 */
export function AssumptionsStrip({
  assumptions,
  fault,
  words,
  presenter,
  act,
}: {
  assumptions: SimAssumptions;
  fault: ShopeeFault | null;
  words: LabWords;
  presenter: boolean;
  act: (cmds: LabCommand[]) => void;
}): React.ReactElement {
  const w = words.assumptions;
  const text = presenter ? "text-[17px]" : "text-[15px]";
  return (
    <section aria-label={w.title} data-testid="assumptions" className={`shrink-0 rounded-[10px] border border-[#4A3D22] bg-[#17140E] px-3 py-1 flex flex-wrap items-center gap-x-5 gap-y-0 ${text}`}>
      <h2 className="font-medium text-[#F6C875] inline-flex items-center gap-1.5">
        <i className="ri-question-line" aria-hidden="true" />
        {w.title}
        <span className="font-normal text-[#F6C875]">· {w.caveat}</span>
      </h2>
      <label className="inline-flex items-center gap-2 min-h-[44px] text-[#F5F7FC] cursor-pointer">
        <input
          type="checkbox"
          checked={assumptions.appLiveControllable}
          onChange={(e) => act([{ kind: "assume", patch: { appLiveControllable: e.target.checked } }])}
          className="w-5 h-5 accent-[#DFFF00]"
          data-testid="lab-assume-a1"
        />
        {w.a1}
      </label>
      <label className="inline-flex items-center gap-2 min-h-[44px] text-[#F5F7FC] cursor-pointer">
        <input
          type="checkbox"
          checked={assumptions.detailExposesShowingItem}
          onChange={(e) => act([{ kind: "assume", patch: { detailExposesShowingItem: e.target.checked } }])}
          className="w-5 h-5 accent-[#DFFF00]"
          data-testid="lab-assume-a2"
        />
        {w.a2}
      </label>
      {!presenter && (
        <label className="inline-flex items-center gap-2 min-h-[44px] text-[#CAD0DA]">
          {w.condition}
          <select
            value={fault ?? "none"}
            onChange={(e) => act([{ kind: "fault", fault: e.target.value === "none" ? null : (e.target.value as ShopeeFault) }])}
            className="min-h-[36px] rounded-[8px] bg-[#13161C] border border-[#2C3340] px-2 text-[15px] text-[#F5F7FC]"
            data-testid="lab-fault"
          >
            {(Object.keys(words.faults) as Array<ShopeeFault | "none">).map((k) => (
              <option key={k} value={k}>{words.faults[k]}</option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
