import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { clearOptionsCache } from '../lib/api'
import { chipColor } from '../lib/constants'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

const TYPES = ['דיגיטלי', 'לייב + דיגיטלי', 'פרונטלי', 'פרונטלי + דיגיטלי', 'אחר']
const EMPTY = { name: '', type: '', price_before_vat: '', price_after_vat: '', payment_url: '', syllabus_url: '', info: '' }
const money = v => v ? `₪${Number(v).toLocaleString()}` : '-'
const num = s => { const n = parseFloat(String(s).replace(/[^\d.]/g, '')); return isNaN(n) ? null : n }

export default function Products() {
  const nav = useNavigate()
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => { const { data } = await supabase.from('products').select('*').is('deleted_at', null).order('name'); setItems(data || []); setLoading(false); clearOptionsCache() }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim()) return
    const { data } = await supabase.from('products').insert({ ...form, price_before_vat: num(form.price_before_vat), price_after_vat: num(form.price_after_vat) }).select().single()
    setForm(EMPTY); setShowNew(false)
    if (data) nav(`/products/${data.id}`)
  }

  return (
    <div>
      <div className="toolbar"><div className="spacer" /><button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> מוצר חדש</button></div>
      {loading ? <div className="empty"><span className="spinner" /></div> : (
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>שם</th><th>סוג</th><th>לפני מע"מ</th><th>אחרי מע"מ</th><th>לינקים</th></tr></thead>
            <tbody>{items.map(it => {
              const patch = (field, value) => setItems(xs => xs.map(x => x.id === it.id ? { ...x, [field]: value } : x))
              return (
              <tr key={it.id} className="clickable" onClick={() => nav(`/products/${it.id}`)}>
                <td style={{ fontWeight: 700 }}><EditableCell row={it} table="products" field="name" mode="text" display={v => v ? <span className="badge" style={chipColor(v)}>{v}</span> : '-'} onSaved={patch} /></td>
                <td><EditableCell row={it} table="products" field="type" mode="select" options={TYPES.map(t => ({ value: t, label: t }))} display={v => v ? <span className="badge mp">{v}</span> : '-'} onSaved={patch} /></td>
                <td className="small"><EditableCell row={it} table="products" field="price_before_vat" mode="text" display={money} onSaved={patch} /></td>
                <td className="small"><EditableCell row={it} table="products" field="price_after_vat" mode="text" display={money} onSaved={patch} /></td>
                <td className="small" onClick={e => e.stopPropagation()}>{it.payment_url && <a href={it.payment_url} target="_blank" rel="noreferrer">תשלום</a>}{it.payment_url && it.syllabus_url && ' · '}{it.syllabus_url && <a href={it.syllabus_url} target="_blank" rel="noreferrer">סילבוס</a>}{!it.payment_url && !it.syllabus_url && '-'}</td>
              </tr>
            )})}</tbody>
          </table>
        </div>
      )}

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,40,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowNew(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 440, boxShadow: 'var(--sh3)' }} onClick={e => e.stopPropagation()}>
            <div className="card-title"><Icon name="plus" /> מוצר חדש</div>
            <Fld label="שם" v={form.name} on={v => setForm(f => ({ ...f, name: v }))} req />
            <div className="field"><label>סוג</label><select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}><option value="">בחרו…</option>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div className="row" style={{ gap: 12 }}>
              <Fld label='מחיר לפני מע"מ' v={form.price_before_vat} on={v => setForm(f => ({ ...f, price_before_vat: v }))} type="number" ltr />
              <Fld label='מחיר אחרי מע"מ' v={form.price_after_vat} on={v => setForm(f => ({ ...f, price_after_vat: v }))} type="number" ltr />
            </div>
            <Fld label="לינק לדף תשלום" v={form.payment_url} on={v => setForm(f => ({ ...f, payment_url: v }))} ltr />
            <Fld label="לינק לסילבוס" v={form.syllabus_url} on={v => setForm(f => ({ ...f, syllabus_url: v }))} ltr />
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
