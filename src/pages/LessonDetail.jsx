import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateField, loadOptions } from '../lib/api'
import RecordLayout from '../components/RecordLayout'
import EditField from '../components/EditField'
import Icon from '../components/Icon'

export default function LessonDetail() {
  const { id } = useParams()
  const [l, setL] = useState(null)
  const [users, setUsers] = useState([])
  const [lectLinks, setLectLinks] = useState([])    // user_ids linked as lecturers (M2M)
  const [cycles, setCycles] = useState([])          // cycles relevant to this lesson's module products
  const [cycleId, setCycleId] = useState('')
  const [students, setStudents] = useState([])
  const [att, setAtt] = useState({})                 // person_id → {present, approved, notes, id?}
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: lesson } = await supabase.from('lessons').select('*, product:products(name)').eq('id', id).single()
      setL(lesson)
      const [{ data: us }, { data: cy }, { data: ll }] = await Promise.all([
        supabase.from('users').select('id, full_name').eq('active', true).order('full_name'),
        lesson?.product_id
          ? supabase.from('cycles').select('id, name, product:products(name)').eq('product_id', lesson.product_id).is('deleted_at', null).order('name')
          : supabase.from('cycles').select('id, name, product:products(name)').is('deleted_at', null).order('name'),
        supabase.from('lesson_lecturers').select('user_id').eq('lesson_id', id),
      ])
      setUsers(us || []); setCycles(cy || [])
      setLectLinks((ll || []).map(x => x.user_id))
      setLoading(false)
    })()
  }, [id])

  // load students + existing attendance when a cycle is picked
  useEffect(() => {
    if (!cycleId) { setStudents([]); setAtt({}); return }
    (async () => {
      const [{ data: ppl }, { data: existing }] = await Promise.all([
        supabase.from('people').select('id, full_name, phone').eq('cycle_id', cycleId).is('deleted_at', null).neq('sales_status', 'cancelled').order('full_name'),
        supabase.from('attendance').select('*').eq('lesson_id', id).eq('cycle_id', cycleId),
      ])
      setStudents(ppl || [])
      const map = {}
      for (const p of ppl || []) {
        const ex = (existing || []).find(a => a.person_id === p.id)
        map[p.id] = ex ? { id: ex.id, present: ex.present, approved: ex.approved, notes: ex.notes || '' } : { present: true, approved: false, notes: '' }
      }
      setAtt(map)
    })()
  }, [cycleId, id])

  const save = async (field, value) => { setL(x => ({ ...x, [field]: value })); await updateField('lessons', l, field, value) }
  const toggleLect = async (uid) => {
    if (lectLinks.includes(uid)) { await supabase.from('lesson_lecturers').delete().eq('lesson_id', id).eq('user_id', uid); setLectLinks(a => a.filter(x => x !== uid)) }
    else { await supabase.from('lesson_lecturers').insert({ lesson_id: id, user_id: uid }); setLectLinks(a => [...a, uid]) }
  }
  const setA = (pid, patch) => setAtt(a => ({ ...a, [pid]: { ...a[pid], ...patch } }))

  const saveAttendance = async () => {
    setSaving(true); setSavedMsg('')
    const rows = students.map(p => ({
      lesson_id: id, cycle_id: cycleId, person_id: p.id,
      present: att[p.id]?.present ?? true, approved: att[p.id]?.approved ?? false,
      notes: att[p.id]?.notes?.trim() || null, updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'lesson_id,cycle_id,person_id' })
    setSaving(false)
    setSavedMsg(error ? 'שגיאה בשמירה' : `נוכחות נשמרה (${rows.length} תלמידים) ✓`)
  }

  const stats = useMemo(() => {
    const vals = students.map(p => att[p.id]).filter(Boolean)
    return { present: vals.filter(v => v.present).length, absent: vals.filter(v => !v.present).length }
  }, [att, students])

  if (loading) return <div className="empty"><span className="spinner" /></div>
  if (!l) return <div className="card"><div className="empty">שיעור לא נמצא.</div></div>

  return (
    <RecordLayout title={`שיעור ${l.number ? l.number + ': ' : ''}${l.name}`} subtitle={l.product?.name} backTo="/lessons"
      objectType="lessons" recordId={id} table="lessons" recordType="lesson" record={l}>
      <div className="card">
        <div className="field-grid">
          <EditField label="מס' מפגש" value={l.number} type="number" onSave={v => save('number', v)} />
          <EditField label="שם השיעור" value={l.name} onSave={v => save('name', v)} />
          <EditField label="סוג מפגש" value={l.type} onSave={v => save('type', v)} />
          <EditField label="מרצה (שם חופשי)" value={l.lecturer_name} onSave={v => save('lecturer_name', v)} />
          <EditField label="קישור למצגת" value={l.presentation_url} type="link" ltr onSave={v => save('presentation_url', v)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <EditField label="תכנים נלמדים / מערך שיעור" value={l.content} type="textarea" onSave={v => save('content', v)} />
          <EditField label="תרגול ושיעורי בית" value={l.homework} type="textarea" onSave={v => save('homework', v)} />
        </div>
      </div>

      {/* Lecturers (M2M linked to users) — complements the free-text name above */}
      <div className="card">
        <div className="card-title"><Icon name="users" /> מרצים מקושרים {lectLinks.length > 0 && <span className="muted small">({lectLinks.length})</span>}</div>
        <div className="row wrap" style={{ gap: 6 }}>
          {users.map(u => <button key={u.id} className={`chip ${lectLinks.includes(u.id) ? 'active' : ''}`} onClick={() => toggleLect(u.id)}>{lectLinks.includes(u.id) ? '✓ ' : ''}{u.full_name}</button>)}
        </div>
        {users.length === 0 && <div className="empty small">אין משתמשים פעילים</div>}
      </div>

      {/* Attendance */}
      <div className="card" style={{ borderColor: 'var(--lp)' }}>
        <div className="card-title"><Icon name="users" /> מילוי נוכחות</div>
        <div className="row wrap" style={{ marginBottom: 12 }}>
          <select className="input" style={{ maxWidth: 300 }} value={cycleId} onChange={e => setCycleId(e.target.value)}>
            <option value="">בחרו מחזור…</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}{c.product?.name ? ` · ${c.product.name}` : ''}</option>)}
          </select>
          {cycleId && students.length > 0 && <>
            <span className="badge ok">נוכחים {stats.present}</span>
            <span className="badge err">חסרים {stats.absent}</span>
            <div className="spacer" />
            <button className="btn subtle sm" onClick={() => setAtt(Object.fromEntries(students.map(p => [p.id, { ...att[p.id], present: true }])))}>סמן הכל נוכח</button>
            <button className="btn sm" onClick={saveAttendance} disabled={saving}>{saving ? <span className="spinner light" style={{ width: 15, height: 15 }} /> : 'שמור נוכחות'}</button>
          </>}
        </div>
        {savedMsg && <div className="small" style={{ color: savedMsg.includes('שגיאה') ? 'var(--err)' : 'var(--ok)', marginBottom: 10, fontWeight: 700 }}>{savedMsg}</div>}
        {!cycleId ? <div className="empty small">בחרו מחזור כדי למלא נוכחות</div>
          : students.length === 0 ? <div className="empty small">אין תלמידים משויכים למחזור זה</div>
          : (
            <div className="table-wrap">
              <table className="grid">
                <thead><tr><th>תלמיד</th><th>נוכח/ה</th><th>חיסור מאושר</th><th>הערות</th></tr></thead>
                <tbody>
                  {students.map(p => {
                    const a = att[p.id] || {}
                    return (
                      <tr key={p.id} style={{ background: a.present === false ? 'var(--err-bg)' : undefined }}>
                        <td style={{ fontWeight: 600 }}>{p.full_name}</td>
                        <td>
                          <button className={`badge ${a.present ? 'ok' : 'err'}`} style={{ border: 'none', cursor: 'pointer' }}
                            onClick={() => setA(p.id, { present: !a.present })}>{a.present ? '✓ נוכח/ה' : '✗ חסר/ה'}</button>
                        </td>
                        <td>
                          {!a.present
                            ? <button className={`badge ${a.approved ? 'ok' : 'warn'}`} style={{ border: 'none', cursor: 'pointer' }}
                                onClick={() => setA(p.id, { approved: !a.approved })}>{a.approved ? 'מאושר' : 'לא מאושר'}</button>
                            : <span className="muted small">-</span>}
                        </td>
                        <td><input className="input" style={{ padding: '5px 8px', fontSize: '0.85rem' }} value={a.notes || ''} placeholder="הערה…" onChange={e => setA(p.id, { notes: e.target.value })} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </RecordLayout>
  )
}
