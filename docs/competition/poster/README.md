# AISC'26 poster, AISC26-0039

`AISC26-0039-LiveLift_Poster.png` — 4933×6634 px, 4.9 MB (limit 15 MB; PNG, JPG or PDF accepted). Name follows `<Mã hồ sơ>-<Tên đội>_Poster`.

- The organisers' header (y 0–1254) and footer (y 6351–6634) are pixel-identical to their backdrop; verified by comparing the two regions.
- Content sits in the white area between them. The organisers' guide says 55×60 cm; the submission form says "tỉ lệ khổ A4". The backdrop's own ratio (4933×6634) was kept; confirm with the organisers if it matters.
- Language: Vietnamese with English technical terms.
- Source: `source/poster.html` + `source/assets/`. Render with Chromium at 1233×1275 CSS px, device scale 4, then paste the result at y = 1254 on the backdrop, resized to 4933×5097.

## Where each number comes from

| On the poster | Source |
|---|---|
| 357 passed / 0 failed, 0 of 84 axe scans with violations, 0 px phone movement, fingerprint `9d723008` in six runs, 39 calls | `docs/orchestration/reviews/06-lab-pass.md` |
| 1.248 tests passed, 57 skipped | same file, and `AGENTS.md` baseline |
| axe is automated only | same file: contrast "incomplete in all 84 axe scans"; no manual assistive-technology test |
| Only `update_show_item` documented; A1, A2 unverified; developer access gated | `docs/platform/SHOPEE-LIVE-SIMULATION.md`, `next/src/lib/platform/capabilities.ts` |
| Evidence-model pairs | `AGENTS.md`, `docs/competition/capability-positioning.md` |

The poster states no market figures, no sales effect and no result from the older Python research code.

## Short introduction for the form (657 / 1000 characters)

LiveLift là bàn điều hành đặt cạnh người dẫn live bán hàng. Operator lên kế hoạch, vận hành theo NOW → NEXT → WHY → ACTION, ghi lại điều thực sự đã xảy ra, rồi chọn thay đổi cho buổi live sau. Điểm khác biệt là Evidence model: thiếu số liệu không bằng 0, chưa biết không phải thất bại, kế hoạch không phải thực tế, và dữ liệu mô phỏng không bao giờ trở thành bằng chứng thật. Platform Lab mô phỏng Shopee Live hai chiều (SIMULATED) để thử đồng bộ ghim sản phẩm và flash sale, kèm giả định A1/A2 chưa kiểm chứng trên Shopee thật. Hiện chưa có gì được gửi tới Shopee hay TikTok; bước tiếp theo là xin quyền truy cập thật và kiểm chứng trên một buổi live thật.

## Open items

- Team members and advisors are not on the poster; only the representative is named.
- A person should read the Vietnamese copy once before submission.
