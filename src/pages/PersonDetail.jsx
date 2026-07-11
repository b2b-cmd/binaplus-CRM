import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateField, loadOptions } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { SALES_STATUS_META, ORDER_STATUS, OPP_STATUS, chipColor } from '../lib/constants'
import RecordLayout from '../components/RecordLayout'
import EditField from '../components/EditField'
import CloudChatEmbed from '../components/CloudChatEmbed'
import StudentSetupModal from '../components/StudentSetupModal'
import Icon from '../components/Icon'

const P_SELECT = '*, product:products(name,payment_url), cycle:cycles(name), rep:users!people_assigned_sales_rep_fkey(full_name)'
const SALES_STAGES = [
  { key: 'new_lead', label: 'ליד חדש' }, { key: 'followup', label: 'בפולואפ' },
  { key: 'paid_deposit', label: 'מקדמה' }, { key: 'seat_reserved', label: 'שריון כיסא' },
  { key: 'active_student', label: 'תלמיד פעיל' },
]
const SECTIONS = ['פרטים', 'מכירה', 'תלמיד']

export default function PersonDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const rep = useAuthStore(s => s.rep)
  const [p, setP] = useState(null)
  const [opts, setOpts] = useState({ products: [], cycles: [], reps: [] })
  const [orders, setOrders] = useState([])
  const [opps, setOpps] = useState([])
  const [payments, setPayments] = useState([])
  const [tickets, setTickets] = useState([])
  const [attendance, setAttendance] = useState([])
  const [sec, setSec] = useState('פרטים')
  const [showSetup, setShowSetup] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const [{ data: person }, o] = await Promise.all([supabase.from('people').select(P_SELECT).eq('id', id).single(), loadOptions()])
    setP(person); setOpts(o)
    const [{ data: ord }, { data: op }, { data: pay }, { data: tk }, { data: at }] = await Promise.all([
      supabase.from('orders').select('*, cycle:cycles(name)').eq('person_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('opportunities').select('*').eq('person_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('person_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('tickets').select('id, summary, status, created_at').eq('person_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('attendance').select('*, lesson:lessons(id, number, name, product:products(name)), cycle:cycles(name)').eq('person_id', id).order('created_at', { ascending: false }),
    ])
    setOrders(ord || []); setOpps(op || []); setPayments(pay || []); setTickets(tk || []); setAttendance(at || []); setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const save = async (field, value) => { setP(x => ({ ...x, [field]: value })); await updateField('people', p, field, value) }

  if (loading) return <div className="empty"><span className="spinner" /></div>
  if (!p) return <div className="card"><div className="empty">לא נמצא.</div></div>

  const productOpts = opts.products.map(x => ({ value: x.id, label: x.name }))
  const cycleOpts = opts.cycles.map(x => ({ value: x.id, label: x.name }))
  const repOpts = opts.reps.map(x => ({ value: x.id, label: x.full_name }))
  const salesOpts = Object.entries(SALES_STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))

  const cardcom = () => {
    const base = p.product?.payment_url; if (!base) return null
    const u = new URL(base)
    if (p.full_name) u.searchParams.set('cername', p.full_name)
    if (p.email) u.searchParams.set('ceremail', p.email)
    if (p.phone) u.searchParams.set('cerphone', p.phone)
    return u.toString()
  }
  // opportunity/order/ticket creation is handled by RecordLayout's dynamic "+ create" pills (schema-driven).
  const actions = [
    p.phone && { icon: 'message', title: 'וואטסאפ', href: `https://wa.me/972${p.phone.replace(/\D/g, '').replace(/^0/, '')}` },
    cardcom() && { icon: 'money', title: 'לינק תשלום', href: cardcom() },
    { icon: 'user-plus', title: 'הקמת תלמיד', onClick: () => setShowSetup(true) },
  ].filter(Boolean)

  const related = [
    { key: 'orders', label: 'הזמנות', count: orders.length, rows: orders, onOpen: r => `/orders/${r.id}`,
      columns: [{ label: 'סכום', get: r => r.deal_amount ? `₪${r.deal_amount.toLocaleString()}` : '-' }, { label: 'מחזור', get: r => r.cycle?.name || '-' }, { label: 'סטטוס', get: r => <span className={`badge ${ORDER_STATUS[r.status]?.badge}`}>{ORDER_STATUS[r.status]?.label}</span> }] },
    { key: 'opps', label: 'הזדמנויות', count: opps.length, rows: opps, onOpen: r => `/opportunities/${r.id}`,
      columns: [{ label: 'סוג', get: r => r.training_type }, { label: 'סטטוס', get: r => <span className={`badge ${OPP_STATUS[r.status]?.badge}`}>{OPP_STATUS[r.status]?.label}</span> }] },
    { key: 'pay', label: 'תשלומים', count: payments.length, rows: payments, onOpen: r => `/payments/${r.id}`,
      columns: [{ label: 'אמצעי', get: r => r.payment_type }, { label: 'סכום', get: r => r.amount_incl_vat ? `₪${r.amount_incl_vat.toLocaleString()}` : '-' }, { label: 'מימון', get: r => `${r.financing_pct || 0}%` }] },
    { key: 'tk', label: 'פניות', count: tickets.length, rows: tickets, onOpen: r => `/tickets/${r.id}`,
      columns: [{ label: 'נושא', get: r => r.summary || '-' }, { label: 'תאריך', get: r => new Date(r.created_at).toLocaleDateString('he-IL') }] },
    { key: 'att', label: 'נוכחות', count: attendance.length, rows: attendance, onOpen: r => r.lesson ? `/lessons/${r.lesson.id}` : '/lessons',
      columns: [
        { label: 'שיעור', get: r => `${r.lesson?.number ? r.lesson.number + '. ' : ''}${r.lesson?.name || '-'}` },
        { label: 'מחזור', get: r => r.cycle?.name || '-' },
        { label: 'סטטוס', get: r => r.present ? <span className="badge ok">נוכח/ה</span> : <span className={`badge ${r.approved ? 'warn' : 'err'}`}>{r.approved ? 'חיסור מאושר' : 'חיסור לא מאושר'}</span> },
        { label: 'הערות', get: r => r.notes || '-' },
      ] },
  ]
  const absences = attendance.filter(a => !a.present)
  const absStats = { total: absences.length, unapproved: absences.filter(a => !a.approved).length }

  return (
    <RecordLayout
      title={p.full_name} backTo="/people"
      status={{ label: SALES_STATUS_META[p.sales_status]?.label, badge: SALES_STATUS_META[p.sales_status]?.badge }}
      actions={actions} related={related} objectType="people" recordId={id} table="people"
      recordType="person" record={p} onRelatedCreated={() => load()}
      stage={{ stages: SALES_STAGES, current: p.sales_status, onSet: v => save('sales_status', v) }}
    >
      <div className="card">
        <div className="sections-tabs">{SECTIONS.map(s => <div key={s} className={`sec-tab ${sec === s ? 'active' : ''}`} onClick={() => setSec(s)}>{s}</div>)}</div>
        {sec === 'פרטים' && <div className="field-grid">
          <EditField label="שם מלא" value={p.full_name} onSave={v => save('full_name', v)} />
          <EditField label="טלפון" value={p.phone} ltr onSave={v => save('phone', v)} />
          <EditField label="מייל" value={p.email} ltr onSave={v => save('email', v)} />
          <EditField label="מקור הגעה" value={p.source} onSave={v => save('source', v)} />
          <EditField label="תאריך כניסה" value={p.entry_date} type="date" onSave={v => save('entry_date', v)} />
          <EditField label="נציג מטפל" value={p.assigned_sales_rep} display={p.rep?.full_name} type="select" options={repOpts} onSave={v => save('assigned_sales_rep', v)} />
        </div>}
        {sec === 'מכירה' && <div className="field-grid">
          <EditField label="סטטוס מכירתי" value={p.sales_status} display={SALES_STATUS_META[p.sales_status]?.label} type="select" options={salesOpts} onSave={v => save('sales_status', v)} />
          <EditField label="מוצר" value={p.product_id} display={p.product?.name} type="select" options={productOpts} onSave={v => save('product_id', v)} />
          <EditField label="סטטוס הסכם" value={p.agreement_status} onSave={v => save('agreement_status', v)} />
        </div>}
        {sec === 'תלמיד' && <div className="field-grid">
          <EditField label="קיבל הרשאות" value={p.received_access} type="checkbox" onSave={v => save('received_access', v)} />
          <EditField label="נוסף לקבוצה" value={p.added_to_group} type="checkbox" onSave={v => save('added_to_group', v)} />
          <EditField label="שיחת מנהל תיק" value={p.manager_call} type="checkbox" onSave={v => save('manager_call', v)} />
          <EditField label="נכנס ל-CRM" value={p.in_crm} type="checkbox" onSave={v => save('in_crm', v)} />
          <EditField label="חיסורים (סה״כ)" value={absStats.total} display={<span className={`badge ${absStats.total ? 'warn' : 'ok'}`}>{absStats.total}</span>} readOnly />
          <EditField label="חיסורים לא מאושרים" value={absStats.unapproved} display={<span className={`badge ${absStats.unapproved ? 'err' : 'ok'}`}>{absStats.unapproved}</span>} readOnly />
        </div>}
        <div style={{ marginTop: 10 }}><EditField label="הערות" value={p.notes} type="textarea" onSave={v => save('notes', v)} /></div>
        <div style={{ marginTop: 10 }}><EditField label="מזהה CloudChat" value={p.cloudchat_id} ltr onSave={v => save('cloudchat_id', v)} /></div>
      </div>
      {p.cloudchat_id && <div className="card"><div className="card-title"><Icon name="grid" /> שיחת CloudChat</div><CloudChatEmbed cloudchatId={p.cloudchat_id} /></div>}
      {showSetup && <StudentSetupModal person={p} onClose={() => setShowSetup(false)} onDone={load} />}
    </RecordLayout>
  )
}
