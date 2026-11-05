import { useState } from 'react';
import { CheckCircle2, KeyRound, Mail, Send } from 'lucide-react';
import { PUSH_WORKER_URL } from '../utils/push';
import { CONTACT_EMAIL } from './LegalPages';

const TYPES = [
  { id: 'go-bai', label: 'Gỡ bài / đính chính' },
  { id: 'rieng-tu', label: 'Riêng tư & dữ liệu' },
  { id: 'loi-app', label: 'Báo lỗi ứng dụng' },
  { id: 'khac', label: 'Khác' },
];

const inputCls = 'w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-base text-white placeholder:text-slate-500 outline-none focus:border-sky-400/60';

/** Support contact form with email double opt-in: after submitting, the
 *  request only counts once the user confirms — by typing the 6-digit
 *  code mailed to them, or by tapping the link in that email. If the
 *  mail system is not configured yet, submissions land directly. */
export default function ContactForm() {
  const [type, setType] = useState('khac');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — humans never fill this
  const [status, setStatus] = useState<'idle' | 'sending' | 'verify' | 'sent' | 'dup' | 'error'>('idle');
  const [invalid, setInvalid] = useState('');
  const [reqId, setReqId] = useState('');
  const [code, setCode] = useState('');
  const [verifyMsg, setVerifyMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const mailtoHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('SafeTrip VN — yêu cầu hỗ trợ')}&body=${encodeURIComponent(`Loại yêu cầu: ${TYPES.find((t) => t.id === type)?.label || 'Khác'}\nTên: ${name}\nEmail: ${email}\n\n${message}`)}`;

  const submit = async () => {
    const em = email.trim();
    const msg = message.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { setInvalid('Email chưa đúng định dạng — kiểm tra lại giúp mình.'); return; }
    if (msg.length < 10) { setInvalid('Nội dung hơi ngắn — viết ít nhất 10 ký tự để bên mình hiểu rõ nhé.'); return; }
    setInvalid('');
    setStatus('sending');
    try {
      const res = await fetch(`${PUSH_WORKER_URL}/support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name: name.trim(), email: em, message: msg, website }),
      });
      const j = await res.json().catch(() => null) as { pending?: boolean; id?: string } | null;
      if (res.ok && j?.pending && j.id) { setReqId(j.id); setVerifyMsg(''); setStatus('verify'); }
      else if (res.ok) setStatus('sent');
      else if (res.status === 409) setStatus('dup');
      else if (res.status === 422) {
        setStatus('idle');
        setInvalid('Email này có vẻ không nhận được thư (tên miền không tồn tại) — kiểm tra lại giúp mình nhé.');
      } else setStatus('error');
    } catch { setStatus('error'); }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code.trim())) { setVerifyMsg('Mã gồm đúng 6 số — xem trong email nhé.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${PUSH_WORKER_URL}/support-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reqId, code: code.trim() }),
      });
      if (res.ok) { setStatus('sent'); return; }
      const j = await res.json().catch(() => null) as { error?: string } | null;
      if (j?.error === 'bad_code') setVerifyMsg('Mã chưa đúng — kiểm tra lại trong email nhé.');
      else if (j?.error === 'expired') setVerifyMsg('Mã đã hết hạn (15 phút) — bấm "Gửi lại mã" để nhận mã mới.');
      else if (j?.error === 'too_many_attempts') setVerifyMsg('Nhập sai quá nhiều lần — bấm "Gửi lại mã" để nhận mã mới.');
      else if (j?.error === 'not_pending') setStatus('sent');
      else setVerifyMsg('Chưa xác nhận được — thử lại sau ít phút nhé.');
    } catch { setVerifyMsg('Mất mạng — thử lại nhé.'); }
    setBusy(false);
  };

  const resend = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${PUSH_WORKER_URL}/support-resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reqId }),
      });
      if (res.ok) setVerifyMsg('Đã gửi lại mã mới — kiểm tra email nhé.');
      else if (res.status === 429) setVerifyMsg('Đã gửi lại tối đa 3 lần — đợi ít phút rồi thử lại nhé.');
      else if (res.status === 409) setStatus('sent');
      else setVerifyMsg('Chưa gửi lại được — thử lại sau nhé.');
    } catch { setVerifyMsg('Mất mạng — thử lại nhé.'); }
    setBusy(false);
  };

  if (status === 'verify') {
    return (
      <article className="space-y-4 pt-2">
        <div className="text-center space-y-2">
          <KeyRound className="w-12 h-12 text-sky-300 mx-auto" />
          <h3 className="text-white font-black text-lg">Kiểm tra email của bạn</h3>
          <p className="text-sm text-slate-300 leading-6">Mình vừa gửi mã 6 số tới <b className="text-white">{email.trim()}</b>. Nhập mã vào đây là yêu cầu được gửi đi. Trong email cũng có nút xác nhận — ấn nút đó cũng được, khỏi cần nhập mã.</p>
        </div>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Nhập mã 6 số"
          inputMode="numeric"
          autoComplete="one-time-code"
          className={`${inputCls} text-center text-2xl font-black tracking-[0.4em]`}
        />
        {verifyMsg && <p className="text-sm font-semibold text-amber-300 text-center">{verifyMsg}</p>}
        <button
          onClick={verify}
          disabled={busy}
          className="w-full bg-white text-slate-900 font-black py-3.5 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
        >
          <CheckCircle2 className="w-4 h-4" /> {busy ? 'Đang kiểm tra…' : 'Xác nhận'}
        </button>
        <button onClick={resend} disabled={busy} className="w-full bg-white/10 text-slate-200 font-bold py-3 rounded-full active:scale-[0.98] transition disabled:opacity-60">Gửi lại mã</button>
        <p className="text-[11px] text-slate-500 leading-4 text-center">Không thấy thư? Xem thử mục Spam hoặc Quảng cáo. Mã hết hạn sau 15 phút. Đã ấn nút xác nhận trong email rồi thì bạn cứ đóng trang này — yêu cầu đã được gửi.</p>
      </article>
    );
  }

  if (status === 'sent' || status === 'dup') {
    return (
      <article className="text-center pt-10 space-y-3">
        <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
        <h3 className="text-white font-black text-lg">{status === 'sent' ? 'Đã gửi yêu cầu' : 'Bạn đã gửi nội dung này rồi'}</h3>
        <p className="text-sm text-slate-300 leading-6">Ban quản trị SafeTrip VN sẽ xem và trả lời qua email bạn đã ghi. Yêu cầu gỡ bài/đính chính hợp lệ sẽ được xử lý sớm nhất có thể.</p>
        <button
          onClick={() => { setStatus('idle'); setMessage(''); setCode(''); }}
          className="mt-2 bg-white/10 text-white font-bold px-5 py-2.5 rounded-full text-sm active:scale-[0.98] transition"
        >Gửi thêm yêu cầu khác</button>
      </article>
    );
  }

  return (
    <article className="space-y-4">
      <p className="text-sm text-slate-300 leading-6">Cần gỡ bài, đính chính thông tin, hỏi về dữ liệu của bạn, hay báo lỗi? Điền form này — sau khi gửi, bạn xác nhận qua email là yêu cầu tới tay ban quản trị SafeTrip VN.</p>

      <div>
        <p className="text-xs font-bold text-slate-400 pb-2">BẠN CẦN GÌ?</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`px-3.5 py-2 rounded-full text-sm font-bold border active:scale-[0.97] transition ${type === t.id ? 'bg-white text-slate-900 border-white' : 'bg-white/5 text-slate-300 border-white/15'}`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên của bạn (không bắt buộc)" maxLength={80} className={inputCls} autoComplete="name" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email để nhận trả lời *" type="email" maxLength={120} className={inputCls} autoComplete="email" />
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Bạn cần hỗ trợ gì? (ít nhất 10 ký tự)" rows={5} maxLength={1000} className={`${inputCls} resize-none`} />
      {/* Honeypot: hidden from humans, tempting to bots. */}
      <input value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

      {invalid && <p className="text-sm font-semibold text-amber-300">{invalid}</p>}
      {status === 'error' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-red-300">Chưa gửi được — có thể do mạng hoặc hệ thống đang bận. Thử lại, hoặc gửi qua email:</p>
          <a href={mailtoHref} className="flex items-center justify-center gap-2 bg-white/10 text-white font-bold py-3 rounded-full text-sm active:scale-[0.98] transition"><Mail className="w-4 h-4" /> Gửi qua email thay thế</a>
        </div>
      )}

      <button
        onClick={submit}
        disabled={status === 'sending'}
        className="w-full bg-white text-slate-900 font-black py-3.5 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
      >
        <Send className="w-4 h-4" /> {status === 'sending' ? 'Đang gửi…' : 'Gửi yêu cầu'}
      </button>
      <p className="text-[11px] text-slate-500 leading-4 text-center">Email của bạn chỉ dùng để trả lời yêu cầu này — không dùng cho quảng cáo.</p>
    </article>
  );
}
