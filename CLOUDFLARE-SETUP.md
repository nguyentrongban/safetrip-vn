# Bật thông báo nhắc điểm danh (Web Push) — hướng dẫn từng bước

Tính năng này làm gì: khi bạn đang đi mà sắp tới giờ điểm danh (còn 5 phút),
một trạm nhỏ tự gửi thông báo nổi lên màn hình khóa điện thoại — kể cả khi
bạn đã thoát web. Bấm vào thông báo là vào app bấm TÔI AN TOÀN.

Từ bản 1.36, trạm thông báo này chạy trên **Cloudflare** (miễn phí), tách
hẳn khỏi Supabase cho nhẹ: **Supabase chỉ còn giữ theo dõi trực tiếp + tra
cứu lừa đảo như cũ.**

> **Supabase không cần đụng gì hết.** File push.sql của bản cũ (1.34) bạn
> chưa từng chạy, nên bên Supabase không có gì phải gỡ hay dọn — bỏ qua
> hoàn toàn.

Cần làm 8 bước dưới đây MỘT LẦN DUY NHẤT. Mất khoảng 10–15 phút.

---

## Bước 1 — Tạo tài khoản Cloudflare (miễn phí)

Vào **cloudflare.com** → Sign up → đăng ký bằng email → xác nhận email.
Không cần thẻ tín dụng, không cần mua tên miền gì cả.

## Bước 2 — Tạo Worker và dán code

1. Trong trang quản trị Cloudflare → menu **Workers & Pages** →
   **Create** → **Create Worker**.
2. Đặt tên đúng là: `safetrip-push` → **Deploy** (nó sẽ tạo một worker mẫu).
3. Bấm **Edit code** (chỉnh sửa nhanh / Quick Edit) → xóa hết nội dung mẫu
   → dán toàn bộ nội dung file **`cloudflare/worker.js`** trong thư mục
   source của app vào → **Deploy**.

## Bước 3 — Tạo kho dữ liệu KV

> ✅ ĐÃ LÀM XONG ngày 2026-11-03 từ phía Muse qua API (kho KV tên
> `safetrip-push` đã tạo và gắn sẵn). Phần này chỉ là ghi chú để dựng lại
> nếu sau này cần.

1. Menu **Storage & Databases** → **KV** → **Create namespace**.
2. Đặt tên: `safetrip-push` → Add.
   (Kho KV lưu 3 loại mục nhỏ: đăng ký nhận thông báo của từng máy,
   con trỏ để hủy đăng ký, và hạn điểm danh của từng phiên — không cần
   chạy schema nào cả.)

## Bước 4 — Gắn kho KV vào Worker

1. Quay lại Worker `safetrip-push` → **Settings** → **Bindings** →
   **Add** → **KV namespace**.
2. Variable name điền đúng chữ: `KV` (viết hoa).
3. Chọn namespace `safetrip-push` vừa tạo → **Deploy**.

⚠️ Tên biến phải đúng là `KV` — sai tên là Worker không thấy dữ liệu.

## Bước 5 — Thêm 3 secrets cho Worker

Vẫn trong Worker `safetrip-push` → **Settings** → **Variables and
Secrets** → **Add** → chọn loại **Secret** → thêm lần lượt 3 dòng:

| Tên | Giá trị |
|---|---|
| `VAPID_PRIVATE_KEY` | Mở file **safetrip-push-vapid.txt** mà Muse đã đưa riêng cho bạn, lấy dòng `VAPID_PRIVATE_KEY=...` — chỉ dán giá trị sau dấu `=`. ⚠️ Khóa này là BÍ MẬT: không gửi cho ai, không đăng lên mạng, không đưa vào GitHub. |
| `VAPID_PUBLIC_KEY` | `BBj1cG8XJoN-UirQrguiiDh7S3lRINn23belRWYP71y8n-5ZIU2VurQZVKDxS1lUIzObyJonkeF0wN_E2QgBpc4` |
| `VAPID_SUBJECT` | `mailto:admin@safetrip-vn.vercel.app` (giữ nguyên dòng này là được) |

Xong thì **Deploy** lại Worker một lần nữa cho chắc.

## Bước 6 — Bật đồng hồ canh giờ (Cron)

1. Trong Worker `safetrip-push` → **Settings** → **Triggers** →
   phần **Cron Triggers** → **Add Cron Trigger**.
2. Điền đúng: `* * * * *` (nghĩa là chạy mỗi phút) → Add.

## Bước 7 — Gắn địa chỉ Worker vào app

1. Mở trang của Worker `safetrip-push`, bạn sẽ thấy địa chỉ của nó dạng:
   `https://safetrip-push.<tên-của-bạn>.workers.dev`
   Mở thử địa chỉ này bằng trình duyệt — thấy dòng chữ
   `{"ok":true,"service":"safetrip-push"}` là Worker đang sống.
2. **Gửi địa chỉ đó cho Muse** — Muse sẽ gắn vào app (mục
   `PUSH_WORKER_URL` trong `src/utils/push.ts`) và gửi lại bạn bản zip
   mới nhất. (Nếu bạn muốn tự làm: mở file `src/utils/push.ts`, điền địa
   chỉ vào dòng `PUSH_WORKER_URL`, rồi up source lên GitHub như mọi lần.)

⚠️ Trước khi gắn địa chỉ này, thẻ "Thông báo điểm danh" trong app sẽ hiện
trạng thái chưa cấu hình và không gửi gì đi đâu cả — đó là chủ ý, để app
không bao giờ gọi vào một địa chỉ không tồn tại.

## Bước 8 — Cập nhật app

Up các file mới lên GitHub như mọi lần (bản này là **1.37**) để Vercel tự
cập nhật web. Xong bước này, trong app (tab Giám Sát) thẻ **"Thông báo
điểm danh"** sẽ bật được.

---

## Kiểm tra trên điện thoại (test thật)

1. **iPhone bắt buộc:** mở web bằng Safari → nút Chia sẻ →
   **Thêm vào màn hình chính** → mở SafeTrip từ **icon ngoài màn hình
   chính** (mở bằng tab Safari thì iPhone không cho nhận thông báo).
   Android thì mở bằng Chrome như thường cũng được.
2. Vào tab **Giám Sát** → thẻ **Thông báo điểm danh** → bấm
   **"Bật thông báo nhắc điểm danh"** → chọn **Cho phép** khi máy hỏi.
3. Thấy dòng **"Đã bật ✓ — trạm sẽ nhắc bạn trước giờ điểm danh 5 phút"**
   là phía điện thoại đã xong: máy đã đăng ký nhận thông báo với trạm.
4. **Lần đi thật đầu tiên chính là bài test trọn vẹn:** bắt đầu một
   chuyến đi rồi KHÔNG bấm điểm danh — khi còn 5 phút tới hạn, thông báo
   sẽ nổi lên màn hình khóa. Bấm vào thông báo → app mở ra → bấm
   **TÔI AN TOÀN** là xong một vòng.

> Nói thẳng để khỏi chờ đợi sai: một lần test trọn vẹn mất gần 25 phút
> (30 phút điểm danh trừ 5 phút nhắc trước) và không có đường tắt — đây
> là chủ ý, vì nút "test giả" trong chuyện an toàn dễ gây hiểu lầm là
> hệ thống đã chạy khi nó chưa chạy thật. Dấu hiệu "Đã bật ✓" ở bước 3
> cho biết mắt xích điện thoại ↔ trạm đã thông; vòng chạy thật ở bước 4
> xác nhận nốt mắt xích còn lại.

## Nếu thông báo không tới

- Kiểm tra app có đang mở từ **icon màn hình chính** không (iPhone).
- Kiểm tra Cài đặt máy → Thông báo → SafeTrip VN → đã bật Cho phép chưa.
- Kiểm tra Worker đã gắn đúng binding tên `DB` chưa (bước 4) và đã thêm
  Cron `* * * * *` chưa (bước 6) — thiếu Cron là trạm không ai canh giờ.
- Kiểm tra 3 secrets ở bước 5 có đủ và đúng tên không.
- Mở địa chỉ Worker bằng trình duyệt: phải thấy
  `{"ok":true,"service":"safetrip-push"}`.

## v1.35 — hạn điểm danh là mốc giờ tuyệt đối, không dừng, không đặt lại

Từ v1.35, bộ đếm điểm danh trong app neo vào **mốc giờ tuyệt đối** (deadline)
lưu trên máy, thay vì đếm lùi từng giây trong trang:

- Thoát web, đóng tab, máy đóng băng trang — mở lại là thấy **đúng số phút
  còn lại thật**, không bao giờ nhảy về 30:00.
- Tải lại trang (reload) cũng không sinh hạn mới: hạn đã lưu được khôi phục
  nguyên vẹn, và hạn báo lên trạm là cùng một mốc đó.
- Nếu mở lại app khi đã quá hạn + 3 phút ân hạn mà chu kỳ chưa từng kích
  hoạt, SOS tự kích hoạt **đúng một lần** — kể cả tải lại trang nhiều lần
  sau đó cũng không kích hoạt lại.
- Bấm **TÔI AN TOÀN** là hành động duy nhất bắt đầu chu kỳ mới (hạn mới =
  lúc bấm + 30 phút); kết thúc chuyến đi thì hạn được xóa hẳn.

Bản 1.36 giữ nguyên toàn bộ cơ chế này — chỉ chuyển nơi canh hạn từ
Supabase sang Cloudflare Worker (trạm mới nhận cùng một mốc giờ tuyệt đối
đó qua mục `/deadline`).
