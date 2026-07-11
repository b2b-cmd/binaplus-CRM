import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadOptions, updateField } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { SALES_STATUS_META, chipColor } from '../lib/constants'
import { useColumns } from '../hooks/useColumns'
import { exportCsv } from '../lib/export'
import EditableCell from '../components/EditableCell'
import ColumnMenu from '../components/ColumnMenu'
import BulkBar from '../components/BulkBar'
import Icon from '../components/Icon'

const salesOpts = Object.entries(SALES_STATUS_META).map(([value, v]) => ({ value, label: v.label }))
const SELECT = 'id, full_name, phone, email, source, entry_date, sales_status, assigned_sales_rep, product_id, cycle_id, product:products(name), cycle:cycles(name), rep:users!people_assigned_sales_rep_fkey(full_name)'
const DEFAULT_ORDER = ['full_name', 'phone', 'email', 'product', 'cycle', 'source', 'entry_date', 'rep', 'sales_status']

export default function People() {
  const nav = useNavigate()
  const rep = useAuthStore(s => s.rep)
  const [rows, setRows] = useState([])
  const [opts, setOpts] = useState({ products: [], cycles: [], reps: [] })
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [view, setView] = useState('all')
  const [f, setF] = useState({ product_id: '', cycle_id: '' })
  const [sel, setSel] = useState(new Set())
  const ctl = useColumns('ld', DEFAULT_ORDER)

  const load = async () => {
    const [{ data }, o] = await Promise.all([
      supabase.from('people').select(SELECT).is('deleted_at', null).order('created_at', { ascending: false }),
      loadOptions(),
    ])
    setRows(data || []); setOpts(o); setLoading(false)
  }
  useEffect(() => { load() }, [])
  const patchRow = (id) => (field, value) => setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))

  const productOpts = opts.products.map(p => ({ value: p.id, label: p.name }))
  const cycleOpts = opts.cycles.map(c => ({ value: c.id, label: c.name }))
  const repOpts = opts.reps.map(r => ({ value: r.id, label: r.full_name }))
  const nameOf = (list, id) => list.find(o => o.value === id)?.label
  const COLS = {
    full_name: { label: 'שם', get: r => <span style={{ fontWeight: 600, color: 'var(--mp)' }}>{r.full_name || '-'}</span>, csv: r => r.full_name },
    phone: { label: 'טלפון', get: r => <EditableCell row={r} table="people" field="phone" display={v => <span className="small" dir="ltr">{v || '-'}</span>} onSaved={patchRow(r.id)} />, csv: r => r.phone },
    email: { label: 'מייל', get: r => <EditableCell row={r} table="people" field="email" display={v => <span className="small" dir="ltr">{v || '-'}</span>} onSaved={patchRow(r.id)} />, csv: r => r.email },
    product: { label: 'מוצר', get: r => <EditableCell row={r} table="people" field="product_id" mode="select" options={productOpts} display={v => nameOf(productOpts, v) || '-'} onSaved={patchRow(r.id)} />, csv: r => r.product?.name },
    cycle: { label: 'מחזור', get: r => <EditableCell row={r} table="people" field="cycle_id" mode="select" options={cycleOpts} display={v => { const n = nameOf(cycleOpts, v); return n ? <span className="badge" style={chipColor(n)}>{n}</span> : '-' }} onSaved={patchRow(r.id)} />, csv: r => r.cycle?.name },
    source: { label: 'מקור', get: r => <EditableCell row={r} table="people" field="source" display={v => v || '-'} onSaved={patchRow(r.id)} />, csv: r => r.source },
    entry_date: { label: 'תאריך כניסה', get: r => <EditableCell row={r} table="people" field="entry_date" display={v => v ? new Date(v).toLocaleDateString('he-IL') : '-'} onSaved={patchRow(r.id)} />, csv: r => r.entry_date },
    rep: { label: 'נציג', get: r => <EditableCell row={r} table="people" field="assigned_sales_rep" mode="select" options={repOpts} display={v => nameOf(repOpts, v) || '-'} onSaved={patchRow(r.id)} />, csv: r => r.rep?.full_name },
    sales_status: { label: 'סטטוס', get: r => <EditableCell row={r} table="people" field="sales_status" mode="select" options={salesOpts} display={v => <span className={`badge ${SALES_STATUS_META[v]?.badge || 'gray'}`}>{SALES_STATUS_META[v]?.label || '-'}</span>} onSaved={patchRow(r.id)} />, csv: r => SALES_STATUS_META[r.sales_status]?.label },
  }

  const PRESETS = [{ k: 'all', label: 'הכול' }, { k: 'new_lead', label: 'לידים חדשים' }, { k: 'followup', label: 'בפולואפ' }, { k: 'no_answer', label: 'ללא מענה' }, { k: 'active_student', label: 'תלמידים פעילים' }, { k: 'cancelled', label: 'בוטלו' }, { k: 'mine', label: 'שלי' }]
  const filtered = useMemo(() => rows.filter(r => {
    if (view === 'mine') { if (r.assigned_sales_rep !== rep?.id) return false } else if (view !== 'all' && r.sales_status !== view) return false
    if (f.product_id && r.product?.name !== opts.products.find(p => p.id === f.product_id)?.name) return false
    if (f.cycle_id && r.cycle?.name !== opts.cycles.find(c => c.id === f.cycle_id)?.name) return false
    if (q && !`${r.full_name} ${r.phone} ${r.email}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, view, f, q, rep, opts])

  const [showNew, setShowNew] = useState(false)
  const toggleSel = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSel = filtered.length > 0 && filtered.every(r => sel.has(r.id))
  const bulkStatus = async (v) => { const ids = [...sel]; await supabase.from('people').update({ sales_status: v }).in('id', ids); setRows(rs => rs.map(r => sel.has(r.id) ? { ...r, sales_status: v } : r)); setSel(new Set()) }
  const bulkRep = async (v) => { await supabase.from('people').update({ assigned_sales_rep: v || null }).in('id', [...sel]); load(); setSel(new Set()) }
  const bulkDelete = async () => { if (!confirm(`למחוק ${sel.size} רשומות? (ניתן לשחזר מהסל)`)) return; await supabase.from('people').update({ deleted_at: new Date().toISOString() }).in('id', [...sel]); setRows(rs => rs.filter(r => !sel.has(r.id))); setSel(new Set()) }
  const doExport = (list) => exportCsv('leads', ctl.visible.map(k => COLS[k].label), list.map(r => ctl.visible.map(k => COLS[k].csv(r))))

  return (
    <div>
      <div className="toolbar">
        {PRESETS.map(p => <button key={p.k} className={`chip ${view === p.k ? 'active' : ''}`} onClick={() => setView(p.k)}>{p.label}</button>)}
        <div className="spacer" />
        <ColumnMenu cols={COLS} ctl={ctl} />
        <button className="btn ghost sm" onClick={() => doExport(filtered)}><Icon name="save" size={14} /> ייצוא</button>
        <button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> חדש</button>
      </div>
      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={16} style={{ position: 'absolute', insetInlineStart: 10, top: 10, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingInlineStart: 32, width: 220 }} placeholder="שם / טלפון / מייל" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input" style={{ width: 150 }} value={f.product_id} onChange={e => setF(s => ({ ...s, product_id: e.target.value }))}><option value="">כל המוצרים</option>{opts.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="input" style={{ width: 150 }} value={f.cycle_id} onChange={e => setF(s => ({ ...s, cycle_id: e.target.value }))}><option value="">כל המחזורים</option>{opts.cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <div className="spacer" /><span className="muted small">{filtered.length} רשומות</span>
      </div>

      {loading ? <div className="empty"><span className="spinner" /></div> : (
        <div className="table-wrap">
          <table className="grid" style={{ tableLayout: 'fixed', minWidth: 800 }}>
            <thead><tr>
              <th style={{ width: 36 }}><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(filtered.map(r => r.id)))} /></th>
              {ctl.visible.map(k => (
                <th key={k} draggable style={{ width: ctl.width[k], position: 'relative', cursor: 'grab', userSelect: 'none' }}
                  onDragStart={() => { ctl.drag.current = k }} onDragOver={e => e.preventDefault()} onDrop={() => ctl.dropOn(k)}>
                  {COLS[k].label}<span onMouseDown={e => ctl.startResize(k, e)} style={{ position: 'absolute', insetInlineStart: 0, top: 0, height: '100%', width: 6, cursor: 'col-resize' }} />
                </th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="clickable" onClick={() => nav(`/people/${r.id}`)}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                  {ctl.visible.map(k => <td key={k} style={{ width: ctl.width[k], overflow: 'hidden' }} onClick={k !== 'full_name' ? e => e.stopPropagation() : undefined}>{COLS[k].get(r)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BulkBar count={sel.size} onClear={() => setSel(new Set())}
        actions={[{ label: 'ייצוא', onClick: () => doExport(filtered.filter(r => sel.has(r.id))) }, { label: 'מחיקה', danger: true, onClick: bulkDelete }]}>
        <select className="input" style={{ height: 32 }} defaultValue="" onChange={e => { if (e.target.value) bulkStatus(e.target.value); e.target.value = '' }}><option value="">שנה סטטוס…</option>{salesOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select className="input" style={{ height: 32 }} defaultValue="" onChange={e => { bulkRep(e.target.value); e.target.value = '' }}><option value="">שייך נציג…</option>{opts.reps.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}</select>
      </BulkBar>

      {showNew && <NewPersonModal onClose={() => setShowNew(false)} onCreated={p => nav(`/people/${p.id}`)} />}
    </div>
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
