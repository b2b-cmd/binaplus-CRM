import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateField, loadOptions } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { ORDER_STATUS, PAYMENT_TYPES } from '../lib/constants'
import { computeFinancing } from '../lib/finance'
import RecordLayout from '../components/RecordLayout'
import EditField from '../components/EditField'
import Icon from '../components/Icon'

const STAGES = [{ key: 'awaiting', label: 'ממתין' }, { key: 'deposit', label: 'מקדמה' }, { key: 'paid_full', label: 'שולם' }]

export default function OrderDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const rep = useAuthStore(s => s.rep)
  const [o, setO] = useState(null)
  const [payments, setPayments] = useState([])
  const [opts, setOpts] = useState({ products: [], cycles: [], reps: [] })
  const [loading, setLoading] = useState(true)
  const [pay, setPay] = useState({ amount: '', payment_type: 'אשראי', num_payments: 1 })

  const load = async () => {
    const { data } = await supabase.from('orders').select('*, product:products(name), cycle:cycles(name), person:people(id,full_name), opportunity:opportunities(id)').eq('id', id).single()
    setO(data)
    const [{ data: pays }, oo] = await Promise.all([supabase.from('payments').select('*').eq('order_id', id).order('created_at'), loadOptions()])
    setPayments(pays || []); setOpts(oo); setLoading(false)
  }
  useEffect(() => { load() }, [id])
  const save = (field, value) => {
    setO(x => ({ ...x, [field]: value })); updateField('orders', o, field, value)
    // the person's cycle follows the order (used for attendance grouping)
    if (field === 'cycle_id' && value && o.person_id) supabase.from('people').update({ cycle_id: value }).eq('id', o.person_id).then(() => {}, () => {})
  }

  const calc = useMemo(() => computeFinancing({ amountInclVat: parseFloat(pay.amount) || 0, paymentType: pay.payment_type, numPayments: parseInt(pay.num_payments) || 1 }), [pay])
  const addPayment = async () => {
    const amt = parseFloat(pay.amount); if (!amt) return
    const { data } = await supabase.from('payments').insert({
      order_id: id, person_id: o.person_id, opportunity_id: o.opportunity_id, amount_incl_vat: amt, amount_excl_vat: calc.amountExclVat,
      payment_type: pay.payment_type, num_payments: parseInt(pay.num_payments) || 1, per_payment: calc.perPayment,
      financing_pct: calc.pct, after_financing_incl: calc.afterInclVat, after_financing_excl: calc.afterExclVat, owner: rep?.id,
    }).select().single()
    if (data) { setPayments(p => [...p, data]); setPay({ amount: '', payment_type: 'אשראי', num_payments: 1 }) }
  }

  if (loading) return <div className="empty"><span className="spinner" /></div>
  if (!o) return <div className="card"><div className="empty">הזמנה לא נמצאה.</div></div>

  const money = v => v ? `₪${Number(v).toLocaleString()}` : '-'
  const related = [
    o.person && { key: 'person', label: 'לקוח', count: 1, rows: [o.person], onOpen: r => `/people/${r.id}`, columns: [{ label: 'שם', get: r => r.full_name }] },
    o.opportunity && { key: 'opp', label: 'הזדמנות', count: 1, rows: [o.opportunity], onOpen: r => `/opportunities/${r.id}`, columns: [{ label: 'הזדמנות', get: () => 'פתח' }] },
    { key: 'pay', resource: 'payments', fk: 'order_id', recordId: id, label: 'תשלומים', count: payments.length, rows: payments, onOpen: r => `/payments/${r.id}`, columns: [{ label: 'אמצעי', get: r => r.payment_type }, { label: 'סכום', get: r => money(r.amount_incl_vat) }] },
  ].filter(Boolean)

  return (
    <RecordLayout title={`הזמנה - ${o.person?.full_name || ''}`} backTo="/orders" objectType="orders" recordId={id} table="orders"
      recordType="order" record={o} onRelatedCreated={() => load()}
      status={{ label: ORDER_STATUS[o.status]?.label, badge: ORDER_STATUS[o.status]?.badge }} related={related}
      stage={{ stages: STAGES, current: o.status, onSet: v => save('status', v) }}>
      <div className="card">
        <div className="field-grid">
          <EditField label="סכום עסקה" value={o.deal_amount} display={money(o.deal_amount)} type="number" onSave={v => save('deal_amount', v)} />
          <EditField label="מקדמה" value={o.deposit} display={money(o.deposit)} type="number" onSave={v => save('deposit', v)} />
          <EditField label="נותר לתשלום" value={o.remaining} display={money(o.remaining)} type="number" onSave={v => save('remaining', v)} />
          <EditField label="סטטוס" value={o.status} display={ORDER_STATUS[o.status]?.label} type="select" options={Object.entries(ORDER_STATUS).map(([k, m]) => ({ value: k, label: m.label }))} onSave={v => save('status', v)} />
          <EditField label="תאריך סגירה" value={o.close_date} type="date" onSave={v => save('close_date', v)} />
          <EditField label="מוצר" value={o.product_id} display={o.product?.name} type="select" options={opts.products.map(p => ({ value: p.id, label: p.name }))} onSave={v => save('product_id', v)} />
          <EditField label="מחזור" value={o.cycle_id} display={o.cycle?.name} type="select" options={opts.cycles.map(c => ({ value: c.id, label: c.name }))} onSave={v => save('cycle_id', v)} />
          <EditField label="נציג" value={o.owner} display={opts.reps.find(r => r.id === o.owner)?.full_name} type="select" options={opts.reps.map(r => ({ value: r.id, label: r.full_name }))} onSave={v => save('owner', v)} />
          <EditField label="סטטוס הסכם" value={o.agreement_status} onSave={v => save('agreement_status', v)} />
        </div>
        <div style={{ marginTop: 8 }}><EditField label="הערות גבייה" value={o.collection_notes} type="textarea" onSave={v => save('collection_notes', v)} /></div>
      </div>

      <div className="card">
        <div className="card-title"><Icon name="money" /> תשלומים ומימון</div>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--rs)', padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field" style={{ margin: 0 }}><label>סכום כולל מע"מ</label><input type="number" dir="ltr" value={pay.amount} onChange={e => setPay(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="field" style={{ margin: 0 }}><label>אמצעי תשלום</label><select value={pay.payment_type} onChange={e => setPay(p => ({ ...p, payment_type: e.target.value }))}>{PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div className="field" style={{ margin: 0 }}><label>מספר תשלומים</label><input type="number" dir="ltr" min="1" value={pay.num_payments} onChange={e => setPay(p => ({ ...p, num_payments: e.target.value }))} /></div>
            <div className="field" style={{ margin: 0 }}><label>% מימון</label><input dir="ltr" value={`${calc.pct}%`} readOnly /></div>
          </div>
          <div className="row wrap small" style={{ marginTop: 10, gap: 14, color: 'var(--text-2)' }}>
            <span>לכל תשלום: <b>{money(calc.perPayment)}</b></span><span>אחרי מימון (כולל): <b>{money(calc.afterInclVat)}</b></span><span>אחרי מימון (ללא): <b>{money(calc.afterExclVat)}</b></span>
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={addPayment} disabled={!pay.amount}><Icon name="plus" size={14} /> הוסף תשלום</button>
        </div>
        <div style={{ marginTop: 12 }}>
          {payments.map(pm => (
            <div key={pm.id} className="row small clickable" style={{ padding: '7px 9px', borderRadius: 8, background: 'var(--surface-2)', marginBottom: 6 }} onClick={() => nav(`/payments/${pm.id}`)}>
              <span className="badge mp">{pm.payment_type}</span>
              <span>{money(pm.amount_incl_vat)} · {pm.num_payments} תש' · מימון {pm.financing_pct}%</span>
              <div className="spacer" /><span className="muted">אחרי מימון {money(pm.after_financing_incl)}</span>
            </div>
          ))}
        </div>
      </div>
    </RecordLayout>
  )
}
