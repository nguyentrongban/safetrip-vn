import type { BlacklistEntry, BorderPoint } from '../types';

export const BORDER_RADIUS_KM = 15;

export const BORDER_POINTS: BorderPoint[] = [
  { id: 'moc-bai', name: 'Cửa khẩu Mộc Bài', province: 'Tây Ninh', country: 'Campuchia', lat: 11.0769, lng: 106.1733, dangerNote: 'Tuyến lừa đảo "việc nhẹ lương cao" qua Bavet phổ biến nhất.' },
  { id: 'xa-mat', name: 'Cửa khẩu Xa Mát', province: 'Tây Ninh', country: 'Campuchia', lat: 11.6925, lng: 105.9314, dangerNote: 'Ít người qua lại, xe dù hay rẽ hướng tại đây.' },
  { id: 'ha-tien', name: 'Cửa khẩu Hà Tiên', province: 'Kiên Giang', country: 'Campuchia', lat: 10.3828, lng: 104.4889, dangerNote: 'Nguy cơ bị đưa sang Kampot bằng đường bộ và đường thủy.' },
  { id: 'tinh-bien', name: 'Cửa khẩu Tịnh Biên', province: 'An Giang', country: 'Campuchia', lat: 10.6342, lng: 104.9147, dangerNote: 'Nhiều đường mòn biên giới, xe ôm/xe dù hoạt động mạnh.' },
  { id: 'vinh-xuong', name: 'Cửa khẩu Vĩnh Xương', province: 'An Giang', country: 'Campuchia', lat: 10.8833, lng: 105.1833, dangerNote: 'Biên giới sông, dễ bị chuyển sang thuyền lạ.' },
  { id: 'binh-hiep', name: 'Cửa khẩu Bình Hiệp', province: 'Long An', country: 'Campuchia', lat: 10.8781, lng: 105.7889, dangerNote: 'Xe khách trá hình hay dừng đón khách dọc tuyến này.' },
  { id: 'my-quy-tay', name: 'Cửa khẩu Mỹ Quý Tây', province: 'Long An', country: 'Campuchia', lat: 10.8500, lng: 106.1833, dangerNote: 'Gần TP.HCM, nhiều vụ dụ dỗ đi "làm casino" bắt đầu từ đây.' },
  { id: 'lao-bao', name: 'Cửa khẩu Lao Bảo', province: 'Quảng Trị', country: 'Lào', lat: 16.6225, lng: 106.5931, dangerNote: 'Tuyến qua Lào rồi vòng sang nước thứ ba.' },
  { id: 'cau-treo', name: 'Cửa khẩu Cầu Treo', province: 'Hà Tĩnh', country: 'Lào', lat: 18.3819, lng: 105.1731, dangerNote: 'Đường đèo vắng, sóng điện thoại yếu.' },
  { id: 'mong-cai', name: 'Cửa khẩu Móng Cái', province: 'Quảng Ninh', country: 'Trung Quốc', lat: 21.5361, lng: 107.9681, dangerNote: 'Lừa đảo lao động và mua bán người qua Đông Hưng.' },
  { id: 'huu-nghi', name: 'Cửa khẩu Hữu Nghị', province: 'Lạng Sơn', country: 'Trung Quốc', lat: 21.9631, lng: 106.7108, dangerNote: 'Xe dù gom khách đi "xuất khẩu lao động không giấy tờ".' },
  { id: 'lao-cai', name: 'Cửa khẩu Lào Cai', province: 'Lào Cai', country: 'Trung Quốc', lat: 22.5050, lng: 103.9650, dangerNote: 'Dụ dỗ qua Hà Khẩu bằng giấy tờ giả.' },
];

export const BLACKLIST_DATABASE: BlacklistEntry[] = [
  { id: 'b1', plate: '51B-284.71', company: 'Xe khách Hoàng Long (giả mạo)', phone: '0903124771', reason: 'Chở khách vượt biên sang Bavet, thu giữ điện thoại và CCCD của 6 hành khách.', risk: 'CRITICAL', reports: 23, lastSeen: 'Tây Ninh' },
  { id: 'b2', plate: '67B-091.33', company: 'Nhà xe An Phát (không giấy phép)', phone: '0918091333', reason: 'Không logo, không bến bãi, hẹn đón 2h sáng tại chỗ vắng, ép chuyển xe giữa đường.', risk: 'CRITICAL', reports: 18, lastSeen: 'An Giang' },
  { id: 'b3', plate: '68B-115.02', company: 'Xe dù Hà Tiên - Phnom Penh', phone: '0977115022', reason: 'Quảng cáo việc làm casino, thu hộ chiếu, đòi tiền chuộc 80 triệu/người.', risk: 'CRITICAL', reports: 31, lastSeen: 'Kiên Giang' },
  { id: 'b4', plate: '62B-047.88', company: 'Trung chuyển Miền Tây Express (giả)', phone: '0933047880', reason: 'Ép khách uống nước có mùi lạ, khách ngủ li bì tỉnh dậy đã qua biên giới.', risk: 'CRITICAL', reports: 12, lastSeen: 'Long An' },
  { id: 'b5', plate: '51G-552.19', company: 'Xe hợp đồng Sài Gòn - Mộc Bài', phone: '0909552190', reason: 'Báo giá 200k, giữa đường đòi thêm 3 triệu "phí cửa khẩu".', risk: 'HIGH', reports: 9, lastSeen: 'TP.HCM' },
  { id: 'b6', plate: '70B-063.45', company: 'Nhà xe Tây Ninh Travel (mạo danh)', phone: '0912063455', reason: 'Dùng tên nhà xe uy tín, xe thật không logo, tài xế thay đổi lộ trình liên tục.', risk: 'HIGH', reports: 7, lastSeen: 'Tây Ninh' },
  { id: 'b7', plate: '38B-020.17', company: 'Xe Lào không phép', phone: '0988020177', reason: 'Gom khách đi Lao Bảo không vé, không danh sách hành khách.', risk: 'HIGH', reports: 6, lastSeen: 'Quảng Trị' },
  { id: 'b8', plate: '12B-089.60', company: 'Xe dù Lạng Sơn - Bằng Tường', phone: '0904089601', reason: 'Hứa xuất khẩu lao động không cần giấy tờ, thu trước 50 triệu/người.', risk: 'CRITICAL', reports: 15, lastSeen: 'Lạng Sơn' },
  { id: 'b9', plate: '14B-233.08', company: 'Xe Móng Cái trá hình', phone: '0936233088', reason: 'Chở khách ra bãi xe vắng gần biên giới rồi chuyển sang xe biển Trung Quốc.', risk: 'HIGH', reports: 8, lastSeen: 'Quảng Ninh' },
  { id: 'b10', plate: '24B-071.52', company: 'Xe dù Lào Cai - Hà Khẩu', phone: '0915071529', reason: 'Thu giữ CCCD "để làm thủ tục", sau đó không trả, ép ở lại làm việc.', risk: 'HIGH', reports: 11, lastSeen: 'Lào Cai' },
];

export const PROVINCES: string[] = ['TP.HCM','Hà Nội','An Giang','Tây Ninh','Long An','Kiên Giang','Quảng Trị','Lạng Sơn','Quảng Ninh','Lào Cai','Hà Tĩnh','Đà Nẵng','Cần Thơ','Bình Dương','Đồng Nai','Khác'];

export const CHECKLIST_QUESTIONS: { id: string; text: string; hint: string }[] = [
  { id: 'q1', text: 'Tài xế / phụ xe thu giữ CCCD hoặc điện thoại của bạn?', hint: 'Không nhà xe hợp pháp nào được giữ giấy tờ của khách.' },
  { id: 'q2', text: 'Xe không có logo, tên nhà xe, số tổng đài rõ ràng?', hint: 'Xe hợp pháp bắt buộc có phù hiệu và thông tin nhà xe.' },
  { id: 'q3', text: 'Họ hẹn đón bạn ở chỗ vắng, nửa đêm, ngoài bến xe?', hint: 'Đây là dấu hiệu kinh điển của xe dù / lừa đảo.' },
  { id: 'q4', text: 'Bạn bị ép uống nước / ăn đồ lạ miễn phí trên xe?', hint: 'Nguy cơ bị bỏ thuốc mê. Tuyệt đối không uống.' },
  { id: 'q5', text: 'Bạn bị ép chuyển sang xe khác giữa đường?', hint: 'Chuyển xe lạ giữa đường là bước cuối trước khi qua biên giới.' },
];

export const GUIDE_ARTICLES: { id: string; title: string; icon: string; body: string[] }[] = [
  { id: 'g1', title: 'Cách nhận biết xe lừa đảo sang Campuchia', icon: '🚌', body: ['Hẹn đón ngoài bến, chỗ vắng, thường là 1-3 giờ sáng.', 'Quảng cáo "việc nhẹ lương cao", bao ăn ở, không cần bằng cấp, qua Facebook/Zalo/Telegram.', 'Xe không logo, tài xế liên tục đổi lộ trình, tránh trạm thu phí và chốt CSGT.', 'Thu điện thoại/CCCD với lý do "làm thủ tục".', 'Giá rẻ bất thường hoặc miễn phí toàn bộ chuyến đi — không ai cho không chuyến xe 500km.'] },
  { id: 'g2', title: 'Khi bị giữ điện thoại / khống chế trên xe', icon: '📵', body: ['Giữ bình tĩnh, không chống cự khi đang ở thế yếu — an toàn tính mạng là trên hết.', 'Ghi nhớ biển số, màu xe, đặc điểm tài xế, các biển báo/quán xá vừa đi qua.', 'Giả vờ say xe xin xuống đi vệ sinh tại trạm xăng/cửa hàng đông người, nhờ người lạ gọi 113.', 'Nếu có đồng hồ thông minh / điện thoại phụ, dùng nó gửi vị trí.', 'Khi tới nơi đông người: hét lớn "CỨU TÔI, TÔI BỊ BẮT CÓC" — thu hút đám đông là cách thoát hiệu quả nhất.'] },
  { id: 'g3', title: 'Gửi vị trí bí mật bằng phím tắt iPhone / Android', icon: '📍', body: ['iPhone: bấm nút nguồn 5 lần liên tục -> SOS khẩn cấp tự gọi và gửi vị trí cho liên hệ khẩn cấp đã cài trong app Sức khỏe.', 'iPhone: cài Phím tắt "SOS SafeTrip" -> đọc to "Siri, tôi gặp nguy hiểm".', 'Android (Samsung/Pixel): bấm nút nguồn 5 lần -> gửi SOS kèm vị trí + ảnh camera tới liên hệ khẩn cấp (Cài đặt > An toàn và khẩn cấp).', 'Zalo: mở chat người thân > dấu + > Vị trí > Chia sẻ vị trí trực tiếp 1 giờ trước khi lên xe.', 'Trong SafeTrip VN: giữ nút SOS 2 giây, app tự mở SMS kèm link Google Maps vị trí của bạn.'] },
  { id: 'g4', title: 'Trước khi lên bất kỳ chuyến xe lạ nào', icon: '✅', body: ['Chụp biển số + mặt tài xế gửi cho người thân trước khi xe lăn bánh.', 'Bật chia sẻ vị trí trực tiếp (Zalo/Google Maps) suốt chuyến đi.', 'Thỏa thuận "mật mã an toàn" với gia đình: ví dụ nói "cho con gửi lời hỏi thăm bà" = tôi đang bị khống chế, hãy gọi công an.', 'Bật Dead Man\'s Switch trong SafeTrip VN: 30 phút không check-in, app tự báo người thân.', 'Chỉ đi xe có vé, có bến, tra cứu biển số trong tab Tra Cứu của app này trước.'] },
];

export interface BorderLine { id: string; name: string; country: string; points: [number, number][] }

/** Alert when the user is closer than this to the border LINE itself (not only gates). */
export const BORDER_LINE_ALERT_KM = 10;

/**
 * Approximate land-border polylines (traced along the real borders).
 * Smuggling paths / informal crossings (đường mòn, lối mở) run along the WHOLE
 * line, so proximity is measured to the line, not only to official gates.
 */
export const BORDER_LINES: BorderLine[] = [
  {
    id: 'line-campuchia', name: 'Biên giới Việt Nam – Campuchia', country: 'Campuchia',
    points: [
      [10.3828, 104.4889], [10.4500, 104.6100], [10.6342, 104.9147], [10.8000, 105.0200],
      [10.8833, 105.1833], [10.8500, 105.3500], [10.7800, 105.5500], [10.8781, 105.7889],
      [10.9500, 106.0000], [10.8500, 106.1833], [11.0000, 106.1200], [11.0769, 106.1733],
      [11.3000, 106.0500], [11.6925, 105.9314], [11.8500, 106.1000], [11.8500, 106.6000],
      [11.9500, 106.9000], [12.4000, 107.5000], [12.9500, 107.7500], [13.7000, 107.5500],
      [13.9500, 107.6000], [14.6000, 107.5500], [14.7000, 107.4000],
    ],
  },
  {
    id: 'line-lao', name: 'Biên giới Việt Nam – Lào', country: 'Lào',
    points: [
      [14.7000, 107.4000], [15.2000, 107.2000], [15.5500, 107.0500], [16.0000, 106.9000],
      [16.6225, 106.5931], [16.9000, 106.5000], [17.0000, 106.3000], [17.6800, 105.7700],
      [18.0000, 105.4000], [18.3819, 105.1731], [18.7000, 104.9000], [19.3000, 104.2000],
      [19.9000, 104.4000], [20.5000, 103.9000], [21.4000, 103.0000], [22.3000, 102.2000],
      [22.4000, 102.1500],
    ],
  },
  {
    id: 'line-trungquoc', name: 'Biên giới Việt Nam – Trung Quốc', country: 'Trung Quốc',
    points: [
      [22.4000, 102.1500], [22.5000, 102.6000], [22.6000, 103.2000], [22.5050, 103.9650],
      [22.9000, 104.3000], [23.1000, 104.9000], [23.2800, 105.3600], [23.0000, 105.9000],
      [22.9000, 106.4000], [22.8500, 106.6000], [21.9631, 106.7108], [21.8500, 107.1000],
      [21.7000, 107.4000], [21.5361, 107.9681], [21.6000, 108.0500],
    ],
  },
];
