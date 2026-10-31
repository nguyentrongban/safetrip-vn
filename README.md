# SafeTrip VN

WebApp PWA: cảnh báo xe khách an toàn, giám sát lộ trình real-time, phòng chống lừa đảo / bắt cóc qua biên giới. Chạy 100% trên browser, không cần backend, không cần API key.

## Chạy local
```bash
npm install
npm run dev
```
Mở địa chỉ Network (máy tính và điện thoại cùng Wi-Fi) trên điện thoại để test GPS thật. GPS chỉ hoạt động trên HTTPS hoặc localhost — khi deploy lên Vercel/Netlify là có HTTPS sẵn.

## Deploy + ghim ra màn hình chính
```bash
npm run build
```
Deploy thư mục `dist/` lên Vercel / Netlify / GitHub Pages. Sau đó trên điện thoại:
- Android (Chrome): menu ⋮ → **Cài đặt ứng dụng / Thêm vào màn hình chính**
- iPhone (Safari): nút Chia sẻ → **Thêm vào Màn hình chính**

App mở full-screen như app native, chạy offline nhờ Service Worker (vite-plugin-pwa).

## Cấu trúc
```
index.html
public/favicon.svg
src/
  main.tsx, App.tsx, index.css, types.ts
  utils/geo.ts       Haversine, reverse geocode Nominatim, chuẩn hoá biển số/SĐT
  utils/data.ts      12 điểm biên giới, 10 blacklist, checklist, bài hướng dẫn
  utils/audio.ts     Còi báo động Web Audio 800-1200Hz, beep, rung
  utils/storage.ts   LocalStorage: SOS config, báo cáo cá nhân, chuyến đi
  hooks/useGeolocation.ts      getCurrentPosition + watchPosition
  hooks/useAlarm.ts            Kích hoạt SOS trung tâm
  hooks/useDeadMansSwitch.ts   Đếm ngược 30 phút + 3 phút ân hạn
  components/SOSButton.tsx     Giữ 2 giây mới kích hoạt
  components/MapView.tsx       Leaflet + OpenStreetMap, vòng tròn 15km quanh cửa khẩu
  components/HomeTab.tsx       SOS + cấu hình người thân + thẻ trạng thái GPS
  components/MonitorTab.tsx    Bắt đầu chuyến đi, cảnh báo biên giới, check-in
  components/SearchTab.tsx     Tra cứu blacklist, bảng kiểm 5 giây, báo cáo xe dù
  components/HandbookTab.tsx   Hotline 113/111/115, bài kỹ năng thoát hiểm
```

## Theo dõi trực tiếp kiểu Grab (v1.6 — trạm chung cho cộng đồng, miễn phí)

Mô hình đã chốt: **một trạm chung duy nhất của chủ app**, gắn sẵn vào app — người dùng mở app là dùng ngay, không cài đặt gì. Có mạng: người thân mở link trong tin nhắn SOS là thấy chấm vị trí chạy trực tiếp trên bản đồ (phát mỗi 20 giây / 200m, xem làm mới 10 giây — đủ nhẹ để gói Supabase free gánh ~10.000 giờ theo dõi/tháng). Mất mạng: app tự quay về nhắc gửi SMS vị trí mới mỗi 1km.

Chủ app bật trạm chung 1 lần, khoảng 3 phút:

1. Vào [supabase.com](https://supabase.com) → tạo 1 project free mới (ví dụ tên `safetrip-live`)
2. Trong project: **SQL Editor** → dán toàn bộ file `supabase/live.sql` → **Run** (gồm cả tự dọn vị trí cũ hơn 3 ngày)
3. **Settings → API**: chép `Project URL` và `anon public key`, gửi cho người build
4. Người build điền 2 giá trị đó vào `DEFAULT_LIVE_CONFIG` trong `src/utils/live.ts` → build lại → up Vercel

Từ đó mọi người dùng đều có sẵn mã trực tiếp 8 ký tự, tin nhắn SOS tự kèm link xem. Người dùng rành kỹ thuật vẫn có thể tự nối trạm riêng trong panel (mục Nâng cao) — trạm riêng được ưu tiên hơn trạm chung. Mặc định luôn là trạm chung (v1.17): mở link xem trực tiếp không còn tự lưu trạm vào máy, và cấu hình "riêng" nào trùng y hệt trạm chung sẽ tự được dọn về mặc định; chỉ trạm riêng do người dùng tự tay lưu mới có hiệu lực.

Bảo mật: anon key là khóa công khai theo thiết kế của Supabase; dữ liệu được bảo vệ bằng RLS và mã phiên ngẫu nhiên — chỉ ai có mã/link mới xem được vị trí; vị trí được giữ 3 ngày để tra cứu khi có sự cố, sau đó tự xóa.

## Tính năng đã hoạt động thật
- SOS giữ 2 giây → còi Web Audio + mở SMS kèm link Google Maps cho người thân
- Giám sát GPS liên tục, tự báo động đỏ + còi + SMS khi cách cửa khẩu < 15km (Haversine)
- Dead Man's Switch: 30 phút không check-in → beep/rung, sau 3 phút nữa tự gửi SOS
- Tra cứu realtime trong blacklist, báo cáo cá nhân lưu LocalStorage kèm ảnh xem trước
- Bảng kiểm 5 giây: ≥2 câu CÓ → cảnh báo rủi ro cao

## Kho lừa đảo cộng đồng (v1.18)

- **Phần chữ** (biển số, nhà xe, mô tả) lưu trong cùng project Supabase `safetrip-live`: chạy thêm file `supabase/fraud.sql` trong SQL Editor (1 lần). Bảng bị khóa với khóa công khai; app chỉ đi qua 2 hàm gác cổng `fraud_search` (chỉ trả báo cáo **đã duyệt**) và `fraud_report` (luôn ghi trạng thái chờ duyệt).
- **Ảnh bằng chứng** lưu ở **Cloudinary** (free): app tự nén ảnh trong trình duyệt (tối đa 1280px, WebP/JPEG, thường còn 60–150KB) rồi mới tải lên; Supabase chỉ giữ URL ảnh. Cần: tạo tài khoản Cloudinary → Settings → Upload → tạo 1 **unsigned upload preset** → điền 2 giá trị vào `CLOUDINARY_JSON` trong `src/utils/fraudDb.ts` → build lại. Chưa điền thì báo cáo chữ vẫn chạy, ảnh tự tắt kèm ghi chú rõ ràng.
- **Duyệt báo cáo**: Supabase → Table Editor → `fraud_reports` → xem mô tả + link ảnh → đổi `status` sang `approved` (hiện cho mọi người) hoặc `rejected` (ẩn). Chưa duyệt thì không ai tra thấy — chống báo cáo bậy và tố oan.
- **Khu vực chi tiết (v1.19)**: ô khu vực trong form báo cáo lấy dữ liệu từ API hành chính công khai `provinces.open-api.vn` bản **v2 (sau sáp nhập 2025)**: chọn tỉnh/thành (34) → chọn tiếp phường/xã (bỏ hẳn cấp quận/huyện theo cơ cấu mới), kết quả lưu dạng "Phường X, Tỉnh Y". Dữ liệu được cache 30 ngày trong máy; mất mạng thì tự rơi về danh sách tỉnh có sẵn + ô tự ghi phường/xã. Không cần sửa SQL (vẫn lưu vào cột `area` dạng chữ).
- **Validate (v1.20)**: form báo cáo kiểm tra 2 lớp (app + ngay trong `fraud_report`, sửa app cũng không lách được): ảnh — chỉ file ảnh, tối đa **10MB** (kiểm tra trước khi nén), **đúng 1 tấm** mỗi báo cáo; SĐT — chỉ nhập số, 9–11 số, bắt đầu bằng 0; biển số — 6–11 ký tự sau chuẩn hóa; mô tả — 10–200 ký tự; tên nhà xe — tối đa 120 ký tự. Từ v1.21 các trường đều bắt buộc (SĐT, phường/xã, mô tả…) ở cả app lẫn SQL — NGOẠI TRỪ tên nhà xe (v1.22): bỏ trống thì được, hệ thống tự ghi là "Chưa xác định".
