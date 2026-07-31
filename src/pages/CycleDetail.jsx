import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateField, loadOptions } from '../lib/api'
import { toast } from '../components/Toaster'
import { ORDER_STATUS, SALES_STATUS_META } from '../lib/constants'
import RecordLayout from '../components/RecordLayout'
import EditField from '../components/EditField'
import Icon from '../components/Icon'

export default function CycleDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [c, setC] = useState(null)
  const [opts, setOpts] = useState({ products: [] })
  const [students, setStudents] = useState([])
  const [orders, setOrders] = useState([])
  const [schedule, setSchedule] = useState([]) // cycle_lessons (dated sessions) for this cycle
  const [att, setAtt] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAtt = async () => {
    const { data } = await supabase.from('attendance').select('*').eq('cycle_id', id)
    setAtt(data || [])
  }
  useEffect(() => {
    (async () => {
      setLoading(true)
      const [{ data: cyc }, o] = await Promise.all([
        supabase.from('cycles').select('*, product:products(name)').eq('id', id).single(),
        loadOptions(),
      ])
      setC(cyc); setOpts(o)
      const [{ data: ppl }, { data: ord }, { data: sched }, { data: at }] = await Promise.all([
        supabase.from('people').select('id, full_name, phone, sales_status').eq('cycle_id', id).is('deleted_at', null).order('full_name'),
        supabase.from('orders').select('id, deal_amount, status, person:people(full_name)').eq('cycle_id', id).is('deleted_at', null),
        supabase.from('cycle_lessons').select('*, lesson:lessons(id, number, name, type)').eq('cycle_id', id).order('seq'),
        supabase.from('attendance').select('*').eq('cycle_id', id),
      ])
      setStudents(ppl || []); setOrders(ord || []); setSchedule(sched || []); setAtt(at || [])
      setLoading(false)
    })()
  }, [id])

  const save = async (field, value) => { setC(x => ({ ...x, [field]: value })); await updateField('cycles', c, field, value) }

  const matrix = useMemo(() => { const m = {}; for (const a of att) (m[a.person_id] ||= {})[a.lesson_id] = a; return m }, [att])
  const absSummary = (pid) => { const rows = att.filter(a => a.person_id === pid && !a.present); return { total: rows.length, unapproved: rows.filter(a => !a.approved).length } }

  // cell click cycles: (none) → present → absent-unapproved → absent-approved → (none)
  const cycleCell = async (person_id, lesson_id) => {
    const cur = matrix[person_id]?.[lesson_id]
    let next
    if (!cur) next = { present: true, approved: false }
    else if (cur.present) next = { present: false, approved: false }
    else if (!cur.approved) next = { present: false, approved: true }
    else next = null // clear
    if (next === null) {
      await supabase.from('attendance').delete().eq('id', cur.id)
    } else {
      await supabase.from('attendance').upsert({ lesson_id, cycle_id: id, person_id, ...next }, { onConflict: 'lesson_id,cycle_id,person_id' })
    }
    await loadAtt()
  }

  if (loading) return <div className="empty"><span className="spinner" /></div>
  if (!c) return <div className="card"><div className="empty">מחזור לא נמצא.</div></div>

  const activeStudents = students.filter(s => s.sales_status !== 'cancelled')
  const reg = students.filter(s => s.sales_status === 'active_student').length
  const dep = students.filter(s => ['paid_deposit', 'seat_reserved'].includes(s.sales_status)).length
  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.deal_amount || 0), 0)
  const seatsLeft = c.seats_total != null ? c.seats_total - (reg + dep) : null

  const related = [
    { key: 'students', resource: 'people', fk: 'cycle_id', recordId: id, label: 'תלמידים', count: activeStudents.length, rows: activeStudents, onOpen: r => `/people/${r.id}`, columns: [{ label: 'שם', get: r => r.full_name }, { label: 'טלפון', get: r => <span dir="ltr">{r.phone || '-'}</span> }, { label: 'סטטוס', get: r => <span className={`badge ${SALES_STATUS_META[r.sales_status]?.badge || 'gray'}`}>{SALES_STATUS_META[r.sales_status]?.label}</span> }] },
    { key: 'orders', resource: 'orders', fk: 'cycle_id', recordId: id, label: 'הזמנות', count: orders.length, rows: orders, onOpen: r => `/orders/${r.id}`, columns: [{ label: 'לקוח', get: r => r.person?.full_name || '-' }, { label: 'סכום', get: r => r.deal_amount ? `₪${r.deal_amount.toLocaleString()}` : '-' }, { label: 'סטטוס', get: r => <span className={`badge ${ORDER_STATUS[r.status]?.badge}`}>{ORDER_STATUS[r.status]?.label}</span> }] },
  ]

  return (
    <RecordLayout title={`מחזור: ${c.name}`} subtitle={c.product?.name} backTo="/cycles" objectType="cycles" recordId={id} table="cycles" recordType="cycle" record={c} related={related}>
      <div className="card">
        {/* computed stats */}
        <div className="kpi-grid" style={{ marginBottom: 16 }}>
          <div className="kpi"><div className="label">רשומים</div><div className="value anta">{reg}</div></div>
          <div className="kpi"><div className="label">במקדמה</div><div className="value anta">{dep}</div></div>
          <div className="kpi"><div className="label">מקומות שנותרו</div><div className="value anta">{seatsLeft ?? '-'}</div></div>
          <div className="kpi"><div className="label">הכנסה מהמחזור</div><div className="value anta">₪{revenue.toLocaleString()}</div></div>
        </div>
        <div className="field-grid">
          <EditField label="שם המחזור" value={c.name} onSave={v => save('name', v)} />
          <EditField label="מוצר" value={c.product_id} display={c.product?.name} type="select" options={opts.products.map(p => ({ value: p.id, label: p.name }))} onSave={v => save('product_id', v)} />
          <EditField label="מרצה ראשי" value={c.lecturer_name} onSave={v => save('lecturer_name', v)} />
          <EditField label="טלפון מרצה" value={c.lecturer_phone} ltr onSave={v => save('lecturer_phone', v)} />
          <EditField label="מייל מרצה" value={c.lecturer_email} ltr onSave={v => save('lecturer_email', v)} />
          <EditField label="תאריך התחלה" value={c.start_date} type="date" onSave={v => save('start_date', v)} />
          <EditField label="תאריך סיום" value={c.end_date} type="date" onSave={v => save('end_date', v)} />
          <EditField label="סה״כ מקומות" value={c.seats_total} type="number" onSave={v => save('seats_total', v)} />
          <EditField label="קישור לפורטל" value={c.portal_url} type="link" ltr onSave={v => save('portal_url', v)} />
        </div>
      </div>

      {/* Schedule */}
      <div className="card">
        <div className="card-title"><Icon name="calendar" /> לוח מפגשים {schedule.length > 0 && <span className="muted small">({schedule.length})</span>}</div>
        {schedule.length === 0 ? <div className="empty small">אין לוח מפגשים למחזור זה.</div> : (
          <div className="table-wrap">
            <table className="grid" style={{ fontSize: '0.85rem' }}>
              <thead><tr><th>#</th><th>תאריך</th><th>שעה</th><th>מפגש</th><th>מרצה</th><th></th></tr></thead>
              <tbody>{schedule.map(s => (
                <tr key={s.id} className="clickable" onClick={() => s.lesson && nav(`/lessons/${s.lesson.id}`)}>
                  <td className="muted">{s.seq}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{s.session_date ? new Date(s.session_date).toLocaleDateString('he-IL') : '-'}</td>
                  <td className="small muted" dir="ltr">{s.start_time ? s.start_time.slice(0, 5) : ''}</td>
                  <td style={{ fontWeight: 600 }}>{s.lesson?.name || '-'}</td>
                  <td className="small">{s.lecturer || '-'}</td>
                  <td>{s.presentation_url && <a href={s.presentation_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>מצגת</a>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attendance matrix */}
      <div className="card" style={{ borderColor: 'var(--lp)' }}>
        <div className="card-title"><Icon name="users" /> נוכחות</div>
        {schedule.length === 0 || activeStudents.length === 0 ? <div className="empty small">נדרש לוח מפגשים + תלמידים משויכים כדי לסמן נוכחות.</div> : (
          <div className="table-wrap">
            <table className="grid" style={{ fontSize: '0.8rem' }}>
              <thead><tr>
                <th style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--surface-2)' }}>תלמיד</th>
                {schedule.map(s => <th key={s.id} title={s.lesson?.name} style={{ cursor: 'pointer', textAlign: 'center' }} onClick={() => s.lesson && nav(`/lessons/${s.lesson.id}`)}>{s.seq}</th>)}
                <th>חיסורים</th><th>לא מאושר</th>
              </tr></thead>
              <tbody>
                {activeStudents.map(st => {
                  const sum = absSummary(st.id)
                  return (
                    <tr key={st.id}>
                      <td style={{ fontWeight: 600, cursor: 'pointer', position: 'sticky', insetInlineStart: 0, background: 'var(--surface)' }} onClick={() => nav(`/people/${st.id}`)}>{st.full_name}</td>
                      {schedule.map(s => {
                        const a = s.lesson ? matrix[st.id]?.[s.lesson.id] : null
                        return <td key={s.id} style={{ textAlign: 'center', cursor: 'pointer' }} title={a?.notes || 'לחצו לסימון'} onClick={() => s.lesson && cycleCell(st.id, s.lesson.id)}>
                          {!a ? <span className="muted">·</span>
                            : a.present ? <span style={{ color: 'var(--ok)', fontWeight: 800 }}>✓</span>
                            : <span style={{ color: a.approved ? 'var(--warn)' : 'var(--err)', fontWeight: 800 }}>✗</span>}
                        </td>
                      })}
                      <td><span className={`badge ${sum.total ? 'warn' : 'ok'}`}>{sum.total}</span></td>
                      <td><span className={`badge ${sum.unapproved ? 'err' : 'ok'}`}>{sum.unapproved}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="muted small" style={{ marginTop: 8 }}>לחיצה על תא מסמנת: ריק ← ✓ נוכח ← ✗ חיסור לא מאושר ← ✗ חיסור מאושר ← ריק</div>
      </div>
    </RecordLayout>
  )
}
