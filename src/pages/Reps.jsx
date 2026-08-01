import { useState } from 'react'
import { useUpdate, useRefresh } from 'ra-core'
import { supabase } from '../lib/supabase'
import { clearOptionsCache } from '../lib/api'
import { PERMISSION_LEVELS, USER_TYPES } from '../lib/constants'
import ResourceList from '../components/ResourceList'
import EditableCell from '../components/EditableCell'
import Modal from '../components/Modal'
import Icon from '../components/Icon'
import { alertDialog, promptDialog } from '../components/Dialogs'

const permOpts = Object.entries(PERMISSION_LEVELS).map(([value, label]) => ({ value, label }))
const typeOpts = Object.entries(USER_TYPES).map(([value, label]) => ({ value, label }))
const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')

export default function Reps() {
  const [showNew, setShowNew] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const columns = [
    { source: 'full_name', label: 'שם', csv: r => r.full_name,
      render: r => <span style={{ fontWeight: 600, color: 'var(--mp)' }}>{r.full_name || '-'}</span> },
    { source: 'email', label: 'מייל', csv: r => r.email,
      render: r => <span className="small" dir="ltr" style={{ textAlign: 'start' }}><Cell row={r} field="email" display={v => v || '-'} /></span> },
    { source: 'phone', label: 'טלפון', csv: r => r.phone,
      render: r => <span className="small" dir="ltr" style={{ textAlign: 'start' }}><Cell row={r} field="phone" display={v => v || '-'} /></span> },
    { source: 'permission_level', label: 'הרשאה', csv: r => PERMISSION_LEVELS[r.permission_level],
      render: r => <Cell row={r} field="permission_level" mode="select" options={permOpts}
        display={v => <span className="badge info">{PERMISSION_LEVELS[v]}</span>} /> },
    { source: 'user_type', label: 'סוג', csv: r => USER_TYPES[r.user_type],
      render: r => <Cell row={r} field="user_type" mode="select" options={typeOpts}
        display={v => <span className="badge gray">{USER_TYPES[v]}</span>} /> },
    { source: 'active', label: 'פעיל', csv: r => r.active ? 'פעיל' : 'מושבת', render: r => <ActiveToggle row={r} /> },
    { source: 'pw', label: 'סיסמה', sortable: false, csv: false, render: r => <ResetBtn row={r} /> },
  ]

  const presets = [
    { key: 'all', label: 'הכול' },
    { key: 'active', label: 'פעילים', filter: { active: true } },
    { key: 'inactive', label: 'מושבתים', filter: { active: false } },
  ]

  return (
    <>
      <ResourceList
        key={reloadKey}
        resource="users" storeKey="rep" exportName="reps"
        sort={{ field: 'full_name', order: 'ASC' }}
        columns={columns} presets={presets}
        search="שם / מייל / טלפון"
        rowPath={r => `/reps/${r.id}`}
        actions={<button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> נציג חדש</button>}
      />
      {showNew && <NewRepModal onClose={() => setShowNew(false)}
        onCreated={() => { setShowNew(false); clearOptionsCache(); setReloadKey(k => k + 1) }} />}
    </>
  )
}

function Cell({ row, field, mode, options, display }) {
  const refresh = useRefresh()
  return <EditableCell row={row} table="users" field={field} mode={mode} options={options}
    display={display} onSaved={() => { clearOptionsCache(); refresh() }} />
}

function ActiveToggle({ row }) {
  const [update] = useUpdate()
  const refresh = useRefresh()
  const click = (e) => {
    e.stopPropagation()
    update('users', { id: row.id, data: { active: !row.active } },
      { onSuccess: () => { clearOptionsCache(); refresh() } })
  }
  return <button className={`badge ${row.active ? 'ok' : 'err'}`} style={{ border: 'none', cursor: 'pointer' }} onClick={click}>
    {row.active ? 'פעיל' : 'מושבת'}
  </button>
}

function ResetBtn({ row }) {
  const reset = async (e) => {
    e.stopPropagation()
    const password = await promptDialog(`סיסמה חדשה עבור ${row.full_name}:`)
    if (!password) return
    if (password.length < 6) return await alertDialog('סיסמה חייבת להיות לפחות 6 תווים')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTIONS_URL}/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ user_id: row.id, password }),
    })
    await alertDialog(res.ok ? 'הסיסמה עודכנה בהצלחה' : 'איפוס הסיסמה נכשל')
  }
  return <button className="btn subtle sm" onClick={reset}>איפוס</button>
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
