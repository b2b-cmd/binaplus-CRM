import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { clearOptionsCache } from '../lib/api'
import { chipColor } from '../lib/constants'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

const EMPTY = { name: '', product_id: '', lecturer_name: '', start_date: '', seats_total: '' }

export default function Cycles() {
  const nav = useNavigate()
  const [cycles, setCycles] = useState([])
  const [products, setProducts] = useState([])
  const [people, setPeople] = useState([])
  const [orders, setOrders] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [c, p, ppl, ord] = await Promise.all([
      supabase.from('cycles').select('*, product:products(name)').is('deleted_at', null).order('name'),
      supabase.from('products').select('id,name').order('name'),
      supabase.from('people').select('cycle_id, sales_status'),
      supabase.from('orders').select('cycle_id, deal_amount, status'),
    ])
    setCycles(c.data || []); setProducts(p.data || []); setPeople(ppl.data || []); setOrders(ord.data || []); setLoading(false); clearOptionsCache()
  }
  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const m = {}
    for (const c of cycles) m[c.id] = { reg: 0, dep: 0, rev: 0 }
    for (const p of people) { if (!m[p.cycle_id]) continue; if (p.sales_status === 'active_student') m[p.cycle_id].reg++; else if (['paid_deposit', 'seat_reserved'].includes(p.sales_status)) m[p.cycle_id].dep++ }
    for (const o of orders) { if (!m[o.cycle_id] || o.status === 'cancelled') continue; m[o.cycle_id].rev += o.deal_amount || 0 }
    return m
  }, [cycles, people, orders])

  const save = async () => {
    if (!form.name.trim()) return
    const { data } = await supabase.from('cycles').insert({ name: form.name.trim(), product_id: form.product_id || null, lecturer_name: form.lecturer_name || null, start_date: form.start_date || null, seats_total: form.seats_total ? parseInt(form.seats_total) : null }).select().single()
    setForm(EMPTY); setShowNew(false)
    if (data) nav(`/cycles/${data.id}`)
  }

  return (
    <div>
      <div className="toolbar"><div className="spacer" /><button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> מחזור חדש</button></div>
      {loading ? <div className="empty"><span className="spinner" /></div> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>מחזור</th><th>מוצר</th><th>מרצה</th><th>התחלה</th><th>רשומים</th><th>מקדמה</th><th>מקומות</th><th>נותרו</th><th>הכנסה</th></tr></thead>
            <tbody>{cycles.map(c => {
              const s = stats[c.id] || { reg: 0, dep: 0, rev: 0 }
              const left = c.seats_total != null ? c.seats_total - (s.reg + s.dep) : null
              const patch = (field, value) => setCycles(cs => cs.map(x => x.id === c.id ? { ...x, [field]: value, ...(field === 'product_id' ? { product: { name: products.find(p => p.id === value)?.name } } : {}) } : x))
              return (
                <tr key={c.id} className="clickable" onClick={() => nav(`/cycles/${c.id}`)}>
                  <td><EditableCell row={c} table="cycles" field="name" mode="text" display={v => <span className="badge" style={chipColor(v || '')}>{v}</span>} onSaved={patch} /></td>
                  <td className="small"><EditableCell row={c} table="cycles" field="product_id" mode="select" options={products.map(p => ({ value: p.id, label: p.name }))} display={() => c.product?.name || '-'} onSaved={patch} /></td>
                  <td className="small"><EditableCell row={c} table="cycles" field="lecturer_name" mode="text" onSaved={patch} /></td>
                  <td className="small"><EditableCell row={c} table="cycles" field="start_date" mode="text" display={v => v ? new Date(v).toLocaleDateString('he-IL') : '-'} onSaved={patch} /></td>
                  <td style={{ fontWeight: 700 }}>{s.reg}</td>
                  <td>{s.dep}</td>
                  <td><EditableCell row={c} table="cycles" field="seats_total" mode="text" onSaved={patch} /></td>
                  <td><span className={`badge ${left != null && left <= 0 ? 'err' : 'ok'}`}>{left != null ? left : '-'}</span></td>
                  <td style={{ fontWeight: 700 }}>{s.rev ? `₪${s.rev.toLocaleString()}` : '-'}</td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowNew(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 420, boxShadow: 'var(--sh3)' }} onClick={e => e.stopPropagation()}>
            <div className="card-title"><Icon name="plus" /> מחזור חדש</div>
            <Fld label="שם המחזור" v={form.name} on={v => setForm(f => ({ ...f, name: v }))} req />
            <div className="field"><label>מוצר / הכשרה</label><select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}><option value="">-</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <Fld label="מרצה ראשי" v={form.lecturer_name} on={v => setForm(f => ({ ...f, lecturer_name: v }))} />
            <div className="row" style={{ gap: 12 }}>
              <Fld label="תאריך התחלה" v={form.start_date} on={v => setForm(f => ({ ...f, start_date: v }))} type="date" ltr />
              <Fld label="סה״כ מקומות" v={form.seats_total} on={v => setForm(f => ({ ...f, seats_total: v }))} type="number" ltr />
            </div>
            <div className="row"><button className="btn" onClick={save} disabled={!form.name.trim()}>יצירה</button><button className="btn subtle" onClick={() => setShowNew(false)}>ביטול</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
function Fld({ label, v, on, type = 'text', ltr, req }) {
  return <div className="field" style={{ flex: 1 }}><label>{label}{req && <span className="req"> *</span>}</label><input type={type} dir={ltr ? 'ltr' : undefined} value={v} onChange={e => on(e.target.value)} /></div>
}
