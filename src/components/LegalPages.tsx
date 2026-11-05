import type { ReactNode } from 'react';

/** Project contact for privacy requests and content takedown/correction.
 *  One single place — change here and both legal pages update. */
export const CONTACT_EMAIL = 'safetripvnsupport247@gmail.com';

const UPDATED = '05/11/2026';

function H({ children }: { children: ReactNode }) {
  return <h2 className="text-white font-black text-base pt-5 first:pt-0">{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-300 leading-6 pt-1.5">{children}</p>;
}
function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-slate-300 leading-6 pt-1">
      <span className="text-slate-500 shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}
/** Definition row used for the data-classification and retention lists. */
function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="border-b border-white/5 py-2.5 last:border-b-0">
      <p className="text-sm font-bold text-white">{term}</p>
      <p className="text-sm text-slate-300 leading-6 pt-0.5">{children}</p>
    </div>
  );
}
const MAIL = (
  <a className="text-sky-400 font-semibold" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
);

export function PrivacyContent() {
  return (
    <article>
      <p className="text-xs text-slate-500 font-semibold">Cập nhật lần cuối: {UPDATED}</p>
      <P>Chính sách này áp dụng cho ứng dụng SafeTrip VN. Bên kiểm soát và xử lý dữ liệu cá nhân là <b className="text-white">Ban vận hành SafeTrip VN</b> — liên hệ: {MAIL}. SafeTrip VN không yêu cầu tài khoản, không đăng ký và <b className="text-white">không bán dữ liệu của bạn cho bất kỳ ai</b>.</P>

      <H>Điều 1. Phân loại dữ liệu được xử lý</H>
      <Row term="Dữ liệu cá nhân nhạy cảm">Tọa độ vị trí GPS, vận tốc di chuyển và thời gian tương ứng — chỉ phát sinh khi bạn bật Giám Sát chuyến đi hoặc chia sẻ vị trí cho người thân.</Row>
      <Row term="Dữ liệu kỹ thuật">Loại thiết bị và trình duyệt; địa chỉ nhận thông báo đẩy của trình duyệt (chỉ dùng để gửi cảnh báo điểm danh về chính máy của bạn).</Row>
      <Row term="Dữ liệu trong báo cáo cộng đồng">Biển số xe, số điện thoại, tên nhà xe/tài xế, khu vực, nội dung mô tả và ảnh — do chính người gửi báo cáo cung cấp.</Row>
      <Row term="Dữ liệu chỉ nằm trên máy của bạn">Số điện thoại người thân dùng cho tin SOS, các cài đặt ứng dụng và bản ghi đồng ý dùng vị trí. Nhóm này <b className="text-white">không bao giờ rời khỏi thiết bị</b>.</Row>

      <H>Điều 2. Sự đồng ý đối với dữ liệu vị trí</H>
      <P>Theo Nghị định 13/2023/NĐ-CP, dữ liệu vị trí là dữ liệu cá nhân nhạy cảm. Ứng dụng chỉ truy cập GPS sau khi bạn đồng ý tại màn hình đồng ý riêng và cấp quyền định vị của trình duyệt. Không đồng ý, bạn vẫn dùng được Tra Cứu, Sổ Tay và các tính năng không cần vị trí. Bạn rút lại đồng ý bất cứ lúc nào tại mục Sổ Tay → Pháp lý &amp; quyền riêng tư; khi đó ứng dụng ngừng thu thập vị trí ngay.</P>
      <P>Khi bạn chia sẻ liên kết theo dõi, bạn bảo đảm người xem là người thân được bạn cho phép. Người xem không cần tài khoản và ứng dụng không thu thập thêm dữ liệu cá nhân của người xem ngoài dữ liệu kỹ thuật tối thiểu để tải trang.</P>

      <H>Điều 3. Mục đích xử lý</H>
      <ul>
        <Li>Hiển thị vị trí của bạn cho chính bạn và cho người thân có mã chuyến đi.</Li>
        <Li>Cảnh báo khi bạn đến gần biên giới, cửa khẩu và khu vực có báo cáo nguy hiểm.</Li>
        <Li>Nhắc điểm danh an toàn và hỗ trợ người thân khi chuyến đi dừng bất thường.</Li>
        <Li>Kiểm duyệt và hiển thị các báo cáo cộng đồng phục vụ phòng tránh rủi ro.</Li>
      </ul>
      <P>Ngoài các mục đích trên: không bán, không cho thuê dữ liệu; không dùng dữ liệu vị trí cho quảng cáo.</P>

      <H>Điều 4. Thời hạn lưu trữ</H>
      <Row term="Dữ liệu vị trí chuyến đi">Tự động xóa sau tối đa <b className="text-white">3 ngày</b> kể từ lần cập nhật cuối. Liên kết theo dõi vô hiệu khi bạn dừng chia sẻ và mã chuyến đi được thay mới cho chuyến sau.</Row>
      <Row term="Đăng ký thông báo &amp; hạn điểm danh">Lưu đến khi chuyến đi kết thúc hoặc bạn hủy — dùng để gửi cảnh báo trước giờ điểm danh 5 phút.</Row>
      <Row term="Báo cáo cộng đồng">Lưu đến khi bị gỡ theo kiểm duyệt hoặc theo yêu cầu hợp lệ của người liên quan.</Row>
      <Row term="Bản ghi đồng ý">Chỉ lưu trên máy của bạn; mất khi bạn thu hồi đồng ý hoặc xóa dữ liệu trình duyệt.</Row>

      <H>Điều 5. Bên xử lý và chuyển dữ liệu</H>
      <P>Để vận hành, dữ liệu được xử lý qua các nhà cung cấp hạ tầng: Supabase (trung chuyển vị trí, cơ sở dữ liệu báo cáo xe), Cloudflare (thông báo, điểm danh, báo cáo khu vực), Cloudinary (lưu ảnh báo cáo), Mapbox/OpenStreetMap (tải hình bản đồ) và Vercel (đếm lượt truy cập ẩn danh). Một số máy chủ của các nhà cung cấp này đặt ngoài Việt Nam; khi bạn dùng tính năng tương ứng, dữ liệu cần thiết được chuyển tới hạ tầng đó đúng mục đích đã nêu. Chỉ người có đúng mã chuyến đi mới xem được vị trí của bạn.</P>

      <H>Điều 6. Quyền của bạn</H>
      <P>Bạn có quyền được biết, đồng ý hoặc rút lại đồng ý, truy cập, yêu cầu xóa, hạn chế hoặc phản đối xử lý dữ liệu của mình, và khiếu nại tới cơ quan có thẩm quyền (Cục An ninh mạng và phòng, chống tội phạm sử dụng công nghệ cao — A05, Bộ Công an). Các thao tác rút đồng ý và dừng chia sẻ thực hiện ngay trong ứng dụng; các yêu cầu khác gửi tới {MAIL}, chúng tôi phản hồi và xử lý trong thời gian sớm nhất.</P>
      <P>Nếu bạn là chủ xe, nhà xe hoặc cá nhân bị thông tin chưa đúng trong mục báo cáo cộng đồng, bạn có quyền yêu cầu gỡ bỏ hoặc đính chính qua email trên.</P>

      <H>Điều 7. An toàn dữ liệu</H>
      <P>Mọi kết nối đều qua đường truyền mã hóa (HTTPS). Mã chuyến đi là chuỗi ngẫu nhiên khó đoán; khu vực quản trị nội dung chỉ dành cho người quản trị có khóa riêng. Nếu xảy ra sự cố rò rỉ dữ liệu, chúng tôi sẽ thông báo cho cơ quan có thẩm quyền và người bị ảnh hưởng theo quy định tại Điều 23 Nghị định 13/2023/NĐ-CP.</P>

      <H>Điều 8. Trẻ em</H>
      <P>Ứng dụng không hướng tới trẻ em và không chủ động thu thập dữ liệu của trẻ em. Vị trí của trẻ em chỉ được chia sẻ khi cha mẹ hoặc người giám hộ hợp pháp chủ động sử dụng tính năng.</P>

      <H>Điều 9. Thay đổi chính sách</H>
      <P>Bản mới được đăng tại trang này kèm ngày cập nhật. Nếu thay đổi trọng yếu liên quan đến dữ liệu vị trí, ứng dụng sẽ hỏi lại sự đồng ý của bạn trước khi tiếp tục thu thập.</P>
    </article>
  );
}

export function TermsContent() {
  return (
    <article>
      <p className="text-xs text-slate-500 font-semibold">Cập nhật lần cuối: {UPDATED}</p>
      <P>Khi sử dụng SafeTrip VN, bạn đồng ý với các điều khoản dưới đây. Nếu không đồng ý, vui lòng ngừng sử dụng ứng dụng.</P>

      <H>Điều 1. Bản chất dịch vụ</H>
      <P>SafeTrip VN là công cụ <b className="text-white">hỗ trợ tham khảo và phòng tránh rủi ro</b> khi đi xe khách đường dài. Ứng dụng <b className="text-white">không phải dịch vụ khẩn cấp</b> và không thay thế cơ quan chức năng. Khi gặp nguy hiểm thật, hãy gọi <b className="text-white">113</b> (công an), <b className="text-white">115</b> (cấp cứu) hoặc dùng tính năng SOS khẩn cấp có sẵn trong điện thoại của bạn.</P>

      <H>Điều 2. Liên kết chia sẻ vị trí</H>
      <P>Ứng dụng không có tài khoản. Khi bật chia sẻ, bạn nhận một mã/liên kết chuyến đi — chỉ người có mã mới xem được vị trí. Bạn chịu trách nhiệm về việc gửi liên kết cho ai; mã được thay mới sau mỗi chuyến đi. Bạn có thể dừng chia sẻ bất cứ lúc nào và liên kết vô hiệu ngay khi dừng.</P>

      <H>Điều 3. Giới hạn kỹ thuật</H>
      <P>Tọa độ GPS có sai số nhất định và bị ảnh hưởng bởi địa hình, nhà cao tầng, thời tiết. Tính năng theo dõi và cảnh báo phụ thuộc vào kết nối mạng, dung lượng pin và tình trạng thiết bị: mất kết nối, hết pin, tắt máy hoặc lỗi cảm biến có thể làm gián đoạn hoặc sai lệch thông tin. Dữ liệu bản đồ do bên thứ ba cung cấp và có thể chưa cập nhật kịp thực tế.</P>

      <H>Điều 4. Thông tin cộng đồng</H>
      <P>Các báo cáo về xe và khu vực <b className="text-white">do người dùng đóng góp</b>, được kiểm duyệt trước khi đăng để cộng đồng tham khảo, phòng tránh. Chúng tôi không khẳng định thông tin chính xác 100% và nội dung <b className="text-white">không nhằm bôi nhọ hay nhắm vào bất kỳ cá nhân, tổ chức nào</b>. Ngôn ngữ hiển thị luôn là “có báo cáo …” — một tín hiệu tham khảo, không phải kết luận. Quyết định cuối cùng luôn thuộc về bạn.</P>

      <H>Điều 5. Trách nhiệm của người gửi báo cáo</H>
      <ul>
        <Li>Chỉ gửi thông tin đúng sự thật, do chính bạn chứng kiến hoặc có căn cứ rõ ràng.</Li>
        <Li>Bạn tự chịu trách nhiệm trước pháp luật về nội dung mình gửi.</Li>
        <Li>Nghiêm cấm gửi thông tin sai sự thật; nội dung quấy rối, xúc phạm; hoặc dùng tính năng báo cáo để gây hại cho cá nhân, tổ chức khác.</Li>
      </ul>

      <H>Điều 6. Kiểm duyệt, gỡ bỏ, đính chính</H>
      <P>Ban quản trị có quyền duyệt, từ chối hoặc gỡ bỏ bất kỳ báo cáo nào ở bất kỳ thời điểm nào mà không cần báo trước. Nếu bạn cho rằng một báo cáo về mình chưa đúng, gửi email tới {MAIL} ghi rõ biển số/nội dung liên quan và lý do — yêu cầu hợp lệ sẽ được xem xét và gỡ bỏ/đính chính trong thời gian sớm nhất.</P>

      <H>Điều 7. Sở hữu trí tuệ và hành vi bị cấm</H>
      <P>Toàn bộ mã nguồn, giao diện, logo, tên gọi “SafeTrip VN” và cơ sở dữ liệu báo cáo thuộc quyền của đơn vị vận hành. Nghiêm cấm, trừ khi được đồng ý bằng văn bản:</P>
      <ul>
        <Li>Sao chép, mô phỏng giao diện, mã nguồn hoặc nhận diện thương hiệu của SafeTrip VN.</Li>
        <Li>Thu thập dữ liệu bằng công cụ tự động (cạo dữ liệu/scraping), dù thủ công hay tự động.</Li>
        <Li>Kỹ thuật đảo ngược nhằm sao chép tính năng hoặc vượt qua biện pháp bảo vệ.</Li>
        <Li>Dùng dữ liệu của SafeTrip VN để huấn luyện mô hình AI, xây dựng sản phẩm cạnh tranh hoặc đăng lại ở nơi khác.</Li>
        <Li>Giả mạo là SafeTrip VN để thu thập dữ liệu hoặc gây nhầm lẫn cho người dùng.</Li>
      </ul>
      <P>Nội dung bạn gửi trong báo cáo vẫn thuộc về bạn; khi gửi, bạn đồng ý để hệ thống lưu trữ và hiển thị nội dung đó cho mục đích phòng tránh của cộng đồng.</P>

      <H>Điều 8. Giới hạn trách nhiệm</H>
      <P>Ứng dụng được cung cấp miễn phí, theo hiện trạng. Đơn vị vận hành không chịu trách nhiệm đối với thiệt hại phát sinh từ: mất kết nối mạng, hết pin, lỗi thiết bị, sai số GPS; việc người dùng dựa hoàn toàn vào thông tin cộng đồng chưa kiểm chứng; hoặc việc liên kết chia sẻ bị người dùng gửi cho bên thứ ba ngoài ý muốn. Trong mọi trường hợp, ứng dụng không thay thế việc gọi 113/115 khi nguy hiểm xảy ra.</P>

      <H>Điều 9. Chấm dứt và thay đổi điều khoản</H>
      <P>Bạn dừng sử dụng bất cứ lúc nào. Ban vận hành có thể thay đổi, tạm dừng một tính năng để bảo trì hoặc tuân thủ pháp luật. Điều khoản sửa đổi được đăng tại trang này kèm ngày cập nhật và có hiệu lực khi đăng.</P>

      <H>Điều 10. Luật áp dụng và liên hệ</H>
      <P>Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Mọi thắc mắc và yêu cầu liên quan, gửi email tới: {MAIL}.</P>
    </article>
  );
}
