// "Hành trình dữ liệu": the six stages of the Data Driven Business topic, pinned onto the
// places in the Live Desk where each one happens. The legend doubles as the text alternative.

import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { IconClose } from "../icons";
import { setState, useStore } from "../store";

type Side = "left" | "right" | "below" | "above";

interface Stage {
  n: number;
  title: string;
  text: string;
  /** preferred sides, tried in order; the first spot that covers no other target wins */
  sides: Side[];
}

export const STAGES: Stage[] = [
  { n: 1, title: "Thu thập", text: "Bình luận, người xem và lượt thêm giỏ đổ về liên tục từ nền tảng (ở đây là SIMULATED).", sides: ["left", "below"] },
  { n: 2, title: "Làm sạch", text: "Che số điện thoại trước khi hiển thị và lưu; gắn mỗi bình luận với sản phẩm được nhắc.", sides: ["left", "above"] },
  { n: 3, title: "Phân tích", text: "Đếm ý định trong 2 phút gần nhất: hỏi giá, hỏi size, chốt đơn, khác.", sides: ["left", "below"] },
  { n: 4, title: "Khai thác insight", text: "Biến số đếm thành lý do đọc được, luôn kèm cỡ mẫu và so với 2 phút trước.", sides: ["below", "left"] },
  { n: 5, title: "Đề xuất giải pháp", text: "Một câu trả lời: nên ghim gì, flash sale lúc nào. Người vận hành quyết định.", sides: ["left", "above"] },
  { n: 6, title: "Đánh giá hiệu quả", text: "Tổng kết: gợi ý nào được nhận, bỏ qua, tự làm, và điều chưa biết.", sides: ["below", "left"] },
];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 6;
const CALLOUT_W = 272;

function measure(): Record<number, Box> {
  const out: Record<number, Box> = {};
  for (const s of STAGES) {
    const el = document.querySelector<HTMLElement>(`[data-journey="${s.n}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    out[s.n] = { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 };
  }
  return out;
}

const GAP = 24;

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Place every callout beside its target without covering another target or callout. */
function layout(boxes: Record<number, Box>, vw: number, vh: number, h: number, legend: Box | null): Record<number, Box> {
  const placed: Record<number, Box> = {};
  const targets = Object.values(boxes);
  const taken: Box[] = legend ? [legend] : [];
  for (const s of STAGES) {
    const b = boxes[s.n];
    if (!b) continue;
    const clampX = (x: number) => Math.max(16, Math.min(vw - CALLOUT_W - 16, x));
    const clampY = (y: number) => Math.max(16, Math.min(vh - h - 16, y));
    const candidates: Box[] = [];
    for (const side of s.sides) {
      const ys = [b.y + 8, b.y + b.h / 2 - h / 2, b.y + b.h - h - 8];
      const xs = [b.x + 8, b.x + b.w - CALLOUT_W - 8];
      if (side === "left") for (const y of ys) candidates.push({ x: b.x - CALLOUT_W - GAP, y, w: CALLOUT_W, h });
      if (side === "right") for (const y of ys) candidates.push({ x: b.x + b.w + GAP, y, w: CALLOUT_W, h });
      if (side === "below") for (const x of xs) candidates.push({ x, y: b.y + b.h + GAP, w: CALLOUT_W, h });
      if (side === "above") for (const x of xs) candidates.push({ x, y: b.y - h - GAP, w: CALLOUT_W, h });
    }
    const inView = candidates.map((c) => ({ ...c, x: clampX(c.x), y: clampY(c.y) }));
    const clean = (c: Box) => !targets.some((t) => overlaps(c, t)) && !taken.some((t) => overlaps(c, t));
    let pick = inView.find(clean);
    if (!pick) {
      // slide down the preferred side until it is clear
      const base = candidates[0];
      for (let dy = 0; dy < vh && !pick; dy += 16) {
        const c = { ...base, x: clampX(base.x), y: clampY(base.y + dy) };
        if (clean(c)) pick = c;
      }
    }
    pick = pick ?? { ...candidates[0], x: clampX(candidates[0].x), y: clampY(candidates[0].y) };
    placed[s.n] = pick;
    taken.push(pick);
  }
  return placed;
}

export function Journey() {
  const open = useStore((s) => s.journey);
  const screen = useStore((s) => s.screen);
  if (!open) return null;
  return <JourneyLayer key={screen} />;
}

function JourneyLayer() {
  const [boxes, setBoxes] = useState<Record<number, Box>>({});
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const close = useRef<HTMLButtonElement>(null);
  const t = useStore((s) => s.t);
  const filter = useStore((s) => s.filter);

  useLayoutEffect(() => {
    const update = () => {
      setBoxes(measure());
      setVp({ w: window.innerWidth, h: window.innerHeight });
    };
    update();
    const id = window.setInterval(update, 400);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
    };
  }, [t, filter]);

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setState({ journey: false });
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      if (back && document.contains(back)) back.focus();
    };
  }, []);

  const found = STAGES.filter((s) => boxes[s.n]);
  const spot = found.length > 0;
  const CH = 112;
  const compact = vp.w < 1100;
  const legendBox: Box = { x: 24, y: vp.h - 24 - 340, w: 380, h: 340 };
  const spots = layout(boxes, vp.w, vp.h, CH, legendBox);

  return (
    <div class={`journey${spot && !compact ? "" : " is-list"}`} role="dialog" aria-modal="true" aria-labelledby="journey-h">
      {spot && !compact && (
        <svg class="journey-scrim" width={vp.w} height={vp.h} aria-hidden="true">
          <defs>
            <mask id="journey-mask">
              <rect width={vp.w} height={vp.h} fill="white" />
              {found.map((s) => {
                const b = boxes[s.n];
                return <rect key={s.n} x={b.x} y={b.y} width={b.w} height={b.h} rx="14" fill="black" />;
              })}
            </mask>
          </defs>
          <rect width={vp.w} height={vp.h} fill="var(--scrim-strong)" mask="url(#journey-mask)" />
          {found.map((s, i) => {
            const b = boxes[s.n];
            return <rect key={s.n} class="journey-ring" style={{ animationDelay: `${i * 70}ms` }} x={b.x} y={b.y} width={b.w} height={b.h} rx="14" />;
          })}
        </svg>
      )}

      {spot &&
        !compact &&
        found.map((s, i) => {
          const b = boxes[s.n];
          const p = spots[s.n];
          return (
            <div key={s.n} aria-hidden="true">
              <span
                class="journey-badge"
                style={{ left: `${Math.max(4, b.x - 14)}px`, top: `${Math.max(4, b.y - 14)}px`, animationDelay: `${i * 70}ms` }}
              >
                {s.n}
              </span>
              <div
                class="journey-callout"
                style={{ left: `${p.x}px`, top: `${p.y}px`, width: `${CALLOUT_W}px`, minHeight: `${CH}px`, animationDelay: `${120 + i * 70}ms` }}
              >
                <p class="journey-callout-title">
                  <span class="journey-n">{s.n}</span>
                  {s.title}
                </p>
                <p>{s.text}</p>
              </div>
            </div>
          );
        })}

      <section class="journey-legend">
        <div class="journey-legend-head">
          <h2 id="journey-h">Hành trình dữ liệu</h2>
          <button type="button" class="icon-btn" aria-label="Đóng hành trình dữ liệu" ref={close} onClick={() => setState({ journey: false })}>
            <IconClose />
          </button>
        </div>
        <p class="journey-sub">Sáu việc của đề tài Data Driven Business, và chỗ mỗi việc diễn ra trên Live Desk.</p>
        <ol>
          {STAGES.map((s) => (
            <li key={s.n} class={boxes[s.n] || !spot ? "" : "is-absent"}>
              <span class="journey-n">{s.n}</span>
              <span>
                <b>{s.title}</b>
                {(!spot || compact) && <span class="journey-li-text">{s.text}</span>}
                {spot && !compact && !boxes[s.n] && <span class="journey-li-text">Không hiện ở trạng thái này.</span>}
              </span>
            </li>
          ))}
        </ol>
        {!spot && <p class="journey-sub">Bắt đầu live để xem từng bước trên Live Desk.</p>}
      </section>
    </div>
  );
}
