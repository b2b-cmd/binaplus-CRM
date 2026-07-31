import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRefresh } from 'ra-core'
import { supabase } from '../lib/supabase'
import { clearOptionsCache } from '../lib/api'
import { chipColor } from '../lib/constants'
import ResourceList from '../components/ResourceList'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

const EMPTY = { name: '', product_id: '', lecturer_name: '', start_date: '', seats_total: '' }

export default function Cycles() {
  const nav = useNavigate()
  const [products, setProducts] = useState([])
  const [people, setPeople] = useState([])
  const [orders, setOrders] = useState([])
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    (async () => {
      const [p, ppl, ord] = await Promise.all([
        supabase.from('products').select('id,name').order('name'),
        supabase.from('people').select('cycle_id, sales_status'),
        supabase.from('orders').select('cycle_id, deal_amount, status'),
      ])
      setProducts(p.data || []); setPeople(ppl.data || []); setOrders(ord.data || [])
      clearOptionsCache()
    })()
  }, [])

  /* Registration / deposit / revenue are aggregates over people+orders, not
     columns on cycles, so they are computed client-side and are therefore
     not sortable server-side. */
  const stats = useMemo(() => {
    const m = {}
    const at = id => (m[id] ||= { reg: 0, dep: 0, rev: 0 })
    for (const p of people) {
      if (!p.cycle_id) continue
      if (p.sales_status === 'active_student') at(p.cycle_id).reg++
      else if (['paid_deposit', 'seat_reserved'].includes(p.sales_status)) at(p.cycle_id).dep++
    }
    for (const o of orders) { if (o.cycle_id && o.status !== 'cancelled') at(o.cycle_id).rev += o.deal_amount || 0 }
    return m
  }, [people, orders])

  const st = c => stats[c.id] || { reg: 0, dep: 0, rev: 0 }
  const left = c => c.seats_total != null ? c.seats_total - (st(c).reg + st(c).dep) : null
  const productOpts = products.map(p => ({ value: p.id, label: p.name }))

  const columns = [
    { source: 'name', label: 'מחזור', csv: r => r.name,
      render: r => <Cell row={r} field="name" display={v => <span className="badge" style={chipColor(v || '')}>{v}</span>} /> },
    { source: 'product_id', label: 'מוצר', csv: r => r.product?.name,
      render: r => <Cell row={r} field="product_id" mode="select" options={productOpts}
        display={() => r.product?.name ? <span className="badge" style={chipColor(r.product.name)}>{r.product.name}</span> : '-'} /> },
    { source: 'lecturer_name', label: 'מרצה', csv: r => r.lecturer_name, render: r => <Cell row={r} field="lecturer_name" /> },
    { source: 'start_date', label: 'התחלה', csv: r => r.start_date,
      render: r => <Cell row={r} field="start_date" display={v => v ? new Date(v).toLocaleDateString('he-IL') : '-'} /> },
    { source: 'reg', label: 'רשומים', sortable: false, csv: r => st(r).reg,
      render: r => <span style={{ fontWeight: 700 }}>{st(r).reg}</span> },
    { source: 'dep', label: 'מקדמה', sortable: false, csv: r => st(r).dep, render: r => st(r).dep },
    { source: 'seats_total', label: 'מקומות', csv: r => r.seats_total, render: r => <Cell row={r} field="seats_total" /> },
    { source: 'left', label: 'נותרו', sortable: false, csv: r => left(r),
      render: r => <span className={`badge ${left(r) != null && left(r) <= 0 ? 'err' : 'ok'}`}>{left(r) != null ? left(r) : '-'}</span> },
    { source: 'revenue', label: 'הכנסה', sortable: false, csv: r => st(r).rev,
      render: r => <span style={{ fontWeight: 700 }}>{st(r).rev ? `₪${st(r).rev.toLocaleString()}` : '-'}</span> },
  ]

  return (
    <>
      <ResourceList
        resource="cycles" storeKey="cy" exportName="cycles"
        sort={{ field: 'start_date', order: 'DESC' }}
        columns={columns} search="חיפוש מחזור / מרצה"
        rowPath={r => `/cycles/${r.id}`}
        actions={<button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> מחזור חדש</button>}
      />
      {showNew && <NewCycle products={products} onClose={() => setShowNew(false)} onCreated={c => nav(`/cycles/${c.id}`)} />}
    </>
  )
}

function Cell({ row, field, mode, options, display }) {
  const refresh = useRefresh()
  return <EditableCell row={row} table="cycles" field={field} mode={mode} options={options}
    display={display} onSaved={() => refresh()} />
}

function NewCycle({ products, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const save = async () => {
    if (!form.name.trim()) return
    const { data } = await supabase.from('cycles').insert({
      name: form.name.trim(), product_id: form.product_id || null, lecturer_name: form.lecturer_name || null,
      start_date: form.start_date || null, seats_total: form.seats_total ? parseInt(form.seats_total) : null,
    }).select().single()
    clearOptionsCache()
    if (data) onCreated(data)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 420, boxShadow: 'var(--sh3)' }} onClick={e => e.stopPropagation()}>
        <div className="card-title"><Icon name="plus" /> מחזור חדש</div>
        <Fld label="שם המחזור" v={form.name} on={v => setForm(f => ({ ...f, name: v }))} req />
        <div className="field"><label>מוצר / הכשרה</label>
          <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
            <option value="">-</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <Fld label="מרצה ראשי" v={form.lecturer_name} on={v => setForm(f => ({ ...f, lecturer_name: v }))} />
        <div className="row" style={{ gap: 12 }}>
          <Fld label="תאריך התחלה" v={form.start_date} on={v => setForm(f => ({ ...f, start_date: v }))} type="date" ltr />
          <Fld label="סה״כ מקומות" v={form.seats_total} on={v => setForm(f => ({ ...f, seats_total: v }))} type="number" ltr />
        </div>
        <div className="row">
          <button className="btn" onClick={save} disabled={!form.name.trim()}>יצירה</button>
          <button className="btn subtle" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  )
}

function Fld({ label, v, on, type = 'text', ltr, req }) {
  return <div className="field" style={{ flex: 1 }}><label>{label}{req && <span className="req"> *</span>}</label><input type={type} dir={ltr ? 'ltr' : undefined} value={v} onChange={e => on(e.target.value)} /></div>
}
