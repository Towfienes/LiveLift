// A small preview of the host's phone on the SIMULATED platform. It mirrors the pinned product.
// Deliberately generic: no platform logo, colours or layout copied from any real app. The video
// frame is a drawn mock (a host at a clothes rack), not a photo.

import { fmtClock, fmtNum, fmtPrice } from "../format";
import { activeOutage, pinAt, productById, visibleComments, viewersNow, type World } from "../engine";
import { IconEye } from "../icons";

/** A flat, drawn studio frame: wall, clothes rack, a host holding up a garment. */
function VideoFrame() {
  return (
    <svg class="phone-video" viewBox="0 0 180 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="pv-light" cx="50%" cy="28%" r="70%">
          <stop offset="0" stop-color="#5b5f66" />
          <stop offset="1" stop-color="#2b2f36" />
        </radialGradient>
      </defs>
      <rect width="180" height="320" fill="url(#pv-light)" />
      <rect y="250" width="180" height="70" fill="#24272d" />
      {/* clothes rack */}
      <line x1="8" y1="70" x2="172" y2="70" stroke="#8b9099" stroke-width="2" />
      {[
        [18, "#7d8a7a"],
        [40, "#a48f78"],
        [128, "#6f7f95"],
        [150, "#b5a58f"],
        [168, "#8a7a8c"],
      ].map(([x, c]) => (
        <g key={x as number}>
          <path d={`M${x} 70 v4`} stroke="#8b9099" stroke-width="1.5" />
          <path d={`M${(x as number) - 9} 82 l9 -8 l9 8 l-2 52 h-14 z`} fill={c as string} opacity="0.9" />
        </g>
      ))}
      {/* host */}
      <ellipse cx="90" cy="112" rx="21" ry="24" fill="#c9a58c" />
      <path d="M69 104 q0 -30 21 -30 q22 0 21 30 q-4 -14 -21 -14 q-17 0 -21 14 z" fill="#2a2321" />
      <path d="M44 250 q2 -86 46 -96 q44 10 46 96 z" fill="#3d4654" />
      {/* the garment held up to camera */}
      <path d="M60 172 l18 -14 h24 l18 14 l-8 12 l-8 -5 v44 h-28 v-44 l-8 5 z" fill="#d7dbe2" />
      <path d="M90 158 v20" stroke="#aeb4bf" stroke-width="1.5" />
      <ellipse cx="62" cy="178" rx="7" ry="6" fill="#c9a58c" />
      <ellipse cx="118" cy="178" rx="7" ry="6" fill="#c9a58c" />
    </svg>
  );
}

export function Phone({ world, sending }: { world: World; sending: string | null }) {
  const pin = pinAt(world.actions, world.t);
  const product = pin ? productById(pin.product) : null;
  const blind = !!activeOutage(world);
  const viewers = viewersNow(world);
  const recent = visibleComments(world).slice(-3);
  return (
    <figure class="phone-wrap">
      <figcaption class="phone-caption">
        <span class="sim-dot" aria-hidden="true" />
        Điện thoại người dẫn, SIMULATED Shopee Live
      </figcaption>
      <div class="phone" role="img" aria-label={product ? `Xem trước: đang ghim ${product.name}` : "Xem trước: chưa ghim sản phẩm nào"}>
        <div class="phone-screen">
          <VideoFrame />
          <div class="phone-top">
            <span class="phone-live">LIVE</span>
            <span class="phone-viewers">
              <IconEye size={12} />
              {viewers === null ? "?" : fmtNum(viewers)}
            </span>
            <span class="phone-time">{fmtClock(world.t)}</span>
          </div>
          <div class="phone-spacer" />
          <ul class="phone-chat" aria-hidden="true">
            {recent.map((c) => (
              <li key={c.id}>
                <b>{c.handle}</b> {c.text}
              </li>
            ))}
          </ul>
          <div class={`phone-pin${product ? " is-on" : ""}`} key={product?.id ?? "none"}>
            {product ? (
              <>
                <span class="phone-thumb">{product.initials}</span>
                <span class="phone-pin-text">
                  <span class="phone-pin-flag">Đang ghim</span>
                  <b>{product.name}</b>
                  <span class="phone-price">{fmtPrice(product.price) ?? "Giá chưa nhập"}</span>
                </span>
                <span class="phone-cta">Xem</span>
              </>
            ) : (
              <span class="phone-pin-empty">{sending ? "Đang gửi lệnh ghim…" : "Chưa ghim sản phẩm"}</span>
            )}
          </div>
          {blind && (
            <div class="phone-blind">
              <span>LiveLift không thấy màn hình này lúc này</span>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}
