import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useListContext, useRefresh } from 'ra-core'
import { supabase } from '../lib/supabase'
import { PAYMENT_TYPES } from '../lib/constants'
import { computeFinancing } from '../lib/finance'
import ResourceList from '../components/ResourceList'
import { BulkDeleteButton } from '../components/admin/bulk-delete-button'
import BulkEdit from '../components/list/BulkEdit'
import RecordFormModal from '../components/RecordFormModal'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

const typeOpts = PAYMENT_TYPES.map(t => ({ value: t, label: t }))
const money = v => v ? `₪${Number(v).toLocaleString()}` : '-'

export default function Payments() {
  const nav = useNavigate()
  const [showNew, setShowNew] = useState(false)

  const columns = [
    { source: 'person_id', label: 'לקוח', csv: r => r.person?.full_name,
      render: r => <span style={{ fontWeight: 600 }}>{r.person?.full_name || '-'}</span> },
    { source: 'payment_type', label: 'אמצעי', csv: r => r.payment_type,
      render: r => <FinCell row={r} field="payment_type" mode="select" options={typeOpts}
        display={v => <span className="badge mp">{v || '-'}</span>} /> },
    { source: 'amount_incl_vat', label: 'סכום כולל', csv: r => r.amount_incl_vat,
      render: r => <span style={{ fontWeight: 600 }}><FinCell row={r} field="amount_incl_vat" display={money} /></span> },
    { source: 'num_payments', label: 'תשלומים', csv: r => r.num_payments,
      render: r => <span className="small"><FinCell row={r} field="num_payments" display={v => v || 1} /></span> },
    { source: 'per_payment', label: 'לכל תשלום', csv: r => r.per_payment,
      render: r => <span className="small">{money(r.per_payment)}</span> },
    { source: 'financing_pct', label: '%מימון', csv: r => r.financing_pct,
      render: r => <span className="badge info">{r.financing_pct || 0}%</span> },
    { source: 'after_financing_incl', label: 'אחרי מימון', csv: r => r.after_financing_incl,
      render: r => <span style={{ fontWeight: 600 }}>{money(r.after_financing_incl)}</span> },
  ]

  const presets = [
    { key: 'all', label: 'הכול' },
    ...PAYMENT_TYPES.map(t => ({ key: t, label: t, filter: { payment_type: t } })),
  ]

  return (
    <>
      <ResourceList
        resource="payments" storeKey="pay" exportName="payments"
        sort={{ field: 'created_at', order: 'DESC' }}
        columns={columns} presets={presets}
        search="חיפוש לפי לקוח"
        extra={<SumBadge />}
        rowPath={r => `/payments/${r.id}`}
        bulkActions={<><BulkEdit fields={[
          { field: 'payment_type', label: 'אמצעי תשלום', options: typeOpts },
        ]} /><BulkDeleteButton /></>}
        actions={<button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> חדש</button>}
      />
      {showNew && <RecordFormModal type="payment" onClose={() => setShowNew(false)} onCreated={row => nav(`/payments/${row.id}`)} />}
    </>
  )
}

/* Editing any financing input re-derives per_payment / pct / after-financing
   and persists them, so the row never shows a stale computed figure.
   EditableCell has already written the edited field itself. */
function FinCell({ row, field, mode, options, display }) {
  const refresh = useRefresh()
  const onSaved = async (f, value) => {
    const next = { ...row, [f]: value }
    const c = computeFinancing({
      amountInclVat: +next.amount_incl_vat || 0,
      paymentType: next.payment_type,
      numPayments: +next.num_payments || 1,
    })
    await supabase.from('payments').update({
      amount_excl_vat: c.amountExclVat, per_payment: c.perPayment, financing_pct: c.pct,
      after_financing_incl: c.afterInclVat, after_financing_excl: c.afterExclVat,
    }).eq('id', row.id)
    refresh()
  }
  return <EditableCell row={row} table="payments" field={field} mode={mode} options={options}
    display={display} onSaved={onSaved} />
}

function SumBadge() {
  const { data, isPending } = useListContext()
  if (isPending || !data?.length) return null
  const sum = data.reduce((s, r) => s + (r.after_financing_incl || r.amount_incl_vat || 0), 0)
  return <span className="badge mp">סה"כ בעמוד: ₪{Math.round(sum).toLocaleString()}</span>
}
