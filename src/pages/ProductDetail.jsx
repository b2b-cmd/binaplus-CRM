import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateField } from '../lib/api'
import { ORDER_STATUS } from '../lib/constants'
import RecordLayout from '../components/RecordLayout'
import EditField from '../components/EditField'

const TYPES = ['דיגיטלי', 'לייב + דיגיטלי', 'פרונטלי', 'פרונטלי + דיגיטלי', 'אחר'].map(x => ({ value: x, label: x }))

export default function ProductDetail() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [cycles, setCycles] = useState([])
  const [lessons, setLessons] = useState([])
  const [students, setStudents] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data } = await supabase.from('products').select('*').eq('id', id).single()
      setP(data)
      const [{ data: cy }, { data: ls }, { data: st }, { data: or }] = await Promise.all([
        supabase.from('cycles').select('id, name, start_date').eq('product_id', id).is('deleted_at', null).order('name'),
        supabase.from('lessons').select('id, number, name, type').eq('product_id', id).is('deleted_at', null).order('number'),
        supabase.from('people').select('id, full_name, phone, sales_status').eq('product_id', id).is('deleted_at', null).order('full_name'),
        supabase.from('orders').select('id, deal_amount, status, person:people(full_name)').eq('product_id', id).is('deleted_at', null),
      ])
      setCycles(cy || []); setLessons(ls || []); setStudents(st || []); setOrders(or || []); setLoading(false)
    })()
  }, [id])

  const save = async (field, value) => { setP(x => ({ ...x, [field]: value })); await updateField('products', p, field, value) }

  if (loading) return <div className="empty"><span className="spinner" /></div>
  if (!p) return <div className="card"><div className="empty">מוצר לא נמצא.</div></div>

  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.deal_amount || 0), 0)
  const related = [
    { key: 'cycles', label: 'מחזורים', count: cycles.length, rows: cycles, onOpen: r => `/cycles/${r.id}`,
      columns: [{ label: 'מחזור', get: r => r.name }, { label: 'התחלה', get: r => r.start_date ? new Date(r.start_date).toLocaleDateString('he-IL') : '-' }] },
    { key: 'lessons', label: 'שיעורים', count: lessons.length, rows: lessons, onOpen: r => `/lessons/${r.id}`,
      columns: [{ label: '#', get: r => r.number }, { label: 'שיעור', get: r => r.name }, { label: 'סוג', get: r => r.type }] },
    { key: 'students', label: 'תלמידים', count: students.length, rows: students, onOpen: r => `/people/${r.id}`,
      columns: [{ label: 'שם', get: r => r.full_name }, { label: 'טלפון', get: r => <span dir="ltr">{r.phone || '-'}</span> }] },
    { key: 'orders', label: 'הזמנות', count: orders.length, rows: orders, onOpen: r => `/orders/${r.id}`,
      columns: [{ label: 'לקוח', get: r => r.person?.full_name || '-' }, { label: 'סכום', get: r => r.deal_amount ? `₪${r.deal_amount.toLocaleString()}` : '-' }, { label: 'סטטוס', get: r => <span className={`badge ${ORDER_STATUS[r.status]?.badge}`}>{ORDER_STATUS[r.status]?.label}</span> }] },
  ]

  return (
    <RecordLayout title={p.name} subtitle={`${cycles.length} מחזורים · ${lessons.length} שיעורים · הכנסה ₪${revenue.toLocaleString()}`}
      backTo="/products" objectType="products" recordId={id} table="products" related={related}>
      <div className="card">
        <div className="field-grid">
          <EditField label="שם המוצר" value={p.name} onSave={v => save('name', v)} />
          <EditField label="סוג" value={p.type} type="select" options={TYPES} onSave={v => save('type', v)} />
          <EditField label="מחיר לפני מע״מ" value={p.price_before_vat} type="number" onSave={v => save('price_before_vat', v)} />
          <EditField label="מחיר אחרי מע״מ" value={p.price_after_vat} type="number" onSave={v => save('price_after_vat', v)} />
          <EditField label="קישור לדף תשלום" value={p.payment_url} type="link" ltr onSave={v => save('payment_url', v)} />
          <EditField label="קישור לסילבוס" value={p.syllabus_url} type="link" ltr onSave={v => save('syllabus_url', v)} />
        </div>
        <div style={{ marginTop: 10 }}>
          <EditField label="מידע נוסף" value={p.info} type="textarea" onSave={v => save('info', v)} />
        </div>
      </div>
    </RecordLayout>
  )
}
