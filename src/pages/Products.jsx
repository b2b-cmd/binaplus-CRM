import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRefresh } from 'ra-core'
import { supabase } from '../lib/supabase'
import { clearOptionsCache } from '../lib/api'
import { chipColor } from '../lib/constants'
import ResourceList from '../components/ResourceList'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

const TYPES = ['דיגיטלי', 'לייב + דיגיטלי', 'פרונטלי', 'פרונטלי + דיגיטלי', 'אחר']
const EMPTY = { name: '', type: '', price_before_vat: '', price_after_vat: '', payment_url: '', syllabus_url: '', info: '' }
const money = v => v ? `₪${Number(v).toLocaleString()}` : '-'
const num = s => { const n = parseFloat(String(s).replace(/[^\d.]/g, '')); return isNaN(n) ? null : n }

export default function Products() {
  const nav = useNavigate()
  const [showNew, setShowNew] = useState(false)

  const columns = [
    { source: 'name', label: 'שם', csv: r => r.name,
      render: r => <span style={{ fontWeight: 700 }}><Cell row={r} field="name"
        display={v => v ? <span className="badge" style={chipColor(v)}>{v}</span> : '-'} /></span> },
    { source: 'type', label: 'סוג', csv: r => r.type,
      render: r => <Cell row={r} field="type" mode="select" options={TYPES.map(t => ({ value: t, label: t }))}
        display={v => v ? <span className="badge mp">{v}</span> : '-'} /> },
    { source: 'price_before_vat', label: 'לפני מע"מ', csv: r => r.price_before_vat,
      render: r => <span className="small"><Cell row={r} field="price_before_vat" display={money} /></span> },
    { source: 'price_after_vat', label: 'אחרי מע"מ', csv: r => r.price_after_vat,
      render: r => <span className="small"><Cell row={r} field="price_after_vat" display={money} /></span> },
    { source: 'payment_url', label: 'לינקים', sortable: false, csv: r => [r.payment_url, r.syllabus_url].filter(Boolean).join(' '),
      render: r => (
        <span className="small" onClick={e => e.stopPropagation()}>
          {r.payment_url && <a href={r.payment_url} target="_blank" rel="noreferrer">תשלום</a>}
          {r.payment_url && r.syllabus_url && ' · '}
          {r.syllabus_url && <a href={r.syllabus_url} target="_blank" rel="noreferrer">סילבוס</a>}
          {!r.payment_url && !r.syllabus_url && '-'}
        </span>) },
  ]

  return (
    <>
      <ResourceList
        resource="products" storeKey="prd" exportName="products"
        sort={{ field: 'name', order: 'ASC' }}
        columns={columns} search="חיפוש מוצר"
        rowPath={r => `/products/${r.id}`}
        actions={<button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> מוצר חדש</button>}
      />
      {showNew && <NewProduct onClose={() => setShowNew(false)} onCreated={p => nav(`/products/${p.id}`)} />}
    </>
  )
}

function Cell({ row, field, mode, options, display }) {
  const refresh = useRefresh()
  return <EditableCell row={row} table="products" field={field} mode={mode} options={options}
    display={display} onSaved={() => refresh()} />
}

function NewProduct({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY)
  const save = async () => {
    if (!form.name.trim()) return
    const { data } = await supabase.from('products').insert({
      ...form, price_before_vat: num(form.price_before_vat), price_after_vat: num(form.price_after_vat),
    }).select().single()
    clearOptionsCache()
    if (data) onCreated(data)
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 440, boxShadow: 'var(--sh3)' }} onClick={e => e.stopPropagation()}>
        <div className="card-title"><Icon name="plus" /> מוצר חדש</div>
        <Fld label="שם" v={form.name} on={v => setForm(f => ({ ...f, name: v }))} req />
        <div className="field"><label>סוג</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="">בחרו…</option>{TYPES.map(t => <option key={t}>{t}</option>)}
          </select></div>
        <div className="row" style={{ gap: 12 }}>
          <Fld label='מחיר לפני מע"מ' v={form.price_before_vat} on={v => setForm(f => ({ ...f, price_before_vat: v }))} type="number" ltr />
          <Fld label='מחיר אחרי מע"מ' v={form.price_after_vat} on={v => setForm(f => ({ ...f, price_after_vat: v }))} type="number" ltr />
        </div>
        <Fld label="לינק לדף תשלום" v={form.payment_url} on={v => setForm(f => ({ ...f, payment_url: v }))} ltr />
        <Fld label="לינק לסילבוס" v={form.syllabus_url} on={v => setForm(f => ({ ...f, syllabus_url: v }))} ltr />
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
