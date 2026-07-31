import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useListContext, useUpdateMany, useUnselectAll, useRefresh } from 'ra-core'
import { supabase } from '../lib/supabase'
import { loadOptions } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { TICKET_STATUS, URGENCY, CHANNEL, TICKET_STATUS_OPEN, TICKET_TYPES, chipColor } from '../lib/constants'
import ResourceList from '../components/ResourceList'
import { BulkDeleteButton } from '../components/admin/bulk-delete-button'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

export default function Tickets() {
  const nav = useNavigate()
  const rep = useAuthStore(s => s.rep)
  const [opts, setOpts] = useState({ reps: [], modules: [], cycles: [] })
  const [views, setViews] = useState([])
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    loadOptions().then(setOpts)
    supabase.from('saved_views').select('*').eq('screen', 'tickets').order('name').then(({ data }) => setViews(data || []))
  }, [])

  const repOpts = opts.reps.map(r => ({ value: r.id, label: r.full_name }))
  const moduleOpts = opts.modules.map(m => ({ value: m.id, label: m.name }))
  const cycleOpts = opts.cycles.map(c => ({ value: c.id, label: c.name }))
  const typeOpts = TICKET_TYPES.map(t => ({ value: t, label: t }))
  const statusOpts = Object.entries(TICKET_STATUS).map(([k, v]) => ({ value: k, label: v.label }))
  const urgencyOpts = Object.entries(URGENCY).map(([k, v]) => ({ value: k, label: v.label }))

  // waiting-time indicator for open tickets: hours since creation, red beyond 48h
  const aging = (r) => {
    if (!TICKET_STATUS_OPEN.includes(r.status)) return null
    const h = Math.floor((Date.now() - new Date(r.created_at)) / 3600000)
    const label = h < 1 ? 'עכשיו' : h < 24 ? `${h} שע׳` : `${Math.floor(h / 24)} ימים`
    const level = h >= 48 ? 'err' : h >= 24 ? 'warn' : 'gray'
    return <span className={`badge ${level}`} style={{ fontSize: '0.66rem', padding: '1px 7px' }}>{label}</span>
  }

  const columns = [
    { source: 'created_at', label: 'תאריך', csv: r => new Date(r.created_at).toLocaleDateString('he-IL'),
      render: r => <span className="row small muted" style={{ whiteSpace: 'nowrap', gap: 6 }}>{new Date(r.created_at).toLocaleDateString('he-IL')} {aging(r)}</span> },
    { source: 'person_id', label: 'פונה', csv: r => r.person?.full_name,
      render: r => <span style={{ fontWeight: 600 }}>{r.person?.full_name || '-'}</span> },
    { source: 'summary', label: 'נושא', csv: r => r.summary,
      render: r => <Cell row={r} field="summary" placeholder="הוסף נושא" /> },
    { source: 'type', label: 'סוג', csv: r => r.type, render: r => <Cell row={r} field="type" mode="select" options={typeOpts} /> },
    { source: 'module_id', label: 'מודול', csv: r => r.module?.name,
      render: r => <Cell row={r} field="module_id" mode="select" options={moduleOpts}
        display={() => r.module?.name ? <span className="badge" style={chipColor(r.module.name)}>{r.module.name}</span> : '-'} /> },
    { source: 'cycle_id', label: 'מחזור', csv: r => r.cycle?.name,
      render: r => <Cell row={r} field="cycle_id" mode="select" options={cycleOpts}
        display={() => r.cycle?.name ? <span className="badge" style={chipColor(r.cycle.name)}>{r.cycle.name}</span> : '-'} /> },
    { source: 'channel', label: 'ערוץ', csv: r => CHANNEL[r.channel]?.label,
      render: r => <span className="row small" style={{ gap: 5 }}><Icon name={CHANNEL[r.channel]?.icon || 'edit'} size={13} style={{ color: 'var(--mp)' }} /> {CHANNEL[r.channel]?.label}</span> },
    { source: 'assigned_rep', label: 'נציג', csv: r => r.assignee?.full_name,
      render: r => <Cell row={r} field="assigned_rep" mode="select" options={repOpts} display={() => r.assignee?.full_name || '-'} /> },
    { source: 'urgency', label: 'דחיפות', csv: r => URGENCY[r.urgency]?.label,
      render: r => <Cell row={r} field="urgency" mode="select" options={urgencyOpts}
        display={v => <span className={`badge ${URGENCY[v]?.badge || 'gray'}`}>{URGENCY[v]?.label || '-'}</span>} /> },
    { source: 'status', label: 'סטטוס', csv: r => TICKET_STATUS[r.status]?.label,
      render: r => <Cell row={r} field="status" mode="select" options={statusOpts}
        display={v => <span className={`badge ${TICKET_STATUS[v]?.badge || 'gray'}`}>{TICKET_STATUS[v]?.label || '-'}</span>} /> },
  ]

  const presets = [
    { key: 'open', label: 'פתוחות', filter: { 'status@in': TICKET_STATUS_OPEN } },
    { key: 'closed', label: 'סגורות', filter: { status: 'closed' } },
    { key: 'all', label: 'הכול' },
    ...(rep?.id ? [{ key: 'mine', label: 'שלי', filter: { assigned_rep: rep.id, 'status@in': TICKET_STATUS_OPEN } }] : []),
  ]

  return (
    <>
      <ResourceList
        resource="tickets" storeKey="tk" exportName="tickets"
        sort={{ field: 'created_at', order: 'DESC' }}
        filterDefault={{ 'status@in': TICKET_STATUS_OPEN }}
        columns={columns} presets={presets}
        search="חיפוש (נושא / תיאור)"
        filtersUI={<TicketFilters typeOpts={typeOpts} moduleOpts={moduleOpts} cycleOpts={cycleOpts} repOpts={repOpts} urgencyOpts={urgencyOpts} views={views} setViews={setViews} rep={rep} />}
        rowPath={r => `/tickets/${r.id}`}
        bulkActions={<TicketBulk statusOpts={statusOpts} repOpts={repOpts} />}
        actions={<button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> פנייה חדשה</button>}
      />
      {showNew && <NewTicketModal onClose={() => setShowNew(false)} typeOpts={typeOpts} urgencyOpts={urgencyOpts}
        onCreated={t => { setShowNew(false); nav(`/tickets/${t.id}`) }} />}
    </>
  )
}

function Cell({ row, field, mode, options, display, placeholder }) {
  const refresh = useRefresh()
  return <EditableCell row={row} table="tickets" field={field} mode={mode} options={options}
    display={display} placeholder={placeholder} onSaved={() => refresh()} />
}

/* Advanced filters + saved views, both driven by the same ra filter state
   so a saved view and a manual filter can never disagree. */
function TicketFilters({ typeOpts, moduleOpts, cycleOpts, repOpts, urgencyOpts, views, setViews, rep }) {
  const { filterValues, setFilters } = useListContext()
  const [open, setOpen] = useState(false)
  const set = (k, v) => {
    const next = { ...filterValues }
    if (v) next[k] = v; else delete next[k]
    setFilters(next, null, false)
  }
  const saveView = async () => {
    const name = prompt('שם התצוגה:')
    if (!name) return
    const { data } = await supabase.from('saved_views')
      .insert({ screen: 'tickets', name, filters: filterValues, owner: rep?.id, shared: true }).select().single()
    if (data) setViews(v => [...v, data])
  }
  return (
    <>
      <button className={`chip ${open ? 'active' : ''}`} onClick={() => setOpen(o => !o)}><Icon name="filter" size={15} /> סינון מתקדם</button>
      {views.length > 0 && (
        <select className="input" style={{ width: 160 }} value="" onChange={e => {
          const v = views.find(x => x.id === e.target.value)
          if (v) setFilters(v.filters || {}, null, false)
        }}>
          <option value="">תצוגות שמורות…</option>
          {views.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      )}
      <button className="btn ghost sm" onClick={saveView}><Icon name="save" size={15} /> שמור תצוגה</button>
      {open && (
        <div className="card" style={{ padding: 16, marginTop: 12, width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            <Fl label="סוג פנייה" value={filterValues?.type} onChange={v => set('type', v)} options={typeOpts} />
            <Fl label="מודול" value={filterValues?.module_id} onChange={v => set('module_id', v)} options={moduleOpts} />
            <Fl label="מחזור" value={filterValues?.cycle_id} onChange={v => set('cycle_id', v)} options={cycleOpts} />
            <Fl label="נציג מטפל" value={filterValues?.assigned_rep} onChange={v => set('assigned_rep', v)} options={repOpts} />
            <Fl label="דחיפות" value={filterValues?.urgency} onChange={v => set('urgency', v)} options={urgencyOpts} />
            <div className="field" style={{ margin: 0 }}><label>מתאריך</label>
              <input type="date" value={filterValues?.['created_at@gte'] || ''} onChange={e => set('created_at@gte', e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label>עד תאריך</label>
              <input type="date" value={filterValues?.['created_at@lte'] || ''} onChange={e => set('created_at@lte', e.target.value ? e.target.value + 'T23:59:59' : '')} /></div>
            <div className="field" style={{ margin: 0, justifyContent: 'end' }}>
              <button className="btn subtle sm" onClick={() => setFilters({}, null, false)}>ניקוי</button></div>
          </div>
        </div>
      )}
    </>
  )
}

function Fl({ label, value, onChange, options }) {
  return (
    <div className="field" style={{ margin: 0 }}>
      <label>{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="">הכול</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function TicketBulk({ statusOpts, repOpts }) {
  const { selectedIds } = useListContext()
  const unselect = useUnselectAll('tickets')
  const [updateMany] = useUpdateMany()
  const apply = (field, value) =>
    updateMany('tickets', { ids: selectedIds, data: { [field]: value || null } }, { onSuccess: () => unselect() })
  return (
    <>
      <select className="input" style={{ height: 32 }} defaultValue=""
        onChange={e => { if (e.target.value) apply('status', e.target.value); e.target.value = '' }}>
        <option value="">שנה סטטוס…</option>{statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select className="input" style={{ height: 32 }} defaultValue=""
        onChange={e => { apply('assigned_rep', e.target.value); e.target.value = '' }}>
        <option value="">שייך נציג…</option>{repOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <BulkDeleteButton />
    </>
  )
}

function NewTicketModal({ onClose, onCreated, typeOpts, urgencyOpts }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [person, setPerson] = useState(null)
  const [form, setForm] = useState({ type: '', urgency: 'med', summary: '', description: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('people').select('id, full_name, phone, email')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`).is('deleted_at', null).limit(6)
      setResults(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const create = async () => {
    if (!form.summary.trim()) return
    setBusy(true)
    const { data } = await supabase.from('tickets')
      .insert({ person_id: person?.id || null, type: form.type || null, urgency: form.urgency, summary: form.summary.trim(), description: form.description.trim() || null, channel: 'manual', status: 'new' })
      .select('id').single()
    setBusy(false)
    if (data) onCreated(data)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 460, boxShadow: 'var(--sh3)' }} onClick={e => e.stopPropagation()}>
        <div className="card-title"><Icon name="plus" /> פנייה חדשה</div>
        <div className="field">
          <label>תלמיד / פונה</label>
          {person
            ? <div className="row" style={{ background: 'var(--xlp)', borderRadius: 9, padding: '8px 12px' }}>
                <b className="small">{person.full_name}</b><span className="muted small" dir="ltr">{person.phone || person.email}</span>
                <div className="spacer" /><button className="btn subtle sm" onClick={() => setPerson(null)}><Icon name="x" size={13} /></button>
              </div>
            : <>
                <input placeholder="חיפוש לפי שם / טלפון / מייל" value={q} onChange={e => setQ(e.target.value)} />
                {results.length > 0 && (
                  <div style={{ border: '1px solid var(--border-soft)', borderRadius: 9, marginTop: 4, overflow: 'hidden' }}>
                    {results.map(p => (
                      <div key={p.id} className="row small clickable" style={{ padding: '7px 11px', borderBottom: '1px solid var(--border-soft)' }} onClick={() => { setPerson(p); setQ('') }}>
                        <b>{p.full_name}</b><span className="muted" dir="ltr">{p.phone || p.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>}
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>סוג פנייה</label>
            <select value={form.type} onChange={e => setForm(s => ({ ...s, type: e.target.value }))}><option value="">בחרו...</option>{typeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div className="field" style={{ flex: 1 }}><label>דחיפות</label>
            <select value={form.urgency} onChange={e => setForm(s => ({ ...s, urgency: e.target.value }))}>{urgencyOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
        </div>
        <div className="field"><label>נושא <span className="req">*</span></label><input value={form.summary} onChange={e => setForm(s => ({ ...s, summary: e.target.value }))} /></div>
        <div className="field"><label>תיאור</label><textarea value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))} style={{ minHeight: 70 }} /></div>
        <div className="row">
          <button className="btn" disabled={busy || !form.summary.trim()} onClick={create}>{busy ? <span className="spinner light" style={{ width: 15, height: 15 }} /> : 'יצירת פנייה'}</button>
          <button className="btn subtle" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}
