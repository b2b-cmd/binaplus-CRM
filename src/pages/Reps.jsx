import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearOptionsCache } from '../lib/api'
import { PERMISSION_LEVELS, USER_TYPES } from '../lib/constants'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

const permOpts = Object.entries(PERMISSION_LEVELS).map(([value, label]) => ({ value, label }))
const typeOpts = Object.entries(USER_TYPES).map(([value, label]) => ({ value, label }))
const EMPTY = { full_name: '', email: '', phone: '', permission_level: 'user', user_type: 'service', password: '' }
const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')

export default function Reps() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('users').select('*').order('full_name')
    setRows(data || []); setLoading(false); clearOptionsCache()
  }
  useEffect(() => { load() }, [])

  const patchRow = (id) => (field, value) => setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  const toggleActive = async (r) => {
    await supabase.from('users').update({ active: !r.active }).eq('id', r.id)
    patchRow(r.id)('active', !r.active)
  }
  const resetPassword = async (r) => {
    const password = prompt(`סיסמה חדשה עבור ${r.full_name}:`)
    if (!password) return
    if (password.length < 6) { alert('סיסמה חייבת להיות לפחות 6 תווים'); return }
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTIONS_URL}/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ user_id: r.id, password }),
    })
    alert(res.ok ? 'הסיסמה עודכנה בהצלחה' : 'איפוס הסיסמה נכשל')
  }

  const addRep = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.password) { setMsg('שם, מייל וסיסמה נדרשים'); return }
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
      setForm(EMPTY); await load()
    } catch { setMsg('שגיאה בהוספת נציג.') } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
      <div>
        {loading ? <div className="empty"><span className="spinner" /></div> : (
          <div className="table-wrap">
            <table className="grid">
              <thead><tr><th>שם</th><th>מייל</th><th>טלפון</th><th>הרשאה</th><th>סוג</th><th>פעיל</th><th>סיסמה</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}><EditableCell row={r} table="users" field="full_name" display={v => v || '-'} onSaved={patchRow(r.id)} /></td>
                    <td className="small" dir="ltr" style={{ textAlign: 'start' }}><EditableCell row={r} table="users" field="email" display={v => v || '-'} onSaved={patchRow(r.id)} /></td>
                    <td className="small" dir="ltr" style={{ textAlign: 'start' }}><EditableCell row={r} table="users" field="phone" display={v => v || '-'} onSaved={patchRow(r.id)} /></td>
                    <td><EditableCell row={r} table="users" field="permission_level" mode="select" options={permOpts}
                      display={v => <span className="badge info">{PERMISSION_LEVELS[v]}</span>} onSaved={patchRow(r.id)} /></td>
                    <td><EditableCell row={r} table="users" field="user_type" mode="select" options={typeOpts}
                      display={v => <span className="badge gray">{USER_TYPES[v]}</span>} onSaved={patchRow(r.id)} /></td>
                    <td><button className={`badge ${r.active ? 'ok' : 'err'}`} style={{ border: 'none', cursor: 'pointer' }} onClick={() => toggleActive(r)}>{r.active ? 'פעיל' : 'מושבת'}</button></td>
                    <td><button className="btn subtle sm" onClick={() => resetPassword(r)}>איפוס</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ position: 'sticky', top: 76 }}>
        <div className="card-title"><Icon name="plus" /> נציג חדש</div>
        <div className="field"><label>שם מלא <span className="req">*</span></label><input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
        <div className="field"><label>מייל <span className="req">*</span></label><input type="email" dir="ltr" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
        <div className="field"><label>טלפון</label><input dir="ltr" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        <div className="field"><label>הרשאה</label><select value={form.permission_level} onChange={e => setForm(f => ({ ...f, permission_level: e.target.value }))}>{permOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="field"><label>סוג משתמש</label><select value={form.user_type} onChange={e => setForm(f => ({ ...f, user_type: e.target.value }))}>{typeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        <div className="field"><label>סיסמה ראשונית <span className="req">*</span></label><input type="text" dir="ltr" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
        <button className="btn block" onClick={addRep} disabled={busy}>{busy ? <span className="spinner light" style={{ width: 16, height: 16 }} /> : 'הוסף נציג'}</button>
        {msg && <div className="small" style={{ color: 'var(--warn)', marginTop: 10 }}>{msg}</div>}
      </div>
    </div>
  )
}
