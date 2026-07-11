import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { clearOptionsCache } from '../lib/api'
import { PERMISSION_LEVELS, USER_TYPES } from '../lib/constants'
import EditableCell from '../components/EditableCell'
import Modal from '../components/Modal'
import Icon from '../components/Icon'

const permOpts = Object.entries(PERMISSION_LEVELS).map(([value, label]) => ({ value, label }))
const typeOpts = Object.entries(USER_TYPES).map(([value, label]) => ({ value, label }))
const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')

export default function Reps() {
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [view, setView] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('users').select('*').order('full_name')
    setRows(data || []); setLoading(false); clearOptionsCache()
  }
  useEffect(() => { load() }, [])

  const patchRow = (id) => (field, value) => setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  const toggleActive = async (r) => { await supabase.from('users').update({ active: !r.active }).eq('id', r.id); patchRow(r.id)('active', !r.active); clearOptionsCache() }
  const resetPassword = async (r) => {
    const password = prompt(`סיסמה חדשה עבור ${r.full_name}:`)
    if (!password) return
    if (password.length < 6) return alert('סיסמה חייבת להיות לפחות 6 תווים')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTIONS_URL}/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ user_id: r.id, password }),
    })
    alert(res.ok ? 'הסיסמה עודכנה בהצלחה' : 'איפוס הסיסמה נכשל')
  }

  const filtered = useMemo(() => rows.filter(r => {
    if (view === 'active' && !r.active) return false
    if (view === 'inactive' && r.active) return false
    if (q && !`${r.full_name} ${r.email} ${r.phone}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, view, q])

  const PRESETS = [{ k: 'all', label: 'הכול' }, { k: 'active', label: 'פעילים' }, { k: 'inactive', label: 'מושבתים' }]

  return (
    <div>
      <div className="toolbar">
        {PRESETS.map(p => <button key={p.k} className={`chip ${view === p.k ? 'active' : ''}`} onClick={() => setView(p.k)}>{p.label}</button>)}
        <div className="spacer" />
        <button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> נציג חדש</button>
      </div>
      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={16} style={{ position: 'absolute', insetInlineStart: 10, top: 10, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingInlineStart: 32, width: 220 }} placeholder="שם / מייל / טלפון" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="spacer" /><span className="muted small">{filtered.length} נציגים</span>
      </div>

      {loading ? <div className="empty"><span className="spinner" /></div> : (
        <div className="table-wrap">
          <table className="grid" style={{ minWidth: 760 }}>
            <thead><tr><th>שם</th><th>מייל</th><th>טלפון</th><th>הרשאה</th><th>סוג</th><th>פעיל</th><th>סיסמה</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="clickable" onClick={() => nav(`/reps/${r.id}`)}>
                  <td style={{ fontWeight: 600, color: 'var(--mp)' }}>{r.full_name || '-'}</td>
                  <td className="small" dir="ltr" style={{ textAlign: 'start' }} onClick={e => e.stopPropagation()}><EditableCell row={r} table="users" field="email" display={v => v || '-'} onSaved={patchRow(r.id)} /></td>
                  <td className="small" dir="ltr" style={{ textAlign: 'start' }} onClick={e => e.stopPropagation()}><EditableCell row={r} table="users" field="phone" display={v => v || '-'} onSaved={patchRow(r.id)} /></td>
                  <td onClick={e => e.stopPropagation()}><EditableCell row={r} table="users" field="permission_level" mode="select" options={permOpts} display={v => <span className="badge info">{PERMISSION_LEVELS[v]}</span>} onSaved={patchRow(r.id)} /></td>
                  <td onClick={e => e.stopPropagation()}><EditableCell row={r} table="users" field="user_type" mode="select" options={typeOpts} display={v => <span className="badge gray">{USER_TYPES[v]}</span>} onSaved={patchRow(r.id)} /></td>
                  <td onClick={e => e.stopPropagation()}><button className={`badge ${r.active ? 'ok' : 'err'}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => toggleActive(r)}>{r.active ? 'פעיל' : 'מושבת'}</button></td>
                  <td onClick={e => e.stopPropagation()}><button className="btn subtle sm" onClick={() => resetPassword(r)}>איפוס</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewRepModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />}
    </div>
  )
}

const EMPTY = { full_name: '', email: '', phone: '', permission_level: 'user', user_type: 'service', password: '' }

function NewRepModal({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const create = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.password) { setMsg('שם, מייל וסיסמה נדרשים'); return }
    if (form.password.length < 6) { setMsg('סיסמה חייבת להיות לפחות 6 תווים'); return }
    setBusy(true); setMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${FUNCTIONS_URL}/create-rep`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        if (res.status === 404) { setMsg('הוספת נציג עם התחברות תופעל לאחר פריסת ה-Edge Function create-rep. בינתיים ניתן לערוך נציגים קיימים.'); return }
        throw new Error(await res.text())
      }
      onCreated()
    } catch { setMsg('שגיאה בהוספת נציג.') } finally { setBusy(false) }
  }

  return (
    <Modal title="נציג חדש" icon="plus" onClose={onClose} maxWidth={460}>
      <div className="field"><label>שם מלא <span className="req">*</span></label><input value={form.full_name} onChange={e => set('full_name', e.target.value)} autoFocus /></div>
      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}><label>מייל <span className="req">*</span></label><input type="email" dir="ltr" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div className="field" style={{ flex: 1 }}><label>טלפון</label><input dir="ltr" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <div className="field" style={{ flex: 1 }}><label>הרשאה</label><select value={form.permission_level} onChange={e => set('permission_level', e.target.value)}>{permOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="field" style={{ flex: 1 }}><label>סוג משתמש</label><select value={form.user_type} onChange={e => set('user_type', e.target.value)}>{typeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
      </div>
      <div className="field"><label>סיסמה ראשונית <span className="req">*</span></label><input type="text" dir="ltr" value={form.password} onChange={e => set('password', e.target.value)} /></div>
      {msg && <div className="small" style={{ color: 'var(--warn)', marginBottom: 10 }}>{msg}</div>}
      <div className="row">
        <button className="btn" onClick={create} disabled={busy}>{busy ? <span className="spinner light" style={{ width: 15, height: 15 }} /> : 'הוסף נציג'}</button>
        <button className="btn subtle" onClick={onClose}>ביטול</button>
      </div>
    </Modal>
  )
}
