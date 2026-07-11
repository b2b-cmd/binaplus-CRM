import { useRef, useState } from 'react'
import { useAuthStore } from '../stores/authStore'
import Logo from '../components/Logo'
import Icon from '../components/Icon'

export default function LoginPage() {
  const { signIn, error } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const doLogin = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try { await signIn(email, password) } catch { /* error surfaced via store */ }
    finally { inFlight.current = false; setBusy(false) }
  }
  const submit = (e) => { e.preventDefault(); doLogin() }

  return (
    <div className="center-screen">
      <div className="card" style={{ width: '100%', maxWidth: 400, boxShadow: 'var(--sh3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ marginBottom: 10 }}><Logo size={2.6} /></div>
          <p className="muted small">מערכת ניהול פניות ולידים</p>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label>כתובת מייל</label>
            <input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@bina-plus.co.il" autoComplete="username" required />
          </div>
          <div className="field">
            <label>סיסמה</label>
            <div style={{ position: 'relative' }}>
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required style={{ paddingInlineEnd: 40 }} />
              <button type="button" onClick={() => setShowPass(s => !s)} title={showPass ? 'הסתר סיסמה' : 'הצג סיסמה'}
                style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', display: 'flex', padding: 4 }}>
                <Icon name={showPass ? 'eye-off' : 'eye'} size={18} />
              </button>
            </div>
          </div>
          {error && <div className="badge err" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}>{error}</div>}
          <button type="submit" className="btn block" disabled={busy} onClick={doLogin}>{busy ? <span className="spinner light" style={{ width: 18, height: 18 }} /> : 'התחברות'}</button>
        </form>
        <p className="muted small" style={{ textAlign: 'center', marginTop: 16 }}>גישה לנציגים רשומים בלבד</p>
      </div>
    </div>
  )
}
