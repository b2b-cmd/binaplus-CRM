import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { updateField } from '../lib/api'
import RecordLayout from '../components/RecordLayout'
import RecordFormModal from '../components/RecordFormModal'
import EditField from '../components/EditField'
import Icon from '../components/Icon'

export default function ModuleDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [m, setM] = useState(null)
  const [showLesson, setShowLesson] = useState(false)
  const [lessons, setLessons] = useState([])
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [prodLinks, setProdLinks] = useState([])   // product_ids
  const [lectLinks, setLectLinks] = useState([])   // user_ids
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const [{ data: mod }, { data: prods }, { data: usrs }, { data: mp }, { data: ml }, { data: cm }] = await Promise.all([
      supabase.from('modules').select('*').eq('id', id).single(),
      supabase.from('products').select('id, name').order('name'),
      supabase.from('users').select('id, full_name, phone, email, user_type').eq('active', true).order('full_name'),
      supabase.from('module_products').select('product_id').eq('module_id', id),
      supabase.from('module_lecturers').select('user_id').eq('module_id', id),
      supabase.from('cycle_modules').select('cycle:cycles(id,name,product:products(name))').eq('module_id', id),
    ])
    setM(mod); setProducts(prods || []); setUsers(usrs || [])
    setProdLinks((mp || []).map(x => x.product_id)); setLectLinks((ml || []).map(x => x.user_id))
    setCycles((cm || []).map(x => x.cycle).filter(Boolean))
    const { data: ls } = await supabase.from('lessons').select('id, position, name, description, lesson_lecturers(user:users(full_name))').eq('module_id', id).is('deleted_at', null).order('position')
    setLessons(ls || []); setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const save = async (field, value) => { setM(x => ({ ...x, [field]: value })); await updateField('modules', m, field, value) }
  const toggleProd = async (pid) => {
    if (prodLinks.includes(pid)) { await supabase.from('module_products').delete().eq('module_id', id).eq('product_id', pid); setProdLinks(l => l.filter(x => x !== pid)) }
    else { await supabase.from('module_products').insert({ module_id: id, product_id: pid }); setProdLinks(l => [...l, pid]) }
  }
  const toggleLect = async (uid) => {
    if (lectLinks.includes(uid)) { await supabase.from('module_lecturers').delete().eq('module_id', id).eq('user_id', uid); setLectLinks(l => l.filter(x => x !== uid)) }
    else { await supabase.from('module_lecturers').insert({ module_id: id, user_id: uid }); setLectLinks(l => [...l, uid]) }
  }

  if (loading) return <div className="empty"><span className="spinner" /></div>
  if (!m) return <div className="card"><div className="empty">מודול לא נמצא.</div></div>

  const lecturers = users.filter(u => lectLinks.includes(u.id))
  const related = [
    { key: 'cycles', label: 'מחזורים', count: cycles.length, rows: cycles, onOpen: r => `/cycles/${r.id}`, columns: [{ label: 'מחזור', get: r => r.name }, { label: 'מוצר', get: r => r.product?.name || '-' }] },
    { key: 'lessons', resource: 'lessons', fk: 'module_id', recordId: id, label: 'שיעורים', count: lessons.length, rows: lessons, onOpen: r => `/lessons/${r.id}`, columns: [{ label: '#', get: r => r.position }, { label: 'שיעור', get: r => r.name }] },
  ]

  return (
    <RecordLayout title={`מודול: ${m.name}`} backTo="/modules" objectType="modules" recordId={id} table="modules" related={related}>
      <div className="card">
        <div className="field-grid">
          <EditField label="שם מודול" value={m.name} onSave={v => save('name', v)} />
          <EditField label="מספר" value={m.number} type="number" onSave={v => save('number', v)} />
          <EditField label="כותרת" value={m.title} onSave={v => save('title', v)} />
          <EditField label="קישור למצגת" value={m.presentation_url} type="link" ltr onSave={v => save('presentation_url', v)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <EditField label="תכנים נלמדים" value={m.contents} type="textarea" onSave={v => save('contents', v)} />
          <EditField label="תרגול ושיעורי בית" value={m.homework} type="textarea" onSave={v => save('homework', v)} />
          <EditField label="תוכן רלוונטי (קונטקסט ל-AI)" value={m.ai_context} type="textarea" onSave={v => save('ai_context', v)} />
          <EditField label="הערות" value={m.notes} type="textarea" onSave={v => save('notes', v)} />
        </div>
      </div>

      <div className="card">
        <div className="card-title"><Icon name="book" /> שיעורים ({lessons.length}) <div className="spacer" /><button className="btn subtle sm" onClick={() => setShowLesson(true)}><Icon name="plus" size={14} /> שיעור חדש</button></div>
        {lessons.length === 0 ? <div className="empty small">אין שיעורים עדיין</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {lessons.map(ls => (
              <div key={ls.id} className="row clickable" style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)' }} onClick={() => nav(`/lessons/${ls.id}`)}>
                <span className="badge mp" style={{ minWidth: 26, justifyContent: 'center' }}>{ls.position}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 700 }}>{ls.name}</div>
                  {ls.description && <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ls.description}</div>}
                </div>
                {(ls.lesson_lecturers || []).map(x => x.user?.full_name).filter(Boolean).slice(0, 2).map((n, i) => <span key={i} className="badge gray">{n}</span>)}
                <Icon name="chevron" size={15} style={{ transform: 'scaleX(-1)', color: 'var(--text-3)' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title"><Icon name="grid" /> מוצרים משוייכים</div>
        <div className="row wrap" style={{ gap: 6 }}>
          {products.map(p => <button key={p.id} className={`chip ${prodLinks.includes(p.id) ? 'active' : ''}`} onClick={() => toggleProd(p.id)}>{prodLinks.includes(p.id) ? '✓ ' : ''}{p.name}</button>)}
        </div>
      </div>

      <div className="card">
        <div className="card-title"><Icon name="users" /> מרצים</div>
        <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
          {users.map(u => <button key={u.id} className={`chip ${lectLinks.includes(u.id) ? 'active' : ''}`} onClick={() => toggleLect(u.id)}>{lectLinks.includes(u.id) ? '✓ ' : ''}{u.full_name}</button>)}
        </div>
        {lecturers.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lecturers.map(u => (
            <div key={u.id} className="row small" style={{ padding: '6px 8px', background: 'var(--surface-2)', borderRadius: 8 }}>
              <b>{u.full_name}</b><span className="muted" dir="ltr">{u.phone || ''}</span><span className="muted" dir="ltr">{u.email || ''}</span>
            </div>
          ))}
        </div>}
      </div>

      {showLesson && <RecordFormModal type="lesson" defaults={{ module_id: id, position: lessons.length + 1 }} onClose={() => setShowLesson(false)} onCreated={row => nav(`/lessons/${row.id}`)} />}
    </RecordLayout>
  )
}
