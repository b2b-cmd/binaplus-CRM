import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PAYMENT_TYPES } from '../lib/constants'
import { computeFinancing } from '../lib/finance'
import EditableCell from '../components/EditableCell'
import RecordFormModal from '../components/RecordFormModal'
import Icon from '../components/Icon'

const typeOpts = PAYMENT_TYPES.map(t => ({ value: t, label: t }))
const money = v => v ? `₪${Number(v).toLocaleString()}` : '-'

export default function Payments() {
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [ptype, setPtype] = useState('')
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('payments').select('*, person:people(full_name), order:orders(id)').is('deleted_at', null).order('created_at', { ascending: false })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  // When a financing input changes inline, recompute derived fields and persist them too.
  const patchFinance = (id) => async (field, value) => {
    const cur = rows.find(r => r.id === id); if (!cur) return
    const next = { ...cur, [field]: value }
    const c = computeFinancing({ amountInclVat: +next.amount_incl_vat || 0, paymentType: next.payment_type, numPayments: +next.num_payments || 1 })
    const derived = { amount_excl_vat: c.amountExclVat, per_payment: c.perPayment, financing_pct: c.pct, after_financing_incl: c.afterInclVat, after_financing_excl: c.afterExclVat }
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value, ...derived } : r))
    await supabase.from('payments').update(derived).eq('id', id) // field itself already saved by EditableCell
  }

  const types = [...new Set(rows.map(r => r.payment_type).filter(Boolean))]
  const filtered = useMemo(() => rows.filter(r => {
    if (ptype && r.payment_type !== ptype) return false
    if (q && !`${r.person?.full_name}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, q, ptype])
  const total = filtered.reduce((s, r) => s + (r.after_financing_incl || r.amount_incl_vat || 0), 0)

  return (
    <div>
      <div className="toolbar">
        <div style={{ position: 'relative' }}>
          <Icon name="search" size={16} style={{ position: 'absolute', insetInlineStart: 10, top: 10, color: 'var(--text-3)' }} />
          <input className="input" style={{ paddingInlineStart: 32, width: 220 }} placeholder="חיפוש לפי שם" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input" style={{ width: 150 }} value={ptype} onChange={e => setPtype(e.target.value)}>
          <option value="">כל האמצעים</option>{types.map(t => <option key={t}>{t}</option>)}
        </select>
        <div className="spacer" />
        <span className="muted small">{filtered.length} תשלומים · ₪{Math.round(total).toLocaleString()}</span>
        <button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> חדש</button>
      </div>
      {loading ? <div className="empty"><span className="spinner" /></div> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>לקוח</th><th>אמצעי</th><th>סכום כולל</th><th>תשלומים</th><th>לכל תשלום</th><th>%מימון</th><th>אחרי מימון</th></tr></thead>
            <tbody>{filtered.map(r => (
              <tr key={r.id} className="clickable" onClick={() => nav(`/payments/${r.id}`)}>
                <td style={{ fontWeight: 600 }}>{r.person?.full_name || '-'}</td>
                <td onClick={e => e.stopPropagation()}><EditableCell row={r} table="payments" field="payment_type" mode="select" options={typeOpts} display={v => <span className="badge mp">{v || '-'}</span>} onSaved={patchFinance(r.id)} /></td>
                <td onClick={e => e.stopPropagation()} style={{ fontWeight: 600 }}><EditableCell row={r} table="payments" field="amount_incl_vat" display={v => money(v)} onSaved={patchFinance(r.id)} /></td>
                <td onClick={e => e.stopPropagation()} className="small"><EditableCell row={r} table="payments" field="num_payments" display={v => v || 1} onSaved={patchFinance(r.id)} /></td>
                <td className="small">{money(r.per_payment)}</td>
                <td><span className="badge info">{r.financing_pct || 0}%</span></td>
                <td style={{ fontWeight: 600 }}>{money(r.after_financing_incl)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {showNew && <RecordFormModal type="payment" onClose={() => setShowNew(false)} onCreated={row => nav(`/payments/${row.id}`)} />}
    </div>
  )
}
