import React from "react";
import { HostApp } from "@/components/platform/host-app/HostApp";
import type { HostAppViewModel, HostAppActions } from "@/components/platform/host-app/types";
import type { LiveDeskViewModel } from "@/lib/livedesk/types";
import { DeskPanel } from "./DeskFrame";
import { deskCopy } from "./copy";

const noop = (): void => undefined;
const previewActions: HostAppActions = {
  onGoLive: noop, onEndLive: noop, onPin: noop, onUnpin: noop, onAddItem: noop, onRemoveItem: noop,
};

export function toHostPreview(view: LiveDeskViewModel): HostAppViewModel {
  return {
    mode: view.mode,
    title: view.title,
    sessionId: null,
    viewers: view.viewers,
    elapsedLabel: view.clock.elapsedLabel,
    bag: view.products.filter(product => product.sync.state === "synced").map((product, index) => ({
      // Display-only ids: the desk contract exposes no platform item ids or host actions.
      itemId: index + 1, name: product.name, priceLabel: product.priceLabel,
      initials: product.name.slice(0, 2).toUpperCase(), pinned: product.showing,
    })),
    promotion: null,
    comments: [...view.comments].reverse().map(({ id, user, text }) => ({ id, user, text })),
    banner: view.banner,
  };
}

export function HostPreview({ view, lang }: { view: LiveDeskViewModel; lang: "en" | "vi" }) {
  const c = deskCopy[lang];
  return (
    <DeskPanel title={c.phone} testId="desk-phone">
      <p className="mb-3 text-[14px] text-[var(--text-muted)]">{c.phoneHelp}</p>
      <div inert aria-hidden="true">
        <HostApp viewModel={toHostPreview(view)} actions={previewActions} className="!h-[540px]" />
      </div>
    </DeskPanel>
  );
}
