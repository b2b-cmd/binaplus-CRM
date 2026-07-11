import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateField, loadOptions } from '../lib/api'
import { PAYMENT_TYPES } from '../lib/constants'
import { computeFinancing } from '../lib/finance'
import RecordLayout from '../components/RecordLayout'
import EditField from '../components/EditField'

export default function PaymentDetail() {
  const { id } = useParams()
  const [pm, setPm] = useState(null)
  const [opts, setOpts] = useState({ reps: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data }, o] = await Promise.all([
        supabase.from('payments').select('*, person:people(id,full_name), order:orders(id), opportunity:opportunities(id)').eq('id', id).single(),
        loadOptions(),
      ])
      setPm(data); setOpts(o); setLoading(false)
    })()
  }, [id])

  // recompute financing whenever amount/type/num changes
  const recompute = async (patch) => {
    const next = { ...pm, ...patch }
    const c = computeFinancing({ amountInclVat: +next.amount_incl_vat || 0, paymentType: next.payment_type, numPayments: +next.num_payments || 1 })
    const full = { ...patch, amount_excl_vat: c.amountExclVat, per_payment: c.perPayment, financing_pct: c.pct, after_financing_incl: c.afterInclVat, after_financing_excl: c.afterExclVat }
    setPm(x => ({ ...x, ...full }))
    for (const [k, v] of Object.entries(full)) await updateField('payments', pm, k, v)
  }
  const save = async (field, value) => { setPm(x => ({ ...x, [field]: value })); await updateField('payments', pm, field, value) }

  if (loading) return <div className="empty"><span className="spinner" /></div>
  if (!pm) return <div className="card"><div className="empty">תשלום לא נמצא.</div></div>

  const money = v => v ? `₪${Number(v).toLocaleString()}` : '-'
  const related = [
    pm.order && { key: 'order', label: 'הזמנה', count: 1, rows: [pm.order], onOpen: r => `/orders/${r.id}`, columns: [{ label: 'הזמנה', get: () => 'פתח הזמנה' }] },
    pm.person && { key: 'person', label: 'לקוח', count: 1, rows: [pm.person], onOpen: r => `/people/${r.id}`, columns: [{ label: 'שם', get: r => r.full_name }] },
    pm.opportunity && { key: 'opp', label: 'הזדמנות', count: 1, rows: [pm.opportunity], onOpen: r => `/opportunities/${r.id}`, columns: [{ label: 'הזדמנות', get: () => 'פתח הזדמנות' }] },
  ].filter(Boolean)

  return (
    <RecordLayout title={`תשלום - ${pm.person?.full_name || ''}`} backTo="/payments" objectType="payments" recordId={id} table="payments" related={related} recordType="payment" record={pm}>
      <div className="card">
        <div className="field-grid">
          <EditField label='סכום כולל מע"מ' value={pm.amount_incl_vat} display={money(pm.amount_incl_vat)} type="number" onSave={v => recompute({ amount_incl_vat: v })} />
          <EditField label='סכום ללא מע"מ' value={pm.amount_excl_vat} display={money(pm.amount_excl_vat)} readOnly />
          <EditField label="אמצעי תשלום" value={pm.payment_type} type="select" options={PAYMENT_TYPES.map(t => ({ value: t, label: t }))} onSave={v => recompute({ payment_type: v })} />
          <EditField label="כמות תשלומים" value={pm.num_payments} type="number" onSave={v => recompute({ num_payments: v })} />
          <EditField label="סכום כל תשלום" value={pm.per_payment} display={money(pm.per_payment)} readOnly />
          <EditField label="% מימון" value={pm.financing_pct} display={`${pm.financing_pct || 0}%`} readOnly />
          <EditField label='אחרי מימון כולל מע"מ' value={pm.after_financing_incl} display={money(pm.after_financing_incl)} readOnly />
          <EditField label='אחרי מימון ללא מע"מ' value={pm.after_financing_excl} display={money(pm.after_financing_excl)} readOnly />
          <EditField label="נציג מכירות" value={pm.owner} display={opts.reps.find(r => r.id === pm.owner)?.full_name} type="select" options={opts.reps.map(r => ({ value: r.id, label: r.full_name }))} onSave={v => save('owner', v)} />
        </div>
      </div>
    </RecordLayout>
  )
}
