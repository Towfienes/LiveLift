"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { StandardShell, SessionContextBar } from "@/components/shell";
import {
  StatusLabel,
  Button,
  Dialog,
} from "@/components/ui";
import {
  RuntimeSnapshot,
  ProductSnapshot,
  RunOfShowSegment,
} from "@/contracts";
import { simulator } from "@/lib/simulator/simulatorEngine";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function PreparePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductSnapshot | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [isAddSegmentOpen, setIsAddSegmentOpen] = useState(false);
  const [newSegTitle, setNewSegTitle] = useState("");
  const [newSegDuration, setNewSegDuration] = useState("5");
  const [newSegCue, setNewSegCue] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving">("saved");

  useEffect(() => {
    let snap = simulator.getSnapshot(sessionId);
    if (!snap) {
      // If session doesn't exist, create default
      snap = simulator.getSnapshot("session_weekend_essentials");
    }
    setSnapshot(snap);
  }, [sessionId]);

  if (!snapshot) {
    return (
      <StandardShell>
        <div className="flex-1 flex items-center justify-center p-12">
          <p className="text-[18px] text-[#8A95A5]">Loading preparation workspace...</p>
        </div>
      </StandardShell>
    );
  }

  const { session, products, segments, capabilities } = snapshot;

  const handleStartLive = () => {
    setSaveStatus("saving");
    const activeSnapshot = simulator.startLive(session.id);
    if (activeSnapshot) {
      router.push(`/live/${session.id}/operate`);
    }
  };

  const handleToggleProductStatus = (productId: string) => {
    const updated = products.map((p) => {
      if (p.id === productId) {
        return {
          ...p,
          status: p.status === "enabled" ? ("disabled" as const) : ("enabled" as const),
        };
      }
      return p;
    });
    simulator.updateProducts(session.id, updated);
    setSnapshot({ ...snapshot, products: updated });
  };

  const handleTogglePriority = (productId: string) => {
    const updated = products.map((p) => {
      if (p.id === productId) {
        return {
          ...p,
          priority: p.priority === "high" ? ("normal" as const) : ("high" as const),
        };
      }
      return p;
    });
    simulator.updateProducts(session.id, updated);
    setSnapshot({ ...snapshot, products: updated });
  };

  const handleAddSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSegTitle.trim()) return;

    const newSeg: RunOfShowSegment = {
      id: `seg_${Date.now()}`,
      order: segments.length + 1,
      plannedOffsetMinutes: segments.reduce((acc, s) => acc + s.plannedDurationMinutes, 0),
      title: newSegTitle.trim(),
      segmentType: "product",
      plannedDurationMinutes: parseInt(newSegDuration, 10) || 5,
      targetDurationMinutes: parseInt(newSegDuration, 10) || 5,
      cue: newSegCue.trim() || undefined,
      linkedProductIds: [],
      state: "pending",
    };

    const updated = [...segments, newSeg];
    simulator.updateSegments(session.id, updated);
    setSnapshot({ ...snapshot, segments: updated });
    setIsAddSegmentOpen(false);
    setNewSegTitle("");
    setNewSegCue("");
  };

  const handleMoveSegment = (index: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= segments.length) return;

    const list = [...segments];
    const [moved] = list.splice(index, 1);
    list.splice(newIdx, 0, moved);

    // Recalculate orders and offsets
    let offset = 0;
    const reordered = list.map((item, idx) => {
      const res = {
        ...item,
        order: idx + 1,
        plannedOffsetMinutes: offset,
      };
      offset += item.plannedDurationMinutes;
      return res;
    });

    simulator.updateSegments(session.id, reordered);
    setSnapshot({ ...snapshot, segments: reordered });
  };

  const totalPlannedMinutes = segments.reduce((sum, s) => sum + s.plannedDurationMinutes, 0);

  return (
    <StandardShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#090B0F]">
        {/* Session Context Bar */}
        <SessionContextBar
          eyebrow="Prepare"
          title={session.title}
          environment={session.environment}
          metaText={session.scheduledAt ? `${session.scheduledAt} · ${session.timezone}` : "No scheduled time · Asia/Ho_Chi_Minh"}
          rightAction={
            <span className="inline-flex items-center gap-2 text-[15px] text-[#C8CDD6]">
              <i className="ri-save-line" aria-hidden="true" />
              <span>{saveStatus === "saving" ? "Saving..." : "Saved"}</span>
            </span>
          }
        />

        {/* 3-Column Prepare Workspace */}
        <div className="flex-1 min-h-0 p-6 lg:px-8 max-w-[1720px] w-full mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px] gap-5 h-full min-h-0">
            {/* LEFT COLUMN: Product Pack (320px) */}
            <div className="rounded-[12px] bg-[#13161C] border border-[#232935] p-4 flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-3 mb-2 shrink-0">
                <h2 className="text-[20px] font-medium text-[#F5F7FC]">Product Pack</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  icon="ri-add-line"
                  onClick={() => setIsImportOpen(true)}
                >
                  Add
                </Button>
              </div>

              <p className="text-[14px] text-[#AEB7C5] mb-3 shrink-0">
                {products.length} products · Session snapshot
              </p>

              <div className="flex gap-2 mb-3 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="ri-upload-2-line"
                  onClick={() => setIsImportOpen(true)}
                  className="flex-1 text-[14px]"
                >
                  Import
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="ri-book-2-line"
                  className="flex-1 text-[14px]"
                >
                  Library
                </Button>
              </div>

              {/* Product list with scroll */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1" data-testid="prepare-product-list">
                {products.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => setSelectedProduct(prod)}
                    className={`flex gap-3 items-start p-3 rounded-[10px] cursor-pointer transition-colors border ${
                      prod.status === "disabled"
                        ? "bg-[#111317] border-[#1E232B] opacity-60"
                        : "bg-[#181C24] border-[#252C38] hover:bg-[#202632]"
                    }`}
                  >
                    <div className="w-[50px] h-[50px] shrink-0 rounded-[10px] bg-[#2A303B] border border-[#373F4D] flex flex-col items-center justify-center gap-0.5">
                      <span className="text-[20px] font-medium text-[#D2D9E4]">
                        {prod.initials}
                      </span>
                      <span className="text-[11px] font-mono text-[#AFB8C7]">
                        {prod.code}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] font-mono text-[#B7C1CE]">
                          {prod.code}
                        </span>
                        {prod.priority === "high" && (
                          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#DFFF00]">
                            <i className="ri-flag-line" aria-hidden="true" />
                            <span>High</span>
                          </span>
                        )}
                        {prod.status === "disabled" && (
                          <span className="text-[12px] text-[#8A95A5]">Disabled</span>
                        )}
                      </div>

                      <h3 className="text-[17px] font-medium text-[#F5F7FC] truncate">
                        {prod.name}
                      </h3>

                      <p className="text-[14px] text-[#CAD0DA] mt-0.5">
                        {prod.price !== null ? `${prod.currency} ${prod.price}` : "Not entered"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-[#232935] text-[13px] text-[#8A95A5] shrink-0">
                Library origin · As of Oct 2
              </div>
            </div>

            {/* CENTER COLUMN: Dominant Run of Show */}
            <div className="rounded-[12px] bg-[#13161C] border border-[#232935] p-5 flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-4 mb-2 shrink-0">
                <div>
                  <h2 className="text-[24px] font-medium tracking-[-0.6px] text-[#F5F7FC]">
                    Run of Show
                  </h2>
                  <p className="text-[15px] text-[#AEB7C5] mt-0.5">
                    {segments.length} segments · Planned {totalPlannedMinutes} min
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  icon="ri-add-line"
                  onClick={() => setIsAddSegmentOpen(true)}
                  data-testid="add-segment-btn"
                >
                  Add segment
                </Button>
              </div>

              {/* Segment rows with dominant scroll */}
              <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#202632] pr-1" data-testid="prepare-ros-list">
                {segments.map((seg, idx) => {
                  const leadProd = seg.leadProductId
                    ? products.find((p) => p.id === seg.leadProductId)
                    : null;

                  return (
                    <div
                      key={seg.id}
                      className="flex items-center gap-4 py-3.5 px-3 rounded-[8px] hover:bg-[#191D26] transition-colors group"
                    >
                      {/* Placement */}
                      <div className="w-[60px] shrink-0">
                        <span className="text-[14px] font-mono text-[#AEB7C5]">
                          {String(seg.order).padStart(2, "0")}
                        </span>
                        <p className="text-[14px] font-mono text-[#C8CDD6]">
                          00:{String(seg.plannedOffsetMinutes).padStart(2, "0")}
                        </p>
                      </div>

                      {/* Icon or Thumbnail */}
                      <div className="w-[46px] h-[46px] shrink-0 rounded-[8px] bg-[#232935] border border-[#303744] flex items-center justify-center">
                        {leadProd ? (
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-[17px] font-medium text-[#D2D9E4]">
                              {leadProd.initials}
                            </span>
                            <span className="text-[10px] font-mono text-[#AFB8C7]">
                              {leadProd.code}
                            </span>
                          </div>
                        ) : (
                          <i
                            className={`${
                              seg.segmentType === "qa"
                                ? "ri-chat-1-line"
                                : seg.segmentType === "flash_sale"
                                ? "ri-flashlight-line"
                                : "ri-play-list-line"
                            } text-[20px] text-[#B7C1CE]`}
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      {/* Segment Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[19px] font-medium text-[#F5F7FC] truncate">
                            {seg.title}
                          </h3>
                          {leadProd && (
                            <span className="text-[13px] font-mono text-[#B7C1CE]">
                              ({leadProd.code})
                            </span>
                          )}
                        </div>
                        {seg.cue && (
                          <p className="text-[14px] text-[#B7C1CE] mt-0.5 truncate">
                            {seg.cue}
                          </p>
                        )}
                      </div>

                      {/* Reorder controls on hover/focus */}
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
                        <button
                          type="button"
                          aria-label={`Move ${seg.title} up`}
                          disabled={idx === 0}
                          onClick={() => handleMoveSegment(idx, "up")}
                          className="w-8 h-8 rounded bg-[#20252E] hover:bg-[#2B313C] text-[#CAD0DA] inline-flex items-center justify-center disabled:opacity-20 cursor-pointer"
                        >
                          <i className="ri-arrow-up-s-line" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${seg.title} down`}
                          disabled={idx === segments.length - 1}
                          onClick={() => handleMoveSegment(idx, "down")}
                          className="w-8 h-8 rounded bg-[#20252E] hover:bg-[#2B313C] text-[#CAD0DA] inline-flex items-center justify-center disabled:opacity-20 cursor-pointer"
                        >
                          <i className="ri-arrow-down-s-line" aria-hidden="true" />
                        </button>
                      </div>

                      {/* Timing & State */}
                      <div className="text-right space-y-1 shrink-0">
                        <p className="text-[17px] font-medium tabular-nums text-[#F5F7FC]">
                          {seg.plannedDurationMinutes} min
                        </p>
                        <StatusLabel status="planned" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: Readiness & START LIVE (300px) */}
            <div className="rounded-[12px] bg-[#1B1F27] border border-[#2B3240] p-5 flex flex-col justify-between overflow-y-auto">
              <div>
                <p className="text-[13px] font-semibold tracking-[1.5px] uppercase text-[#AEB7C5] mb-3">
                  READINESS
                </p>

                <div className="inline-flex items-center gap-2 text-[17px] font-medium text-[#DFFF00]">
                  <i className="ri-checkbox-circle-line text-[20px]" aria-hidden="true" />
                  <span>Plan ready</span>
                </div>

                <p className="text-[15px] leading-relaxed text-[#C8CDD6] mt-2">
                  Products and segments saved. Manual operation is available.
                </p>

                {/* Capability Matrix */}
                <div className="mt-6 space-y-3.5 border-t border-[#2A313E] pt-5">
                  <div className="flex items-center justify-between text-[15px]">
                    <span className="text-[#CAD0DA]">{capabilities.manualOperation.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-[#DFFF00] font-medium">
                      <i className="ri-hand-heart-line" aria-hidden="true" />
                      <span>Available</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[15px]">
                    <span className="text-[#CAD0DA]">{capabilities.productCatalog.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-[#C8CDD6]">
                      <i className="ri-shopping-bag-3-line" aria-hidden="true" />
                      <span>Available</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[15px]">
                    <span className="text-[#CAD0DA]">{capabilities.realtimeEngagement.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-[#8A95A5]">
                      <i className="ri-wifi-off-line" aria-hidden="true" />
                      <span>Unavailable</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[15px]">
                    <span className="text-[#CAD0DA]">{capabilities.actionVerification.name}</span>
                    <span className="inline-flex items-center gap-1.5 text-[#8A95A5]">
                      <i className="ri-question-line" aria-hidden="true" />
                      <span>Unknown</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* START LIVE ACTION */}
              <div className="mt-8 pt-5 border-t border-[#2A313E]">
                <Button
                  variant="primary"
                  size="lg"
                  icon="ri-play-line"
                  onClick={handleStartLive}
                  className="w-full min-h-[52px] text-[19px]"
                  data-testid="start-live-cta-btn"
                >
                  Start LIVE
                </Button>

                <p className="text-[13px] leading-5 text-[#AEB7C5] mt-3 text-center">
                  Starts LiveLift tracking. Start your broadcast in the platform separately.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Product Detail Modal */}
        <Dialog
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          title={`Edit Product: ${selectedProduct?.name || ""}`}
        >
          {selectedProduct && (
            <div className="space-y-4">
              <div>
                <p className="text-[13px] font-mono text-[#AEB7C5]">Code: {selectedProduct.code}</p>
                <p className="text-[16px] text-[#F5F7FC] font-medium mt-1">
                  Price: {selectedProduct.price !== null ? `${selectedProduct.currency} ${selectedProduct.price}` : "Not entered"}
                </p>
              </div>

              {selectedProduct.talkingPoints.length > 0 && (
                <div>
                  <p className="text-[14px] font-medium text-[#CAD0DA]">Talking points:</p>
                  <ul className="text-[14px] text-[#B7C1CE] list-disc list-inside mt-1 space-y-1">
                    {selectedProduct.talkingPoints.map((tp, idx) => (
                      <li key={idx}>{tp}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <Button
                  variant={selectedProduct.priority === "high" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handleTogglePriority(selectedProduct.id)}
                >
                  Priority: {selectedProduct.priority}
                </Button>

                <Button
                  variant={selectedProduct.status === "disabled" ? "primary" : "danger"}
                  size="sm"
                  onClick={() => handleToggleProductStatus(selectedProduct.id)}
                >
                  {selectedProduct.status === "disabled" ? "Enable Product" : "Disable Product"}
                </Button>
              </div>
            </div>
          )}
        </Dialog>

        {/* Add Segment Modal */}
        <Dialog
          isOpen={isAddSegmentOpen}
          onClose={() => setIsAddSegmentOpen(false)}
          title="Add Segment to Run of Show"
        >
          <form onSubmit={handleAddSegment} className="space-y-4">
            <div>
              <label htmlFor="seg-title" className="block text-[14px] text-[#CAD0DA] mb-1">
                Segment Title
              </label>
              <input
                id="seg-title"
                type="text"
                required
                value={newSegTitle}
                onChange={(e) => setNewSegTitle(e.target.value)}
                placeholder="e.g. Highlight M03 Cargo Pants"
                className="w-full h-11 bg-[#13161C] border border-[#39414D] rounded px-3 text-[#F5F7FC]"
              />
            </div>

            <div>
              <label htmlFor="seg-dur" className="block text-[14px] text-[#CAD0DA] mb-1">
                Planned Duration (minutes)
              </label>
              <input
                id="seg-dur"
                type="number"
                min="1"
                required
                value={newSegDuration}
                onChange={(e) => setNewSegDuration(e.target.value)}
                className="w-full h-11 bg-[#13161C] border border-[#39414D] rounded px-3 text-[#F5F7FC]"
              />
            </div>

            <div>
              <label htmlFor="seg-cue" className="block text-[14px] text-[#CAD0DA] mb-1">
                Cue / Host Note (optional)
              </label>
              <input
                id="seg-cue"
                type="text"
                value={newSegCue}
                onChange={(e) => setNewSegCue(e.target.value)}
                placeholder="e.g. Emphasize size guide and return policy"
                className="w-full h-11 bg-[#13161C] border border-[#39414D] rounded px-3 text-[#F5F7FC]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Button type="button" variant="ghost" onClick={() => setIsAddSegmentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Add Segment
              </Button>
            </div>
          </form>
        </Dialog>

        {/* Import Products Modal */}
        <Dialog
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          title="Import Products"
        >
          <div className="space-y-4">
            <p className="text-[14px] text-[#CAD0DA]">
              Paste tab-separated or comma-separated rows (Name, Code, Price):
            </p>
            <textarea
              rows={4}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Ribbed Tee, M01, 18&#10;Zip Hoodie, M02, 36"
              className="w-full bg-[#13161C] border border-[#39414D] rounded p-3 text-[14px] text-[#F5F7FC]"
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsImportOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsImportOpen(false);
                  setImportText("");
                }}
              >
                Import Rows
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </StandardShell>
  );
}
