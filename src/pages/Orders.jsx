import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useListContext, useRefresh } from 'ra-core'
import { loadOptions } from '../lib/api'
import { ORDER_STATUS, chipColor } from '../lib/constants'
import ResourceList from '../components/ResourceList'
import { BulkDeleteButton } from '../components/admin/bulk-delete-button'
import BulkEdit from '../components/list/BulkEdit'
import RecordFormModal from '../components/RecordFormModal'
import EditableCell from '../components/EditableCell'
import Icon from '../components/Icon'

const statusOpts = Object.entries(ORDER_STATUS).map(([value, m]) => ({ value, label: m.label }))
const money = v => v ? `₪${Number(v).toLocaleString()}` : '-'

export default function Orders() {
  const nav = useNavigate()
  const [opts, setOpts] = useState({ products: [], cycles: [] })
  const [showNew, setShowNew] = useState(false)

  useEffect(() => { loadOptions().then(setOpts) }, [])
  const productOpts = opts.products.map(p => ({ value: p.id, label: p.name }))
  const cycleOpts = opts.cycles.map(c => ({ value: c.id, label: c.name }))

  const columns = [
    { source: 'person_id', label: 'לקוח', csv: r => r.person?.full_name,
      render: r => <span style={{ fontWeight: 600 }}>{r.person?.full_name || '-'}</span> },
    { source: 'product_id', label: 'מוצר', csv: r => r.product?.name,
      render: r => <Cell row={r} field="product_id" mode="select" options={productOpts}
        display={() => r.product?.name || '-'} /> },
    { source: 'cycle_id', label: 'מחזור', csv: r => r.cycle?.name,
      render: r => <Cell row={r} field="cycle_id" mode="select" options={cycleOpts}
        display={() => r.cycle?.name ? <span className="badge" style={chipColor(r.cycle.name)}>{r.cycle.name}</span> : '-'} /> },
    { source: 'deal_amount', label: 'סכום', csv: r => r.deal_amount,
      render: r => <span style={{ fontWeight: 600 }}><Cell row={r} field="deal_amount" display={money} /></span> },
    { source: 'deposit', label: 'מקדמה', csv: r => r.deposit,
      render: r => <span className="small"><Cell row={r} field="deposit" display={money} /></span> },
    { source: 'remaining', label: 'נותר', csv: r => r.remaining, sortable: true,
      render: r => <span className="small">{money(r.remaining)}</span> },
    { source: 'close_date', label: 'תאריך', csv: r => r.close_date,
      render: r => <span className="small"><Cell row={r} field="close_date"
        display={v => v ? new Date(v).toLocaleDateString('he-IL') : '-'} /></span> },
    { source: 'status', label: 'סטטוס', csv: r => ORDER_STATUS[r.status]?.label,
      render: r => <Cell row={r} field="status" mode="select" options={statusOpts}
        display={v => <span className={`badge ${ORDER_STATUS[v]?.badge || 'gray'}`}>{ORDER_STATUS[v]?.label || v}</span>} /> },
  ]

  const presets = [
    { key: 'all', label: 'הכול' },
    ...Object.entries(ORDER_STATUS).map(([k, m]) => ({ key: k, label: m.label, filter: { status: k } })),
  ]

  return (
    <>
      <ResourceList
        resource="orders" storeKey="ord" exportName="orders"
        sort={{ field: 'created_at', order: 'DESC' }}
        columns={columns} presets={presets}
        search="חיפוש לפי לקוח"
        extra={<SumBadge />}
        rowPath={r => `/orders/${r.id}`}
        bulkActions={<><BulkEdit fields={[
          { field: 'status', label: 'סטטוס', options: statusOpts },
          { field: 'product_id', label: 'מוצר', options: productOpts },
          { field: 'cycle_id', label: 'מחזור', options: cycleOpts },
        ]} /><BulkDeleteButton /></>}
        actions={<button className="btn sm" onClick={() => setShowNew(true)}><Icon name="plus" size={15} /> חדש</button>}
      />
      {showNew && <RecordFormModal type="order" onClose={() => setShowNew(false)} onCreated={row => nav(`/orders/${row.id}`)} />}
    </>
  )
}

function Cell({ row, field, mode, options, display }) {
  const refresh = useRefresh()
  return <EditableCell row={row} table="orders" field={field} mode={mode} options={options}
    display={display} onSaved={() => refresh()} />
}

/* Sum of the deals on the current page. Labelled as such so it is never
   mistaken for the total across every page. */
function SumBadge() {
  const { data, isPending } = useListContext()
  if (isPending || !data?.length) return null
  const sum = data.reduce((s, r) => s + (r.deal_amount || 0), 0)
  return <span className="badge mp">סה"כ בעמוד: ₪{sum.toLocaleString()}</span>
}
