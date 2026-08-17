import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function LoginModal({ onClose }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState(null)

  async function sendOtp() {
    if (!email.trim()) return
    setError(null)
    setSending(true)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        // メールが「6桁コード」ではなく「確認リンク」で届く設定のときの保険。
        // リンクを踏んでもホームではなく記録画面に戻し、下書き(sessionStorage)から復元できるようにする。
        emailRedirectTo: `${window.location.origin}/record`,
      },
    })
    setSending(false)
    if (err) {
      console.error('OTP送信エラー:', err)
      setError('メールの送信に失敗しました。アドレスを確認してください。')
    } else {
      setStep('otp')
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) return
    setError(null)
    setVerifying(true)
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: 'email',
    })
    setVerifying(false)
    if (err) {
      console.error('OTP検証エラー:', err)
      setError('コードが正しくありません。再度お試しください。')
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 w-full max-w-lg mx-auto flex flex-col gap-4">

        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-[#2C2C2A]">ログイン</p>
          <button onClick={onClose}>
            <X size={20} className="text-[#8A8A85]" />
          </button>
        </div>

        {step === 'email' ? (
          <>
            <p className="text-sm text-[#5A5A57] leading-relaxed">
              メールアドレスを入力すると、確認コードが届きます。
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendOtp()}
              placeholder="例：teacher@example.com"
              autoFocus
              className="w-full border border-[#DCE4D9] rounded-xl px-3 py-3 text-sm outline-none focus:border-green-400"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={sendOtp}
              disabled={!email.trim() || sending}
              className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-colors
                ${email.trim() && !sending
                  ? 'bg-green-600 text-white'
                  : 'bg-[#E8E6E0] text-[#B0B0A8]'}`}
            >
              {sending ? '送信中...' : '確認コードを送る'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-[#5A5A57] leading-relaxed">
              <span className="font-medium text-[#2C2C2A]">{email}</span> に
              6桁の確認コードを送りました。
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && verifyOtp()}
              placeholder="000000"
              autoFocus
              className="w-full border border-[#DCE4D9] rounded-xl px-3 py-3 text-2xl text-center font-bold outline-none focus:border-green-400 tracking-[0.4em]"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={verifyOtp}
              disabled={otp.length !== 6 || verifying}
              className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-colors
                ${otp.length === 6 && !verifying
                  ? 'bg-green-600 text-white'
                  : 'bg-[#E8E6E0] text-[#B0B0A8]'}`}
            >
              {verifying ? '確認中...' : 'ログインする'}
            </button>
            <button
              onClick={() => { setStep('email'); setOtp(''); setError(null) }}
              className="text-sm text-green-600 text-center"
            >
              メールアドレスを変更する
            </button>
          </>
        )}
      </div>
    </div>
  )
}
