import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateField, loadOptions } from '../lib/api'
import { OPP_STATUS, TRAINING_TYPES, ORDER_STATUS } from '../lib/constants'
import RecordLayout from '../components/RecordLayout'
import EditField from '../components/EditField'

const STAGES = [
  { key: 'new', label: 'חדש' }, { key: 'followup', label: 'פולואפ' }, { key: 'meeting', label: 'פגישה' },
  { key: 'proposal', label: 'הצעה' }, { key: 'won', label: 'נסגר' },
]

export default function OpportunityDetail() {
  const { id } = useParams()
  const [o, setO] = useState(null)
  const [orders, setOrders] = useState([])
  const [opts, setOpts] = useState({ reps: [] })
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [{ data }, oo] = await Promise.all([
      supabase.from('opportunities').select('*, person:people(id,full_name)').eq('id', id).single(),
      loadOptions(),
    ])
    setO(data); setOpts(oo)
    const { data: ord } = await supabase.from('orders').select('id, deal_amount, status').eq('opportunity_id', id).is('deleted_at', null)
    setOrders(ord || []); setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const save = async (field, value) => { setO(x => ({ ...x, [field]: value })); await updateField('opportunities', o, field, value) }

  if (loading) return <div className="empty"><span className="spinner" /></div>
  if (!o) return <div className="card"><div className="empty">הזדמנות לא נמצאה.</div></div>

  const related = [
    o.person && { key: 'person', label: 'לקוח', count: 1, rows: [o.person], onOpen: r => `/people/${r.id}`, columns: [{ label: 'שם', get: r => r.full_name }] },
    { key: 'orders', label: 'הזמנות', count: orders.length, rows: orders, onOpen: r => `/orders/${r.id}`, columns: [{ label: 'סכום', get: r => r.deal_amount ? `₪${r.deal_amount.toLocaleString()}` : '-' }, { label: 'סטטוס', get: r => <span className={`badge ${ORDER_STATUS[r.status]?.badge}`}>{ORDER_STATUS[r.status]?.label}</span> }] },
  ].filter(Boolean)

  return (
    <RecordLayout
      title={`הזדמנות - ${o.person?.full_name || ''}`} backTo="/opportunities" objectType="opportunities" recordId={id} table="opportunities"
      recordType="opportunity" record={o} onRelatedCreated={() => load()}
      status={{ label: OPP_STATUS[o.status]?.label, badge: OPP_STATUS[o.status]?.badge }} related={related}
      stage={{ stages: STAGES, current: o.status, onSet: v => save('status', v) }}
    >
      <div className="card">
        <div className="field-grid">
          <EditField label="סוג הכשרה" value={o.training_type} type="select" options={TRAINING_TYPES.map(t => ({ value: t, label: t }))} onSave={v => save('training_type', v)} />
          <EditField label="סטטוס" value={o.status} display={OPP_STATUS[o.status]?.label} type="select" options={Object.entries(OPP_STATUS).map(([k, m]) => ({ value: k, label: m.label }))} onSave={v => save('status', v)} />
          <EditField label="נציג" value={o.owner} display={opts.reps.find(r => r.id === o.owner)?.full_name} type="select" options={opts.reps.map(r => ({ value: r.id, label: r.full_name }))} onSave={v => save('owner', v)} />
        </div>
      </div>
    </RecordLayout>
  )
}
