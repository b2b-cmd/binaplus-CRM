import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateField, clearOptionsCache } from '../lib/api'
import { PERMISSION_LEVELS, USER_TYPES, SALES_STATUS_META, ORDER_STATUS, OPP_STATUS } from '../lib/constants'
import RecordLayout from '../components/RecordLayout'
import EditField from '../components/EditField'

const permOpts = Object.entries(PERMISSION_LEVELS).map(([value, label]) => ({ value, label }))
const typeOpts = Object.entries(USER_TYPES).map(([value, label]) => ({ value, label }))
const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')

export default function RepDetail() {
  const { id } = useParams()
  const [u, setU] = useState(null)
  const [students, setStudents] = useState([])
  const [opps, setOpps] = useState([])
  const [orders, setOrders] = useState([])
  const [modules, setModules] = useState([])
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [{ data: user }, { data: ppl }, { data: op }, { data: ord }, { data: ml }, { data: ls }] = await Promise.all([
      supabase.from('users').select('*').eq('id', id).single(),
      supabase.from('people').select('id, full_name, phone, sales_status').eq('assigned_sales_rep', id).is('deleted_at', null).order('full_name'),
      supabase.from('opportunities').select('id, training_type, status, person:people(full_name)').eq('owner', id).is('deleted_at', null),
      supabase.from('orders').select('id, deal_amount, status, person:people(full_name)').eq('owner', id).is('deleted_at', null),
      supabase.from('module_lecturers').select('module:modules(id, name, number)').eq('user_id', id),
      supabase.from('lessons').select('id, name, number, module:modules(name)').eq('lecturer', id).is('deleted_at', null).order('number'),
    ])
    setU(user)
    setStudents(ppl || []); setOpps(op || []); setOrders(ord || [])
    setModules((ml || []).map(x => x.module).filter(Boolean))
    setLessons(ls || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const save = async (field, value) => { setU(x => ({ ...x, [field]: value })); await updateField('users', u, field, value); clearOptionsCache() }
  const toggleActive = async () => { const v = !u.active; setU(x => ({ ...x, active: v })); await supabase.from('users').update({ active: v }).eq('id', id); clearOptionsCache() }
  const resetPassword = async () => {
    const password = prompt(`סיסמה חדשה עבור ${u.full_name}:`)
    if (!password) return
    if (password.length < 6) return alert('סיסמה חייבת להיות לפחות 6 תווים')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`${FUNCTIONS_URL}/reset-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ user_id: id, password }),
    })
    alert(res.ok ? 'הסיסמה עודכנה בהצלחה' : 'איפוס הסיסמה נכשל')
  }

  if (loading) return <div className="empty"><span className="spinner" /></div>
  if (!u) return <div className="card"><div className="empty">נציג לא נמצא.</div></div>

  const openOrders = orders.filter(o => o.status !== 'cancelled')
  const revenue = openOrders.reduce((s, o) => s + (o.deal_amount || 0), 0)
  const activeStudents = students.filter(s => s.sales_status === 'active_student').length

  const related = [
    { key: 'students', resource: 'people', fk: 'assigned_sales_rep', recordId: id, label: 'תלמידים / לידים', count: students.length, rows: students, onOpen: r => `/people/${r.id}`, columns: [{ label: 'שם', get: r => r.full_name }, { label: 'טלפון', get: r => <span dir="ltr">{r.phone || '-'}</span> }, { label: 'סטטוס', get: r => <span className={`badge ${SALES_STATUS_META[r.sales_status]?.badge || 'gray'}`}>{SALES_STATUS_META[r.sales_status]?.label || '-'}</span> }] },
    { key: 'opps', resource: 'opportunities', fk: 'owner', recordId: id, label: 'הזדמנויות', count: opps.length, rows: opps, onOpen: r => `/opportunities/${r.id}`, columns: [{ label: 'לקוח', get: r => r.person?.full_name || '-' }, { label: 'סוג', get: r => r.training_type || '-' }, { label: 'סטטוס', get: r => <span className={`badge ${OPP_STATUS[r.status]?.badge || 'gray'}`}>{OPP_STATUS[r.status]?.label || '-'}</span> }] },
    { key: 'orders', label: 'הזמנות', count: orders.length, rows: orders, onOpen: r => `/orders/${r.id}`, columns: [{ label: 'לקוח', get: r => r.person?.full_name || '-' }, { label: 'סכום', get: r => r.deal_amount ? `₪${r.deal_amount.toLocaleString()}` : '-' }, { label: 'סטטוס', get: r => <span className={`badge ${ORDER_STATUS[r.status]?.badge || 'gray'}`}>{ORDER_STATUS[r.status]?.label || '-'}</span> }] },
    { key: 'modules', label: 'מודולים שמלמד', count: modules.length, rows: modules, onOpen: r => `/modules/${r.id}`, columns: [{ label: '#', get: r => r.number ?? '-' }, { label: 'מודול', get: r => r.name }] },
    { key: 'lessons', label: 'שיעורים שמלמד', count: lessons.length, rows: lessons, onOpen: r => `/lessons/${r.id}`, columns: [{ label: '#', get: r => r.number ?? '-' }, { label: 'שיעור', get: r => r.name }, { label: 'מודול', get: r => r.module?.name || '-' }] },
  ]

  return (
    <RecordLayout
      title={u.full_name} subtitle={USER_TYPES[u.user_type]} backTo="/reps"
      status={{ label: u.active ? 'פעיל' : 'מושבת', badge: u.active ? 'ok' : 'err' }}
      objectType="users" recordId={id} recordType="rep" record={u} related={related} feed={false}
      actions={[{ icon: 'shield', title: 'איפוס סיסמה', onClick: resetPassword }]}
    >
      <div className="card">
        <div className="kpi-grid" style={{ marginBottom: 16 }}>
          <div className="kpi"><div className="label">תלמידים / לידים</div><div className="value anta">{students.length}</div></div>
          <div className="kpi"><div className="label">תלמידים פעילים</div><div className="value anta">{activeStudents}</div></div>
          <div className="kpi"><div className="label">הזמנות פעילות</div><div className="value anta">{openOrders.length}</div></div>
          <div className="kpi"><div className="label">היקף מכירות</div><div className="value anta">₪{revenue.toLocaleString()}</div></div>
        </div>
        <div className="field-grid">
          <EditField label="שם מלא" value={u.full_name} onSave={v => save('full_name', v)} />
          <EditField label="טלפון" value={u.phone} ltr onSave={v => save('phone', v)} />
          <EditField label="מייל" value={u.email} ltr onSave={v => save('email', v)} />
          <EditField label="הרשאה" value={u.permission_level} display={PERMISSION_LEVELS[u.permission_level]} type="select" options={permOpts} onSave={v => save('permission_level', v)} />
          <EditField label="סוג משתמש" value={u.user_type} display={USER_TYPES[u.user_type]} type="select" options={typeOpts} onSave={v => save('user_type', v)} />
          <EditField label="פעיל" value={u.active} type="checkbox" onSave={toggleActive} />
        </div>
      </div>
    </RecordLayout>
  )
}
