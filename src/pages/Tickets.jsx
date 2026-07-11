import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadOptions } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { TICKET_STATUS, URGENCY, CHANNEL, TICKET_STATUS_OPEN, TICKET_TYPES, chipColor } from '../lib/constants'
import { useColumns } from '../hooks/useColumns'
import { exportCsv } from '../lib/export'
import EditableCell from '../components/EditableCell'
import ColumnMenu from '../components/ColumnMenu'
import ViewsMenu from '../components/ViewsMenu'
import BulkBar from '../components/BulkBar'
import Icon from '../components/Icon'

const BLANK = { q: '', status: 'open', type: '', module_id: '', cycle_id: '', rep: '', urgency: '', from: '', to: '' }
const SELECT = 'id, created_at, summary, type, urgency, status, channel, handled_by, assigned_rep, module_id, cycle_id, person_id, person:people(full_name), module:modules(name), cycle:cycles(name), assignee:users!tickets_assigned_rep_fkey(full_name)'

export default function Tickets() {
  const nav = useNavigate()
  const rep = useAuthStore(s => s.rep)
  const [rows, setRows] = useState([])
  const [opts, setOpts] = useState({ reps: [], modules: [], cycles: [] })
  const [views, setViews] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [f, setF] = useState(BLANK)
  const DEFAULT_ORDER = ['created_at', 'person', 'summary', 'type', 'module', 'cycle', 'channel', 'assignee', 'urgency', 'status']
  const ctl = useColumns('tk', DEFAULT_ORDER)
  const [sel, setSel] = useState(new Set())
  const [sort, setSort] = useState({ key: 'created_at', dir: -1 })
  const [limit, setLimit] = useState(100)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const [{ data, error }, o] = await Promise.all([
          supabase.from('tickets').select(SELECT).is('deleted_at', null).order('created_at', { ascending: false }),
          loadOptions(),
        ])
        if (error) throw error
        setRows(data || []); setOpts(o)
        const { data: v } = await supabase.from('saved_views').select('*').eq('screen', 'tickets').order('name')
        setViews(v || [])
      } catch { setErr(true) } finally { setLoading(false) }
    })()
  }, [])

  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const patchRow = (id) => (field, value) => setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))

  const filtered = useMemo(() => rows.filter(r => {
    if (f.status === 'open' && !TICKET_STATUS_OPEN.includes(r.status)) return false
    if (f.status === 'closed' && r.status !== 'closed') return false
    if (f.type && r.type !== f.type) return false
    if (f.module_id && r.module_id !== f.module_id) return false
    if (f.cycle_id && r.cycle_id !== f.cycle_id) return false
    if (f.rep && r.assigned_rep !== f.rep) return false
    if (f.urgency && r.urgency !== f.urgency) return false
    if (f.from && new Date(r.created_at) < new Date(f.from)) return false
    if (f.to && new Date(r.created_at) > new Date(f.to + 'T23:59:59')) return false
    if (f.q) { const hay = `${r.summary} ${r.person?.full_name} ${r.type}`.toLowerCase(); if (!hay.includes(f.q.toLowerCase())) return false }
    return true
  }), [rows, f])

  const SORT_VAL = {
    created_at: r => r.created_at, person: r => r.person?.full_name || '', summary: r => r.summary || '',
    type: r => r.type || '', module: r => r.module?.name || '', cycle: r => r.cycle?.name || '',
    channel: r => r.channel || '', assignee: r => r.assignee?.full_name || '', urgency: r => ({ high: 3, med: 2, low: 1 }[r.urgency] || 0), status: r => r.status || '',
  }
  const sorted = useMemo(() => {
    const get = SORT_VAL[sort.key] || SORT_VAL.created_at
    return [...filtered].sort((a, b) => { const x = get(a), y = get(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir })
  }, [filtered, sort])
  const shown = sorted.slice(0, limit)
  const toggleSort = (k) => setSort(s => s.key === k ? { key: k, dir: -s.dir } : { key: k, dir: 1 })

  const applyView = (v) => setF({ ...BLANK, ...(v.filters || {}) })
  const cyclePreset = (c) => setF({ ...BLANK, status: 'open', cycle_id: c.id })
  const myOpen = () => setF({ ...BLANK, status: 'open', rep: rep?.id || '' })

  const saveView = async () => {
    const name = prompt('שם התצוגה:')
    if (!name) return
    const { data } = await supabase.from('saved_views').insert({ screen: 'tickets', name, filters: f, owner: rep?.id, shared: true }).select().single()
    if (data) setViews(v => [...v, data])
  }

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
  const COLS = {
    created_at: { label: 'תאריך', render: r => <span className="row small muted" style={{ whiteSpace: 'nowrap', gap: 6 }}>{new Date(r.created_at).toLocaleDateString('he-IL')} {aging(r)}</span> },
    person: { label: 'פונה', render: r => <span style={{ fontWeight: 600 }}>{r.person?.full_name || '-'}</span> },
    summary: { label: 'נושא', render: r => <EditableCell row={r} field="summary" mode="text" onSaved={patchRow(r.id)} placeholder="הוסף נושא" /> },
    type: { label: 'סוג', render: r => <EditableCell row={r} field="type" mode="select" options={typeOpts} onSaved={patchRow(r.id)} /> },
    module: { label: 'מודול', render: r => <EditableCell row={r} field="module_id" mode="select" options={moduleOpts} display={() => r.module?.name ? <span className="badge" style={chipColor(r.module.name)}>{r.module.name}</span> : null} onSaved={(fl, v) => { patchRow(r.id)(fl, v); patchRow(r.id)('module', { name: moduleOpts.find(o => o.value === v)?.label }) }} /> },
    cycle: { label: 'מחזור', render: r => <EditableCell row={r} field="cycle_id" mode="select" options={cycleOpts} display={() => r.cycle?.name ? <span className="badge" style={chipColor(r.cycle.name)}>{r.cycle.name}</span> : null} onSaved={(fl, v) => { patchRow(r.id)(fl, v); patchRow(r.id)('cycle', { name: cycleOpts.find(o => o.value === v)?.label }) }} /> },
    channel: { label: 'ערוץ', render: r => <span className="row small" style={{ gap: 5 }} onClick={e => e.stopPropagation()}><Icon name={CHANNEL[r.channel]?.icon || 'edit'} size={13} style={{ color: 'var(--mp)' }} /> {CHANNEL[r.channel]?.label}</span> },
    assignee: { label: 'נציג', render: r => <EditableCell row={r} field="assigned_rep" mode="select" options={repOpts} display={() => r.assignee?.full_name} onSaved={(fl, v) => { patchRow(r.id)(fl, v); patchRow(r.id)('assignee', { full_name: repOpts.find(o => o.value === v)?.label }) }} /> },
    urgency: { label: 'דחיפות', render: r => <EditableCell row={r} field="urgency" mode="select" options={urgencyOpts} display={v => <span className={`badge ${URGENCY[v]?.badge || 'gray'}`}>{URGENCY[v]?.label || '-'}</span>} onSaved={patchRow(r.id)} /> },
    status: { label: 'סטטוס', render: r => <EditableCell row={r} field="status" mode="select" options={statusOpts} display={v => <span className={`badge ${TICKET_STATUS[v]?.badge || 'gray'}`}>{TICKET_STATUS[v]?.label || '-'}</span>} onSaved={patchRow(r.id)} /> },
  }
  const order = ctl.visible.filter(k => COLS[k])
  const CSV = { created_at: r => new Date(r.created_at).toLocaleDateString('he-IL'), person: r => r.person?.full_name, summary: r => r.summary, type: r => r.type, module: r => r.module?.name, cycle: r => r.cycle?.name, channel: r => CHANNEL[r.channel]?.label, assignee: r => r.assignee?.full_name, urgency: r => URGENCY[r.urgency]?.label, status: r => TICKET_STATUS[r.status]?.label }
  const toggleSel = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allSel = filtered.length > 0 && filtered.every(r => sel.has(r.id))
  const bulkSet = async (field, value) => { await supabase.from('tickets').update({ [field]: value }).in('id', [...sel]); setRows(rs => rs.map(r => sel.has(r.id) ? { ...r, [field]: value } : r)); setSel(new Set()) }
  const bulkDelete = async () => { if (!confirm(`למחוק ${sel.size} פניות? (ניתן לשחזר מהסל)`)) return; await supabase.from('tickets').update({ deleted_at: new Date().toISOString() }).in('id', [...sel]); setRows(rs => rs.filter(r => !sel.has(r.id))); setSel(new Set()) }
  const doExport = list => exportCsv('tickets', order.map(k => COLS[k].label), list.map(r => order.map(k => CSV[k](r))))

  const clearAll = () => setF({ ...BLANK, status: 'all' })

  return (
    <div>
      {/* Toolbar */}
      <div className="toolbar">
        <ViewsMenu onDefault={clearAll} onMine={myOpen} cycles={opts.cycles} onCycle={cyclePreset} views={views} onView={applyView} />
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={16} style={{ position: 'absolute', insetInlineStart: 10, top: 10, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingInlineStart: 32, width: 230 }} placeholder="חיפוש (שם / נושא)" value={f.q} onChange={e => set('q', e.target.value)} />
        </div>
        {['open', 'closed', 'all'].map(s => (
          <button key={s} className={`chip ${f.status === s ? 'active' : ''}`} onClick={() => set('status', s)}>
            {{ open: 'פתוחות', closed: 'סגורות', all: 'הכול' }[s]}
          </button>
        ))}
        <button className={`chip ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(v => !v)}><Icon name="filter" size={15} /> סינון מתקדם</button>
        <div className="spacer" />
        <span className="muted small">{filtered.length} פניות</span>
        <ColumnMenu cols={COLS} ctl={ctl} />
        <button className="btn ghost sm" onClick={() => doExport(sorted)}><Icon name="save" size={14} /> ייצוא</button>
        <button className="btn ghost sm" onClick={saveView}><Icon name="save" size={15} /> שמור תצוגה</button>
        <button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> פנייה חדשה</button>
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            <Filter label="סוג פנייה" value={f.type} onChange={v => set('type', v)} options={typeOpts} />
            <Filter label="מודול" value={f.module_id} onChange={v => set('module_id', v)} options={moduleOpts} />
            <Filter label="מחזור" value={f.cycle_id} onChange={v => set('cycle_id', v)} options={cycleOpts} />
            <Filter label="נציג מטפל" value={f.rep} onChange={v => set('rep', v)} options={repOpts} />
            <Filter label="דחיפות" value={f.urgency} onChange={v => set('urgency', v)} options={urgencyOpts} />
            <div className="field" style={{ margin: 0 }}><label>מתאריך</label><input type="date" value={f.from} onChange={e => set('from', e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label>עד תאריך</label><input type="date" value={f.to} onChange={e => set('to', e.target.value)} /></div>
            <div className="field" style={{ margin: 0, justifyContent: 'end' }}><button className="btn subtle sm" onClick={() => setF(BLANK)}>ניקוי</button></div>
          </div>
        </div>
      )}

      {loading ? <div className="empty"><span className="spinner" /></div>
        : err ? <div className="card"><div className="empty">שגיאה בטעינת הפניות.</div></div>
        : filtered.length === 0 ? <div className="card"><div className="empty">אין פניות להצגה</div></div>
        : (
          <div className="table-wrap">
            <table className="grid" style={{ tableLayout: 'fixed', minWidth: 900 }}>
              <thead><tr>
                <th style={{ width: 36 }}><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(filtered.map(r => r.id)))} /></th>
                {order.map(k => (
                  <th key={k} draggable style={{ width: ctl.width[k], position: 'relative', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => toggleSort(k)}
                    onDragStart={() => { ctl.drag.current = k }} onDragOver={e => e.preventDefault()} onDrop={() => ctl.dropOn(k)} title="לחיצה למיון, גרירה לסידור">
                    {COLS[k].label}{sort.key === k && <span style={{ marginInlineStart: 4, color: 'var(--mp)' }}>{sort.dir === 1 ? '▲' : '▼'}</span>}
                    <span onMouseDown={e => ctl.startResize(k, e)} onClick={e => e.stopPropagation()} style={{ position: 'absolute', insetInlineStart: 0, top: 0, height: '100%', width: 6, cursor: 'col-resize' }} />
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.id} className="clickable" onClick={() => nav(`/tickets/${r.id}`)}>
                    <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggleSel(r.id)} /></td>
                    {order.map(k => <td key={k} style={{ width: ctl.width[k], overflow: 'hidden' }}>{COLS[k].render(r)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {sorted.length > limit && (
              <div style={{ textAlign: 'center', padding: 10 }}>
                <button className="btn subtle sm" onClick={() => setLimit(l => l + 100)}>הצג עוד ({sorted.length - limit} נוספות)</button>
              </div>
            )}
          </div>
        )}

      {showNew && <NewTicketModal onClose={() => setShowNew(false)} typeOpts={typeOpts} urgencyOpts={urgencyOpts}
        onCreated={t => { setRows(rs => [t, ...rs]); setShowNew(false); nav(`/tickets/${t.id}`) }} />}

      <BulkBar count={sel.size} onClear={() => setSel(new Set())}
        actions={[{ label: 'ייצוא', onClick: () => doExport(filtered.filter(r => sel.has(r.id))) }, { label: 'מחיקה', danger: true, onClick: bulkDelete }]}>
        <select className="input" style={{ height: 32 }} defaultValue="" onChange={e => { if (e.target.value) bulkSet('status', e.target.value); e.target.value = '' }}><option value="">שנה סטטוס…</option>{statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        <select className="input" style={{ height: 32 }} defaultValue="" onChange={e => { bulkSet('assigned_rep', e.target.value || null); e.target.value = '' }}><option value="">שייך נציג…</option>{repOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      </BulkBar>
    </div>
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
      .select('id, created_at, summary, type, urgency, status, channel, handled_by, assigned_rep, module_id, cycle_id, person_id, person:people(full_name), module:modules(name), cycle:cycles(name), assignee:users!tickets_assigned_rep_fkey(full_name)').single()
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

function Filter({ label, value, onChange, options }) {
  return (
    <div className="field" style={{ margin: 0 }}>
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        <option value="">הכול</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
