// A small preview of the host's phone on the SIMULATED platform. It mirrors the pinned product.
// Deliberately generic: no platform logo, colours or layout copied from any real app.

import { fmtClock, fmtNum, fmtPrice } from "../format";
import { activeOutage, pinAt, productById, visibleComments, viewersNow, type World } from "../engine";
import { IconBag, IconEye } from "../icons";

export function Phone({ world, sending }: { world: World; sending: string | null }) {
  const pin = pinAt(world.actions, world.t);
  const product = pin ? productById(pin.product) : null;
  const blind = !!activeOutage(world);
  const viewers = viewersNow(world);
  const recent = visibleComments(world).slice(-3);
  return (
    <figure class="phone-wrap" data-journey-anchor="phone">
      <figcaption class="phone-caption">
        <span class="sim-dot" aria-hidden="true" />
        Điện thoại người dẫn, SIMULATED Shopee Live
      </figcaption>
      <div class="phone" aria-label={product ? `Xem trước: đang ghim ${product.name}` : "Xem trước: chưa ghim sản phẩm nào"}>
        <div class="phone-screen">
          <div class="phone-top">
            <span class="phone-live">LIVE</span>
            <span class="phone-viewers">
              <IconEye size={12} />
              {viewers === null ? "?" : fmtNum(viewers)}
            </span>
            <span class="phone-time">{fmtClock(world.t)}</span>
          </div>
          <div class="phone-host" aria-hidden="true">
            <span>Khung hình người dẫn</span>
          </div>
          <ul class="phone-chat" aria-hidden="true">
            {recent.map((c) => (
              <li key={c.id}>
                <b>{c.handle}</b> {c.text}
              </li>
            ))}
          </ul>
          <div class={`phone-pin${product ? " is-on" : ""}${sending ? " is-sending" : ""}`} key={product?.id ?? "none"}>
            {product ? (
              <>
                <span class="phone-thumb">{product.initials}</span>
                <span class="phone-pin-text">
                  <b>{product.name}</b>
                  <span>{fmtPrice(product.price) ?? "Giá chưa nhập"}</span>
                </span>
                <IconBag size={16} />
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
