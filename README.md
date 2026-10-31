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

## Tính năng đã hoạt động thật
- SOS giữ 2 giây → còi Web Audio + mở SMS kèm link Google Maps cho người thân
- Giám sát GPS liên tục, tự báo động đỏ + còi + SMS khi cách cửa khẩu < 15km (Haversine)
- Dead Man's Switch: 30 phút không check-in → beep/rung, sau 3 phút nữa tự gửi SOS
- Tra cứu realtime trong blacklist, báo cáo cá nhân lưu LocalStorage kèm ảnh xem trước
- Bảng kiểm 5 giây: ≥2 câu CÓ → cảnh báo rủi ro cao
