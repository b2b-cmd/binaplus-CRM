import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { loadOptions } from '../lib/api'
import { ORDER_STATUS, chipColor } from '../lib/constants'
import EditableCell from '../components/EditableCell'
import RecordFormModal from '../components/RecordFormModal'
import Icon from '../components/Icon'

const statusOpts = Object.entries(ORDER_STATUS).map(([value, m]) => ({ value, label: m.label }))
const money = v => v ? `₪${Number(v).toLocaleString()}` : '-'

export default function Orders() {
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [opts, setOpts] = useState({ products: [], cycles: [] })
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    const [{ data }, o] = await Promise.all([
      supabase.from('orders').select('id, product_id, cycle_id, deal_amount, deposit, remaining, status, close_date, person:people(full_name), product:products(name), cycle:cycles(name)').is('deleted_at', null).order('created_at', { ascending: false }),
      loadOptions(),
    ])
    setRows(data || []); setOpts(o); setLoading(false)
  }
  useEffect(() => { load() }, [])
  const patchRow = (id) => (field, value) => setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  const productOpts = opts.products.map(p => ({ value: p.id, label: p.name }))
  const cycleOpts = opts.cycles.map(c => ({ value: c.id, label: c.name }))

  const filtered = useMemo(() => rows.filter(r => {
    if (status && r.status !== status) return false
    if (q && !`${r.person?.full_name}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, q, status])
  const total = filtered.reduce((s, r) => s + (r.deal_amount || 0), 0)

  return (
    <div>
      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={16} style={{ position: 'absolute', insetInlineStart: 10, top: 10, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingInlineStart: 32, width: 220 }} placeholder="חיפוש לפי שם" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input" style={{ width: 150 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {Object.entries(ORDER_STATUS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <div className="spacer" />
        <span className="muted small">{filtered.length} הזמנות · ₪{total.toLocaleString()}</span>
        <button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> חדש</button>
      </div>
      {loading ? <div className="empty"><span className="spinner" /></div> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>לקוח</th><th>מוצר</th><th>מחזור</th><th>סכום</th><th>מקדמה</th><th>נותר</th><th>תאריך</th><th>סטטוס</th></tr></thead>
            <tbody>{filtered.map(r => (
              <tr key={r.id} className="clickable" onClick={() => nav(`/orders/${r.id}`)}>
                <td style={{ fontWeight: 600 }}>{r.person?.full_name || '-'}</td>
                <td onClick={e => e.stopPropagation()}><EditableCell row={r} table="orders" field="product_id" mode="select" options={productOpts} display={v => productOpts.find(o => o.value === v)?.label || '-'} onSaved={patchRow(r.id)} /></td>
                <td onClick={e => e.stopPropagation()}><EditableCell row={r} table="orders" field="cycle_id" mode="select" options={cycleOpts} display={v => { const n = cycleOpts.find(o => o.value === v)?.label; return n ? <span className="badge" style={chipColor(n)}>{n}</span> : '-' }} onSaved={patchRow(r.id)} /></td>
                <td onClick={e => e.stopPropagation()} style={{ fontWeight: 600 }}><EditableCell row={r} table="orders" field="deal_amount" display={v => money(v)} onSaved={patchRow(r.id)} /></td>
                <td onClick={e => e.stopPropagation()} className="small"><EditableCell row={r} table="orders" field="deposit" display={v => money(v)} onSaved={patchRow(r.id)} /></td>
                <td className="small">{money(r.remaining)}</td>
                <td onClick={e => e.stopPropagation()} className="small"><EditableCell row={r} table="orders" field="close_date" display={v => v ? new Date(v).toLocaleDateString('he-IL') : '-'} onSaved={patchRow(r.id)} /></td>
                <td onClick={e => e.stopPropagation()}><EditableCell row={r} table="orders" field="status" mode="select" options={statusOpts} display={v => <span className={`badge ${ORDER_STATUS[v]?.badge || 'gray'}`}>{ORDER_STATUS[v]?.label || v}</span>} onSaved={patchRow(r.id)} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {showNew && <RecordFormModal type="order" onClose={() => setShowNew(false)} onCreated={row => nav(`/orders/${row.id}`)} />}
    </div>
  )
}
