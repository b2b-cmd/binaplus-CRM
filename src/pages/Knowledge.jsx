import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadOptions } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import Icon from '../components/Icon'
import { confirmDialog } from '../components/Dialogs'

const EMPTY = { topic: '', question: '', answer: '', module_id: '' }

export default function Knowledge() {
  const rep = useAuthStore(s => s.rep)
  const isManager = useAuthStore(s => s.isManager)()
  const [items, setItems] = useState([])
  const [modules, setModules] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase.from('knowledge_base').select('*, module:modules(name)').order('updated_at', { ascending: false })
    setItems(data || []); setLoading(false)
  }
  useEffect(() => { loadOptions().then(o => setModules(o.modules)); load() }, [])

  const save = async () => {
    if (!form.answer.trim()) return
    const payload = { ...form, module_id: form.module_id || null, created_by: rep?.id, updated_at: new Date().toISOString() }
    if (editing) await supabase.from('knowledge_base').update(payload).eq('id', editing)
    else await supabase.from('knowledge_base').insert(payload)
    setForm(EMPTY); setEditing(null); load()
  }
  const edit = (it) => { setEditing(it.id); setForm({ topic: it.topic || '', question: it.question || '', answer: it.answer || '', module_id: it.module_id || '' }) }
  const remove = async (id) => { if (await confirmDialog('למחוק פריט ידע?')) { await supabase.from('knowledge_base').delete().eq('id', id); load() } }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isManager ? '1fr 340px' : '1fr', gap: 16, alignItems: 'start' }}>
      <div>
        {loading ? <div className="empty"><span className="spinner" /></div>
          : items.length === 0 ? <div className="card"><div className="empty">אין עדיין פריטי ידע. {isManager && 'הוסיפו אחד →'}</div></div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(it => (
              <div key={it.id} className="card">
                <div className="row">
                  {it.module?.name && <span className="badge mp">{it.module.name}</span>}
                  {it.topic && <span style={{ fontWeight: 700 }}>{it.topic}</span>}
                  <div className="spacer" />
                  {isManager && <>
                    <button className="btn subtle sm" onClick={() => edit(it)}>עריכה</button>
                    <button className="btn subtle sm" style={{ color: 'var(--err)' }} onClick={() => remove(it.id)}>מחיקה</button>
                  </>}
                </div>
                {it.question && <div className="small" style={{ fontWeight: 600, marginTop: 8 }}>ש: {it.question}</div>}
                <div className="muted small" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{it.answer}</div>
              </div>
            ))}
          </div>}
      </div>

      {isManager && (
        <div className="card" style={{ position: 'sticky', top: 76 }}>
          <div className="card-title"><Icon name={editing ? 'save' : 'plus'} /> {editing ? 'עריכת פריט' : 'פריט ידע חדש'}</div>
          <div className="field"><label>מודול (אופציונלי)</label>
            <select value={form.module_id} onChange={e => setForm(f => ({ ...f, module_id: e.target.value }))}>
              <option value="">כללי</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field"><label>נושא</label><input value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="למשל: גישה לפורטל" /></div>
          <div className="field"><label>שאלה נפוצה</label><input value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} /></div>
          <div className="field"><label>תשובה מאושרת <span className="req">*</span></label><textarea value={form.answer} onChange={e => setForm(f => ({ ...f, answer: e.target.value }))} style={{ minHeight: 110 }} /></div>
          <div className="row">
            <button className="btn" onClick={save} disabled={!form.answer.trim()}>{editing ? 'עדכן' : 'הוסף'}</button>
            {editing && <button className="btn subtle sm" onClick={() => { setForm(EMPTY); setEditing(null) }}>ביטול</button>}
          </div>
        </div>
      )}
    </div>
  )
}
