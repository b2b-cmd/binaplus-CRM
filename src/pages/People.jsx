import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRefresh } from 'ra-core'
import { supabase } from '../lib/supabase'
import { loadOptions } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { SALES_STATUS_META, chipColor } from '../lib/constants'
import ResourceList from '../components/ResourceList'
import { BulkDeleteButton } from '../components/admin/bulk-delete-button'
import BulkEdit from '../components/list/BulkEdit'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'
import UserAvatar from '../components/UserAvatar'

const salesOpts = Object.entries(SALES_STATUS_META).map(([value, v]) => ({ value, label: v.label }))

export default function People() {
  const nav = useNavigate()
  const rep = useAuthStore(s => s.rep)
  const [opts, setOpts] = useState({ products: [], cycles: [], reps: [] })
  const [showNew, setShowNew] = useState(false)

  useEffect(() => { loadOptions().then(setOpts) }, [])

  const productOpts = opts.products.map(p => ({ value: p.id, label: p.name }))
  const cycleOpts = opts.cycles.map(c => ({ value: c.id, label: c.name }))
  const repOpts = opts.reps.map(r => ({ value: r.id, label: r.full_name }))

  const columns = [
    { source: 'full_name', label: 'שם', csv: r => r.full_name,
      render: r => <span style={{ fontWeight: 600, color: 'var(--mp)' }}>{r.full_name || '-'}</span> },
    { source: 'phone', label: 'טלפון', csv: r => r.phone,
      render: r => <Cell row={r} field="phone" display={v => <span className="small" dir="ltr">{v || '-'}</span>} /> },
    { source: 'email', label: 'מייל', csv: r => r.email,
      render: r => <Cell row={r} field="email" display={v => <span className="small" dir="ltr">{v || '-'}</span>} /> },
    { source: 'product_id', label: 'מוצר', csv: r => r.product?.name,
      render: r => <Cell row={r} field="product_id" mode="select" options={productOpts}
        display={() => r.product?.name ? <span className="badge" style={chipColor(r.product.name)}>{r.product.name}</span> : '-'} /> },
    { source: 'cycle_id', label: 'מחזור', csv: r => r.cycle?.name,
      render: r => <Cell row={r} field="cycle_id" mode="select" options={cycleOpts}
        display={() => r.cycle?.name ? <span className="badge" style={chipColor(r.cycle.name)}>{r.cycle.name}</span> : '-'} /> },
    { source: 'source', label: 'מקור', csv: r => r.source, render: r => <Cell row={r} field="source" /> },
    { source: 'entry_date', label: 'תאריך כניסה', csv: r => r.entry_date,
      render: r => <Cell row={r} field="entry_date" display={v => v ? new Date(v).toLocaleDateString('he-IL') : '-'} /> },
    { source: 'assigned_sales_rep', label: 'נציג', csv: r => r.rep?.full_name,
      render: r => <Cell row={r} field="assigned_sales_rep" mode="select" options={repOpts}
        display={() => r.rep ? <UserAvatar user={r.rep} /> : '-'} /> },
    { source: 'sales_status', label: 'סטטוס', csv: r => SALES_STATUS_META[r.sales_status]?.label,
      render: r => <Cell row={r} field="sales_status" mode="select" options={salesOpts}
        display={v => <span className={`badge ${SALES_STATUS_META[v]?.badge || 'gray'}`}>{SALES_STATUS_META[v]?.label || '-'}</span>} /> },
    /* Declared but hidden by default: the columns menu can only offer columns
       the table knows about, so these are what make "add a column" possible. */
    { source: 'notes', label: 'הערות', hidden: true, csv: r => r.notes,
      render: r => <Cell row={r} field="notes" display={v => v || '-'} /> },
    { source: 'agreement_status', label: 'הסכם', hidden: true, csv: r => r.agreement_status,
      render: r => <Cell row={r} field="agreement_status" display={v => v || '-'} /> },
    { source: 'received_access', label: 'קיבל גישה', hidden: true, csv: r => r.received_access,
      render: r => <Cell row={r} field="received_access" display={v => v || '-'} /> },
    { source: 'added_to_group', label: 'נוסף לקבוצה', hidden: true, csv: r => r.added_to_group,
      render: r => <Cell row={r} field="added_to_group" display={v => v || '-'} /> },
    { source: 'manager_call', label: 'שיחת מנהל', hidden: true, csv: r => r.manager_call,
      render: r => <Cell row={r} field="manager_call" display={v => v || '-'} /> },
    { source: 'cloudchat_id', label: 'מזהה CloudChat', hidden: true, csv: r => r.cloudchat_id,
      render: r => <span className="small" dir="ltr">{r.cloudchat_id || '-'}</span> },
    { source: 'created_at', label: 'נוצר', hidden: true, csv: r => r.created_at,
      render: r => <span className="small muted">{new Date(r.created_at).toLocaleDateString('he-IL')}</span> },
  ]

  const presets = [
    { key: 'all', label: 'הכול' },
    { key: 'new_lead', label: 'לידים חדשים', filter: { sales_status: 'new_lead' } },
    { key: 'followup', label: 'בפולואפ', filter: { sales_status: 'followup' } },
    { key: 'no_answer', label: 'ללא מענה', filter: { sales_status: 'no_answer' } },
    { key: 'active_student', label: 'תלמידים פעילים', filter: { sales_status: 'active_student' } },
    { key: 'cancelled', label: 'בוטלו', filter: { sales_status: 'cancelled' } },
    ...(rep?.id ? [{ key: 'mine', label: 'שלי', filter: { assigned_sales_rep: rep.id } }] : []),
  ]

  return (
    <>
      <ResourceList
        resource="people" storeKey="ld" exportName="leads"
        sort={{ field: 'created_at', order: 'DESC' }}
        columns={columns} presets={presets}
        search="שם / טלפון / מייל"
        facets={[
          { field: 'product_id', title: 'מוצר', options: productOpts },
          { field: 'cycle_id', title: 'מחזור', options: cycleOpts },
          { field: 'assigned_sales_rep', title: 'נציג', options: repOpts },
        ]}
        rowPath={r => `/people/${r.id}`}
        bulkActions={<><BulkEdit fields={[
          { field: 'sales_status', label: 'סטטוס', options: salesOpts },
          { field: 'product_id', label: 'מוצר', options: productOpts },
          { field: 'cycle_id', label: 'מחזור', options: cycleOpts },
          { field: 'assigned_sales_rep', label: 'נציג', options: repOpts },
        ]} /><BulkDeleteButton /></>}
        actions={<button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> חדש</button>}
      />
      {showNew && <NewPersonModal onClose={() => setShowNew(false)} onCreated={p => nav(`/people/${p.id}`)} />}
    </>
  )
}

/* Inline edit inside a DataTable cell. EditableCell writes through
   lib/api.updateField (audit_log + updated_at); refresh re-reads the list
   so embedded relation names stay in sync with the new foreign key. */
function Cell({ row, field, mode, options, display }) {
  const refresh = useRefresh()
  return (
    <EditableCell row={row} table="people" field={field} mode={mode} options={options}
      display={display} onSaved={() => refresh()} />
  )
}

function NewPersonModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', source: '' })
  const [dup, setDup] = useState(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  // live duplicate check by phone/email
  useEffect(() => {
    const phone = form.phone.replace(/\D/g, ''), email = form.email.trim().toLowerCase()
    if (phone.length < 9 && !email.includes('@')) { setDup(null); return }
    const t = setTimeout(async () => {
      const ors = []
      if (phone.length >= 9) ors.push(`phone.eq.${phone}`)
      if (email.includes('@')) ors.push(`email.ilike.${email}`)
      const { data } = await supabase.from('people').select('id, full_name, phone, email').or(ors.join(',')).is('deleted_at', null).limit(1)
      setDup(data?.[0] || null)
    }, 350)
    return () => clearTimeout(t)
  }, [form.phone, form.email])

  const create = async () => {
    if (!form.full_name.trim()) return
    setBusy(true)
    const { data } = await supabase.from('people').insert({
      full_name: form.full_name.trim(), phone: form.phone.replace(/\D/g, '') || null,
      email: form.email.trim() || null, source: form.source.trim() || 'ידני', sales_status: 'new_lead',
    }).select().single()
    setBusy(false)
    if (data) onCreated(data)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 420, boxShadow: 'var(--sh3)' }} onClick={e => e.stopPropagation()}>
        <div className="card-title"><Icon name="plus" /> ליד / תלמיד חדש</div>
        <div className="field"><label>שם מלא <span className="req">*</span></label><input value={form.full_name} onChange={e => setForm(s => ({ ...s, full_name: e.target.value }))} autoFocus /></div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>טלפון</label><input dir="ltr" value={form.phone} onChange={e => setForm(s => ({ ...s, phone: e.target.value }))} /></div>
          <div className="field" style={{ flex: 1 }}><label>מייל</label><input dir="ltr" value={form.email} onChange={e => setForm(s => ({ ...s, email: e.target.value }))} /></div>
        </div>
        <div className="field"><label>מקור הגעה</label><input value={form.source} onChange={e => setForm(s => ({ ...s, source: e.target.value }))} placeholder="וובינר / המלצה / פייסבוק..." /></div>
        {dup && (
          <div className="row" style={{ background: 'var(--warn-bg)', borderRadius: 9, padding: '9px 12px', marginBottom: 12 }}>
            <span className="small" style={{ color: 'var(--warn)', fontWeight: 600 }}>קיימת רשומה עם פרטים זהים: {dup.full_name}</span>
            <div className="spacer" />
            <button className="btn subtle sm" onClick={() => { onClose(); nav(`/people/${dup.id}`) }}>פתח אותה</button>
          </div>
        )}
        <div className="row">
          <button className="btn" disabled={busy || !form.full_name.trim()} onClick={create}>{busy ? <span className="spinner light" style={{ width: 15, height: 15 }} /> : dup ? 'צור בכל זאת' : 'יצירה'}</button>
          <button className="btn subtle" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}
